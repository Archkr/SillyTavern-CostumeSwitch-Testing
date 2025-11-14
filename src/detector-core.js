import { collectProfilePreprocessorScripts, applyPreprocessorScripts } from "./core/script-preprocessor.js";

const DEFAULT_UNICODE_WORD_PATTERN = "[\\p{L}\\p{M}\\p{N}_]";
const WORD_CHAR_REGEX = /[\p{L}\p{M}\p{N}]/u;
const DEFAULT_BOUNDARY_LOOKBEHIND = "(?<![A-Za-z0-9_'’])";

export function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

export function parsePatternEntry(raw) {
    const text = String(raw ?? "").trim();
    if (!text) {
        return null;
    }
    const regexMatch = text.match(/^\/((?:\\.|[^\/])+)\/([gimsuy]*)$/);
    if (regexMatch) {
        return { body: regexMatch[1], flags: regexMatch[2] || "", raw: text };
    }
    return { body: escapeRegex(text), flags: "", raw: text };
}

export function computeFlags(entries, requireI = true) {
    const flags = new Set(requireI ? ["i"] : []);
    for (const entry of entries || []) {
        if (!entry) {
            continue;
        }
        for (const flag of entry.flags || "") {
            if ("gimsuy".includes(flag)) {
                flags.add(flag);
            }
        }
    }
    return Array.from(flags).join("");
}

export function buildRegex(patternList, template, options = {}) {
    const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!entries.length) {
        return null;
    }
    const patternBody = entries.map(entry => `(?:${entry.body})`).join("|");
    const finalBody = template.replace("{{PATTERNS}}", patternBody);
    let finalFlags = computeFlags(entries, options.requireI !== false);
    if (options.extraFlags) {
        for (const flag of options.extraFlags) {
            if (flag && !finalFlags.includes(flag)) {
                finalFlags += flag;
            }
        }
    }
    return new RegExp(finalBody, finalFlags);
}

export function buildGenericRegex(patternList) {
    if (!patternList || !patternList.length) {
        return null;
    }
    const entries = patternList.map(parsePatternEntry).filter(Boolean);
    if (!entries.length) {
        return null;
    }
    const body = entries.map(entry => entry.body).join("|");
    return new RegExp(`(?:${body})`, computeFlags(entries));
}

function buildAlternation(list) {
    const seen = new Set();
    return (list || [])
        .map(parsePatternEntry)
        .filter(Boolean)
        .map(entry => entry.body)
        .filter(body => {
            if (!body || seen.has(body)) {
                return false;
            }
            seen.add(body);
            return true;
        })
        .join("|");
}

function gatherProfilePatterns(profile) {
    const result = [];
    const seen = new Set();

    const add = (value) => {
        const trimmed = String(value ?? "").trim();
        if (!trimmed || seen.has(trimmed)) {
            return;
        }
        seen.add(trimmed);
        result.push(trimmed);
    };

    if (profile && Array.isArray(profile.patternSlots)) {
        profile.patternSlots.forEach((slot) => {
            if (!slot) {
                return;
            }
            if (typeof slot === "string") {
                add(slot);
                return;
            }
            const name = typeof slot.name === "string" ? slot.name : null;
            if (name) {
                add(name);
            }
            const aliasSources = [
                slot.aliases,
                slot.patterns,
                slot.alternateNames,
                slot.names,
                slot.variants,
            ];
            aliasSources.forEach((source) => {
                if (!source) {
                    return;
                }
                if (Array.isArray(source)) {
                    source.forEach(add);
                } else {
                    add(source);
                }
            });
        });
    }

    if (profile && Array.isArray(profile.patterns)) {
        profile.patterns.forEach(add);
    }

    return result;
}

const QUOTE_PAIRS = [
    { open: "\"", close: "\"", symmetric: true },
    { open: "＂", close: "＂", symmetric: true },
    { open: "“", close: "”" },
    { open: "„", close: "”" },
    { open: "‟", close: "”" },
    { open: "«", close: "»" },
    { open: "‹", close: "›" },
    { open: "「", close: "」" },
    { open: "『", close: "』" },
    { open: "｢", close: "｣" },
    { open: "《", close: "》" },
    { open: "〈", close: "〉" },
    { open: "﹁", close: "﹂" },
    { open: "﹃", close: "﹄" },
    { open: "〝", close: "〞" },
    { open: "‘", close: "’" },
    { open: "‚", close: "’" },
    { open: "‛", close: "’" },
    { open: "'", close: "'", symmetric: true, apostropheSensitive: true },
];

