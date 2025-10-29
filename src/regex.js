import {
    DEFAULT_PRONOUNS,
    PROFILE_DEFAULTS,
    UNICODE_WORD_PATTERN,
    logPrefix,
} from "./constants.js";
import { state } from "./state.js";
import { getActiveProfile } from "./settings.js";
import { normalizeCostumeName, escapeHtml } from "./utils.js";
import { showStatus } from "./status.js";

const invalidPatternCache = new Map();

function updatePatternErrorDisplay() {
    if (typeof $ !== 'function') return;
    const $error = $("#cs-error");
    if (!$error.length) return;

    const messages = Array.from(invalidPatternCache.values())
        .map(entry => entry?.message)
        .filter(Boolean);

    if (!messages.length) {
        $error.prop('hidden', true).find('.cs-status-text').text('');
        return;
    }

    $error.prop('hidden', false).find('.cs-status-text').html(messages.join('<br>'));
}

function formatPatternLabel(entry) {
    if (!entry) return '';
    if (typeof entry.raw === 'string' && entry.raw.trim()) {
        return entry.raw.trim();
    }
    if (typeof entry.body === 'string' && entry.body.trim()) {
        return entry.body.trim();
    }
    return '';
}

function notifyInvalidPatterns(invalidEntries = [], context = 'pattern') {
    const scope = String(context || 'pattern');

    if (!invalidEntries.length) {
        invalidPatternCache.delete(scope);
        updatePatternErrorDisplay();
        return;
    }

    const fingerprint = invalidEntries
        .map((entry) => formatPatternLabel(entry))
        .filter(Boolean)
        .sort()
        .join('||');

    const existing = invalidPatternCache.get(scope);
    if (existing?.fingerprint === fingerprint) {
        return;
    }

    const previewCount = Math.min(invalidEntries.length, 3);
    const preview = invalidEntries
        .slice(0, previewCount)
        .map((entry) => {
            const label = formatPatternLabel(entry) || '(empty)';
            return `<code>${escapeHtml(label)}</code>`;
        })
        .join(', ');
    const remaining = invalidEntries.length - previewCount;
    const plural = invalidEntries.length === 1 ? '' : 's';
    const contextLabel = `${context}${plural}`;
    const remainderText = remaining > 0 ? `, and ${remaining} more` : '';
    const sampleError = invalidEntries.find((entry) => entry?.error instanceof Error)?.error?.message || '';
    const hint = sampleError ? ` (example error: ${escapeHtml(sampleError)})` : '';
    const message = `Skipped ${invalidEntries.length} invalid ${contextLabel}: ${preview}${remainderText}.${hint}`;

    console.warn(`${logPrefix} ${message}`, invalidEntries.map((entry) => ({ label: formatPatternLabel(entry), error: entry.error }))); 
    showStatus(message, 'error', 7000);
    invalidPatternCache.set(scope, { fingerprint, message });
    updatePatternErrorDisplay();
}

const LITERAL_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function escapeLiteralPattern(source) {
    return source
        .replace(LITERAL_ESCAPE_PATTERN, (match) => `\\${match}`)
        .replace(/\s+/g, () => '\\s+');
}

export function parsePatternEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) return null;
        const body = trimmed
            .replace(/[.*+?^${}()|[\]\\]/g, (match) => `\\${match}`)
            .replace(/\s+/g, () => '\\s+');
        return { body, raw: trimmed };
    }
    if (entry instanceof RegExp) {
        return { body: entry.source, raw: entry.source };
    }
    if (typeof entry === 'object' && entry !== null) {
        if (entry.regex) {
            return parsePatternEntry(entry.regex);
        }
        if (typeof entry.pattern === 'string') {
            return parsePatternEntry(entry.pattern);
        }
        if (typeof entry.body === 'string') {
            return parsePatternEntry(entry.body);
        }
    }
    return null;
}