const QUOTE_OPENERS = new Map();
const QUOTE_CLOSERS = new Map();

QUOTE_PAIRS.forEach((pair) => {
    const info = {
        close: pair.close,
        symmetric: Boolean(pair.symmetric),
        apostropheSensitive: Boolean(pair.apostropheSensitive),
    };
    QUOTE_OPENERS.set(pair.open, info);
    if (info.symmetric) {
        return;
    }
    if (!QUOTE_CLOSERS.has(pair.close)) {
        QUOTE_CLOSERS.set(pair.close, []);
    }
    QUOTE_CLOSERS.get(pair.close).push(pair.open);
});

function createQuoteState(bufferOffset = 0) {
    const offset = Number.isFinite(bufferOffset) ? Math.max(0, Math.floor(bufferOffset)) : 0;
    return {
        ranges: [],
        stack: [],
        windowOffset: offset,
        lastIndex: offset - 1,
    };
}

function projectQuoteRanges(state, bufferOffset, textLength) {
    if (!state || !Array.isArray(state.ranges)) {
        return [];
    }
    const offset = Number.isFinite(bufferOffset) ? Math.max(0, Math.floor(bufferOffset)) : 0;
    const limit = offset + Math.max(0, textLength);
    return state.ranges
        .filter((range) => {
            if (!Array.isArray(range) || range.length < 2) {
                return false;
            }
            const [start, end] = range;
            if (!Number.isFinite(start) || !Number.isFinite(end)) {
                return false;
            }
            return end >= offset && start < limit;
        })
        .map(([start, end]) => [
            Math.max(0, start - offset),
            Math.max(0, Math.min(limit - offset - 1, end - offset)),
        ])
        .sort((a, b) => a[0] - b[0]);
}

function scanQuotes(text, quoteState, options = {}) {
    const state = quoteState || createQuoteState(options.bufferOffset);
    const offset = Number.isFinite(options.bufferOffset) ? Math.max(0, Math.floor(options.bufferOffset)) : 0;
    const startIndex = Number.isFinite(options.startIndex) && options.startIndex >= 0
        ? Math.min(Math.floor(options.startIndex), text.length)
        : 0;
    const reset = Boolean(options.reset);

    if (reset) {
        state.ranges = [];
        state.stack = [];
        state.lastIndex = offset - 1;
    } else {
        if (!Array.isArray(state.ranges)) {
            state.ranges = [];
        }
        if (!Array.isArray(state.stack)) {
            state.stack = [];
        }
    }

    const isLikelyApostrophe = (index) => {
        if (index < 0 || index >= text.length) {
            return false;
        }
        const prev = index > 0 ? text[index - 1] : "";
        const next = index + 1 < text.length ? text[index + 1] : "";
        return WORD_CHAR_REGEX.test(prev) && WORD_CHAR_REGEX.test(next);
    };

    let absoluteIndex = offset + startIndex;
    for (let i = startIndex; i < text.length; i += 1, absoluteIndex += 1) {
        const ch = text[i];
        const openerInfo = QUOTE_OPENERS.get(ch);
        if (openerInfo) {
            if (openerInfo.symmetric) {
                if (openerInfo.apostropheSensitive && isLikelyApostrophe(i)) {
                    continue;
                }
                const top = state.stack[state.stack.length - 1];
                if (top && top.open === ch && top.symmetric) {
                    state.stack.pop();
                    state.ranges.push([top.index, absoluteIndex]);
                } else {
                    state.stack.push({
                        open: ch,
                        close: openerInfo.close,
                        index: absoluteIndex,
                        symmetric: true,
                        apostropheSensitive: openerInfo.apostropheSensitive,
                    });
                }
                continue;
            }
            state.stack.push({ open: ch, close: openerInfo.close, index: absoluteIndex, symmetric: false });
            continue;
        }

        const closeCandidates = QUOTE_CLOSERS.get(ch);
        if (closeCandidates && state.stack.length) {
            for (let j = state.stack.length - 1; j >= 0; j -= 1) {
                const candidate = state.stack[j];
                if (!candidate.symmetric && candidate.close === ch && closeCandidates.includes(candidate.open)) {
                    state.stack.splice(j, 1);
                    state.ranges.push([candidate.index, absoluteIndex]);
                    break;
                }
            }
            continue;
        }

        const top = state.stack[state.stack.length - 1];
        if (top && top.symmetric && ch === top.close) {
            state.stack.pop();
            state.ranges.push([top.index, absoluteIndex]);
        }
    }

    state.lastIndex = Math.max(state.lastIndex, text.length > 0 ? offset + text.length - 1 : offset - 1);
    state.windowOffset = offset;
    return state;
}

export function getQuoteRanges(text) {
    if (!text) {
        return [];
    }
    const input = typeof text === "string" ? text : String(text ?? "");
    const state = createQuoteState(0);
    scanQuotes(input, state, { startIndex: 0, bufferOffset: 0, reset: true });
    return projectQuoteRanges(state, 0, input.length);
}

export function isIndexInsideQuotes(index, quoteRanges) {
    for (const [start, end] of quoteRanges) {
        if (index > start && index < end) {
            return true;
        }
    }
    return false;
}

export function findMatches(text, regex, quoteRanges, options = {}) {
    if (!text || !regex) {
        return [];
    }
    const results = [];
    const searchInsideQuotes = Boolean(options.searchInsideQuotes);
    const startIndex = Number.isFinite(options.startIndex) && options.startIndex > 0
        ? Math.max(0, Math.floor(options.startIndex))
        : 0;
    const minIndex = Number.isFinite(options.minIndex)
        ? Math.max(0, Math.floor(options.minIndex))
        : null;
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    const matcher = new RegExp(regex.source, flags);
    if (startIndex > 0) {
        matcher.lastIndex = startIndex;
    }
    let match;
    while ((match = matcher.exec(text)) !== null) {
        const matchLength = typeof match[0] === "string" ? match[0].length : 0;
        if (minIndex != null && match.index + matchLength <= minIndex) {
            continue;
        }
        if (searchInsideQuotes || !isIndexInsideQuotes(match.index, quoteRanges)) {
            results.push({ match: match[0], groups: match.slice(1), index: match.index });
        }
    }
    return results;
}