export function buildRegex(patterns, template, { flags = 'iu', extraFlags = '', context = 'character pattern' } = {}) {
    if (!Array.isArray(patterns) || patterns.length === 0) {
        notifyInvalidPatterns([], context);
        return null;
    }

    const entries = patterns
        .map(entry => parsePatternEntry(entry))
        .filter(Boolean);

    if (!entries.length) {
        notifyInvalidPatterns([], context);
        return null;
    }

    const finalFlags = Array.from(new Set(`${flags}${extraFlags}`.split('').filter(Boolean))).join('');
    const validPieces = [];
    const validEntries = [];
    const invalidEntries = [];
    const seen = new Set();

    for (const entry of entries) {
        if (!entry?.body) {
            if (entry?.error instanceof Error) {
                invalidEntries.push(entry);
            }
            continue;
        }
        try {
            new RegExp(entry.body, finalFlags);
            if (!seen.has(entry.body)) {
                validPieces.push(entry.body);
                validEntries.push(entry);
                seen.add(entry.body);
            }
        } catch (error) {
            invalidEntries.push({ ...entry, error });
        }
    }

    if (!validPieces.length) {
        notifyInvalidPatterns(invalidEntries, context);
        return null;
    }

    let body;
    try {
        body = template.replace('{{PATTERNS}}', `(?:${validPieces.join('|')})`);
    } catch (buildError) {
        const combined = [
            ...invalidEntries,
            ...validEntries.map(entry => ({ ...entry, error: buildError })),
        ];
        notifyInvalidPatterns(combined, context);
        return null;
    }

    try {
        const compiled = new RegExp(body, finalFlags);
        notifyInvalidPatterns(invalidEntries, context);
        return compiled;
    } catch (compileError) {
        const combined = [
            ...invalidEntries,
            ...validEntries.map(entry => ({ ...entry, error: compileError })),
        ];
        notifyInvalidPatterns(combined, context);
        return null;
    }
}

export function buildGenericRegex(patterns, { flags = 'iu', context = 'veto pattern' } = {}) {
    if (!Array.isArray(patterns) || patterns.length === 0) {
        notifyInvalidPatterns([], context);
        return null;
    }

    const entries = patterns
        .map(entry => parsePatternEntry(entry))
        .filter(Boolean);

    if (!entries.length) {
        notifyInvalidPatterns([], context);
        return null;
    }

    const finalFlags = Array.from(new Set(String(flags || '').split('').filter(Boolean))).join('');
    const validPieces = [];
    const validEntries = [];
    const invalidEntries = [];
    const seen = new Set();

    for (const entry of entries) {
        if (!entry?.body) {
            if (entry?.error instanceof Error) {
                invalidEntries.push(entry);
            }
            continue;
        }
        try {
            new RegExp(entry.body, finalFlags);
            if (!seen.has(entry.body)) {
                validPieces.push(entry.body);
                validEntries.push(entry);
                seen.add(entry.body);
            }
        } catch (error) {
            invalidEntries.push({ ...entry, error });
        }
    }

    if (!validPieces.length) {
        notifyInvalidPatterns(invalidEntries, context);
        return null;
    }

    try {
        const compiled = new RegExp(validPieces.join('|'), finalFlags);
        notifyInvalidPatterns(invalidEntries, context);
        return compiled;
    } catch (compileError) {
        const combined = [
            ...invalidEntries,
            ...validEntries.map(entry => ({ ...entry, error: compileError })),
        ];
        notifyInvalidPatterns(combined, context);
        return null;
    }
}

export function ensureMap(value) {
    if (value instanceof Map) return value;
    if (!value) return new Map();
    try { return new Map(value instanceof Array ? value : Object.entries(value)); }
    catch { return new Map(); }
}

export function rebuildMappingLookup(profile) {
    const map = new Map();
    if (profile && Array.isArray(profile.mappings)) {
        for (const entry of profile.mappings) {
            if (!entry) continue;
            const normalized = normalizeCostumeName(entry.name);
            if (!normalized) continue;
            const folder = String(entry.folder ?? '').trim();
            map.set(normalized.toLowerCase(), folder || normalized);
        }
    }
    state.mappingLookup = map;
    return map;
}