export function compileProfileRegexes(profile = {}, options = {}) {
    const unicodeWordPattern = options.unicodeWordPattern || DEFAULT_UNICODE_WORD_PATTERN;
    const boundaryLookbehind = options.boundaryLookbehind || DEFAULT_BOUNDARY_LOOKBEHIND;
    const defaultPronouns = Array.isArray(options.defaultPronouns) && options.defaultPronouns.length
        ? options.defaultPronouns
        : ["he", "she", "they"];

    const honorificParticles = [
        "san",
        "sama",
        "chan",
        "kun",
        "dono",
        "sensei",
        "senpai",
        "shi",
        "씨",
        "さま",
        "さん",
        "くん",
        "ちゃん",
        "様",
        "殿",
        "先輩",
    ];
    const honorificAlternation = honorificParticles.map(particle => escapeRegex(particle)).join("|");
    const honorificPattern = honorificAlternation
        ? `(?:\\s*[-‐‑–—―~]?\\s*(?:${honorificAlternation}))?`
        : "";
    const punctuationSegment = "(?:\\s*[，,、‧·\\u2013\\u2014\\u2026]+\\s*)";
    const punctuationSpacer = `(?:${punctuationSegment})*`;
    const compoundTokenPattern = `(?:(?:\\s+|[-‐‑–—―]\\s*)(?=[\\p{Lu}\\p{Lt}\\p{Lo}])(?:${unicodeWordPattern}+))`;
    const compoundBridge = `(?:${punctuationSpacer}${compoundTokenPattern})?`;
    const descriptorWordPattern = `(?:${unicodeWordPattern}+(?:[-‐‑–—―]${unicodeWordPattern}+)*)`;
    const descriptorSequence = `(?:${descriptorWordPattern}(?:\\s+${descriptorWordPattern}){0,7})`;
    const commaDescriptor = `(?:,\\s*(?:${descriptorSequence}))`;
    const parentheticalDescriptor = `(?:\\s*\\(\\s*(?:${descriptorSequence})\\s*\\))`;
    const descriptorPattern = `(?:${commaDescriptor}|${parentheticalDescriptor}){0,3}`;
    const separatorPattern = `(?:${punctuationSegment}|\\s+)+`;
    const nameTailPattern = `${honorificPattern}(?:['’]s)?${compoundBridge}${descriptorPattern}${separatorPattern}`;

    const ignored = (profile.ignorePatterns || []).map(value => String(value ?? "").trim().toLowerCase()).filter(Boolean);
    const effectivePatterns = gatherProfilePatterns(profile)
        .map(value => String(value ?? "").trim())
        .filter(value => value && !ignored.includes(value.toLowerCase()));

    const attributionVerbsPattern = buildAlternation(profile.attributionVerbs);
    const actionVerbsPattern = buildAlternation(profile.actionVerbs);
    const pronounVocabulary = Array.isArray(profile.pronounVocabulary) && profile.pronounVocabulary.length
        ? profile.pronounVocabulary
        : defaultPronouns;
    const pronounPattern = buildAlternation(pronounVocabulary);

    const speakerTemplate = "(?:^|[\\r\\n]+|[>\\]]\\s*)({{PATTERNS}})\\s*:";
    const fillerRunupPattern = `(?:${unicodeWordPattern}+\\s+){0,7}?`;
    const attributionTemplate = attributionVerbsPattern
        ? `${boundaryLookbehind}({{PATTERNS}})${nameTailPattern}${fillerRunupPattern}(?:${attributionVerbsPattern})`
        : null;
    const actionTemplate = actionVerbsPattern
        ? `${boundaryLookbehind}({{PATTERNS}})${nameTailPattern}${fillerRunupPattern}(?:${actionVerbsPattern})`
        : null;

    const pronounLeadBoundary = `(?<!${unicodeWordPattern})\\b`;

    const regexes = {
        speakerRegex: buildRegex(effectivePatterns, speakerTemplate),
        attributionRegex: attributionTemplate ? buildRegex(effectivePatterns, attributionTemplate, { extraFlags: "u" }) : null,
        actionRegex: actionTemplate ? buildRegex(effectivePatterns, actionTemplate, { extraFlags: "u" }) : null,
        pronounRegex: (actionVerbsPattern && pronounPattern)
            ? new RegExp(
                `${pronounLeadBoundary}(?:${pronounPattern})(?:['’]s)?\\s+(?:${unicodeWordPattern}+\\s+){0,3}?(?:${actionVerbsPattern})`,
                "iu",
            )
            : null,
        vocativeRegex: buildRegex(effectivePatterns, `["“'\\s]({{PATTERNS}})[,.!?]`),
        possessiveRegex: buildRegex(effectivePatterns, `\\b({{PATTERNS}})['’]s\\b`),
        nameRegex: buildRegex(effectivePatterns, `\\b({{PATTERNS}})\\b`),
        vetoRegex: buildGenericRegex(profile.vetoPatterns),
    };

    const preprocessorScripts = collectProfilePreprocessorScripts(profile);
    regexes.preprocessorScripts = preprocessorScripts;

    return {
        regexes,
        effectivePatterns,
        pronounPattern,
        preprocessorScripts,
    };
}