export function recompileRegexes() {
    try {
        const profile = getActiveProfile();
        if (!profile) return;
        const lowerIgnored = (profile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
        const effectivePatterns = (profile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));

        const escapeVerbList = (list, contextLabel) => {
            const seen = new Set();
            const valid = [];
            const invalid = [];
            (list || []).forEach((item) => {
                const parsed = parsePatternEntry(item);
                if (!parsed) return;
                if (!parsed.body) {
                    if (parsed.error instanceof Error) {
                        invalid.push(parsed);
                    }
                    return;
                }
                if (seen.has(parsed.body)) return;
                try {
                    new RegExp(parsed.body, 'iu');
                    seen.add(parsed.body);
                    valid.push(parsed);
                } catch (error) {
                    invalid.push({ ...parsed, error });
                }
            });
            notifyInvalidPatterns(invalid, contextLabel);
            return { pattern: valid.map(entry => entry.body).join('|'), validEntries: valid, invalidEntries: invalid };
        };
        const { pattern: attributionVerbsPattern } = escapeVerbList(profile.attributionVerbs, 'attribution verb');
        const { pattern: actionVerbsPattern, invalidEntries: actionVerbInvalid = [] } = escapeVerbList(profile.actionVerbs, 'action verb');
        const pronounVocabulary = Array.isArray(profile.pronounVocabulary) && profile.pronounVocabulary.length
            ? profile.pronounVocabulary
            : DEFAULT_PRONOUNS;
        const { pattern: pronounPattern, invalidEntries: pronounInvalid = [] } = escapeVerbList(pronounVocabulary, 'pronoun vocabulary');

        const speakerTemplate = '(?:^|[\r\n]+|[>\]]\s*)({{PATTERNS}})\s*:';
        const boundaryLookbehind = "(?<![A-Za-z0-9_'’])";
        const attributionTemplate = attributionVerbsPattern
            ? `${boundaryLookbehind}({{PATTERNS}})\\s+(?:${attributionVerbsPattern})`
            : null;
        const actionTemplate = actionVerbsPattern
            ? `${boundaryLookbehind}({{PATTERNS}})(?:['’]s)?\\s+(?:${UNICODE_WORD_PATTERN}+\\s+){0,3}?(?:${actionVerbsPattern})`
            : null;

        let pronounRegex = null;
        if (actionVerbsPattern && pronounPattern) {
            const pronounBody = `(?:^|[\r\n]+)\s*(?:${pronounPattern})(?:['’]s)?\s+(?:${UNICODE_WORD_PATTERN}+\s+){0,3}?(?:${actionVerbsPattern})`;
            try {
                pronounRegex = new RegExp(pronounBody, 'iu');
                notifyInvalidPatterns([], 'pronoun pattern');
            } catch (error) {
                const combinedInvalid = [
                    ...pronounInvalid,
                    ...actionVerbInvalid,
                    { body: pronounBody, raw: pronounBody, error },
                ];
                notifyInvalidPatterns(combinedInvalid, 'pronoun pattern');
            }
        } else {
            notifyInvalidPatterns([], 'pronoun pattern');
        }

        state.compiledRegexes = {
            speakerRegex: buildRegex(effectivePatterns, speakerTemplate),
            attributionRegex: attributionTemplate ? buildRegex(effectivePatterns, attributionTemplate) : null,
            actionRegex: actionTemplate ? buildRegex(effectivePatterns, actionTemplate, { extraFlags: 'u' }) : null,
            pronounRegex,
            vocativeRegex: buildRegex(effectivePatterns, `["“'\\s]({{PATTERNS}})[,.!?]`),
            possessiveRegex: buildRegex(effectivePatterns, `\\b({{PATTERNS}})['’]s\\b`),
            nameRegex: buildRegex(effectivePatterns, `\\b({{PATTERNS}})\\b`),
            vetoRegex: buildGenericRegex(profile.vetoPatterns),
        };
        rebuildMappingLookup(profile);
        if (invalidPatternCache.size === 0) {
            $("#cs-error").prop('hidden', true).find('.cs-status-text').text('');
        } else {
            updatePatternErrorDisplay();
        }
    } catch (e) {
        $("#cs-error").prop('hidden', false).find('.cs-status-text').text(`Pattern compile error: ${String(e)}`);
        showStatus(`Pattern compile error: ${String(e)}`, 'error', 5000);
    }
}