export function collectDetections(text, profile = {}, regexes = {}, options = {}) {
    const matches = [];
    const originalText = typeof text === "string" ? text : String(text ?? "");
    matches.originalText = originalText;
    matches.preprocessedText = originalText;
    if (!originalText || !profile) {
        return matches;
    }
    const pipeline = Array.isArray(regexes.preprocessorScripts) ? regexes.preprocessorScripts : [];
    const preprocessorResult = applyPreprocessorScripts(originalText, pipeline);
    const sourceText = typeof preprocessorResult?.text === "string" ? preprocessorResult.text : originalText;
    matches.preprocessedText = sourceText;
    const bufferOffset = Number.isFinite(options.bufferOffset) ? Math.max(0, Math.floor(options.bufferOffset)) : 0;
    const quoteState = typeof options.quoteState === "object" && options.quoteState ? options.quoteState : null;
    let quoteRanges;
    if (Array.isArray(options.quoteRanges)) {
        quoteRanges = options.quoteRanges;
    } else if (quoteState) {
        const resetQuotes = !Number.isFinite(options.lastIndex)
            || options.lastIndex < bufferOffset - 1
            || Boolean(options.resetQuoteState);
        const resolvedStartIndex = Number.isFinite(options.startIndex) && options.startIndex >= 0
            ? Math.max(0, Math.min(Math.floor(options.startIndex), sourceText.length))
            : 0;
        const relativeFromLast = Number.isFinite(options.lastIndex)
            ? Math.max(0, Math.floor(options.lastIndex + 1 - bufferOffset))
            : 0;
        const quoteStart = resetQuotes ? 0 : Math.min(resolvedStartIndex, relativeFromLast);
        scanQuotes(sourceText, quoteState, {
            startIndex: quoteStart,
            bufferOffset,
            reset: resetQuotes,
        });
        quoteRanges = projectQuoteRanges(quoteState, bufferOffset, sourceText.length);
    } else {
        quoteRanges = getQuoteRanges(sourceText);
    }
    const priorityWeights = options.priorityWeights || {};
    const scanDialogueActions = Boolean(options.scanDialogueActions);
    const startIndex = Number.isFinite(options.startIndex) && options.startIndex > 0
        ? Math.max(0, Math.floor(options.startIndex))
        : 0;
    const minIndex = Number.isFinite(options.minIndex)
        ? Math.max(0, Math.floor(options.minIndex))
        : null;
    const matchOptions = { startIndex, minIndex };

    const addMatch = (name, matchKind, index, priority, length = null) => {
        const trimmedName = String(name ?? "").trim();
        if (!trimmedName) {
            return;
        }
        matches.push({
            name: trimmedName,
            matchKind,
            matchIndex: Number.isFinite(index) ? index : null,
            priority: Number.isFinite(priority) ? priority : null,
            matchLength: Number.isFinite(length) && length > 0 ? length : null,
        });
    };

    const getMatchLength = (match) => {
        const value = typeof match?.match === "string" ? match.match.length : null;
        return Number.isFinite(value) && value > 0 ? value : null;
    };

    if (regexes.speakerRegex) {
        findMatches(sourceText, regexes.speakerRegex, quoteRanges, matchOptions).forEach(match => {
            const name = match.groups?.[0]?.trim();
            addMatch(name, "speaker", match.index, priorityWeights.speaker, getMatchLength(match));
        });
    }

    if (profile.detectAttribution !== false && regexes.attributionRegex) {
        findMatches(
            sourceText,
            regexes.attributionRegex,
            quoteRanges,
            { searchInsideQuotes: scanDialogueActions, ...matchOptions },
        ).forEach(match => {
            const name = match.groups?.find(group => group)?.trim();
            addMatch(name, "attribution", match.index, priorityWeights.attribution, getMatchLength(match));
        });
    }

    if (profile.detectAction !== false && regexes.actionRegex) {
        findMatches(
            sourceText,
            regexes.actionRegex,
            quoteRanges,
            { searchInsideQuotes: scanDialogueActions, ...matchOptions },
        ).forEach(match => {
            const name = match.groups?.find(group => group)?.trim();
            addMatch(name, "action", match.index, priorityWeights.action, getMatchLength(match));
        });
    }

    const validatedSubject = typeof options.lastSubject === "string"
        ? options.lastSubject.trim()
        : "";

    if (profile.detectPronoun && regexes.pronounRegex && validatedSubject) {
        findMatches(sourceText, regexes.pronounRegex, quoteRanges, matchOptions).forEach(match => {
            addMatch(validatedSubject, "pronoun", match.index, priorityWeights.pronoun, getMatchLength(match));
        });
    }

    if (profile.detectVocative !== false && regexes.vocativeRegex) {
        findMatches(
            sourceText,
            regexes.vocativeRegex,
            quoteRanges,
            { searchInsideQuotes: true, ...matchOptions },
        ).forEach(match => {
            const name = match.groups?.[0]?.trim();
            addMatch(name, "vocative", match.index, priorityWeights.vocative, getMatchLength(match));
        });
    }

    if (profile.detectPossessive && regexes.possessiveRegex) {
        findMatches(sourceText, regexes.possessiveRegex, quoteRanges, matchOptions).forEach(match => {
            const name = match.groups?.[0]?.trim();
            addMatch(name, "possessive", match.index, priorityWeights.possessive, getMatchLength(match));
        });
    }

    if (profile.detectGeneral && regexes.nameRegex) {
        findMatches(sourceText, regexes.nameRegex, quoteRanges, matchOptions).forEach(match => {
            const raw = match.groups?.[0] ?? match.match;
            const name = String(raw ?? "").replace(/-(?:sama|san)$/i, "").trim();
            addMatch(name, "name", match.index, priorityWeights.name, getMatchLength(match));
        });
    }

    return matches;
}
