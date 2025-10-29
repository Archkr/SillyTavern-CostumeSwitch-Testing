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
    const invalidEntries = [];
    const seen = new Set();

    for (const entry of entries) {
        if (!entry.body) continue;
        try {
            new RegExp(entry.body, finalFlags);
            if (!seen.has(entry.body)) {
                validPieces.push(entry.body);
                seen.add(entry.body);
            }
        } catch (error) {
            invalidEntries.push({ ...entry, error });
        }
    }

    notifyInvalidPatterns(invalidEntries, context);

    if (!validPieces.length) {
        return null;
    }

    const body = template.replace('{{PATTERNS}}', `(?:${validPieces.join('|')})`);
    return new RegExp(body, finalFlags);
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
    const invalidEntries = [];
    const seen = new Set();

    for (const entry of entries) {
        if (!entry.body) continue;
        try {
            new RegExp(entry.body, finalFlags);
            if (!seen.has(entry.body)) {
                validPieces.push(entry.body);
                seen.add(entry.body);
            }
        } catch (error) {
            invalidEntries.push({ ...entry, error });
        }
    }

    notifyInvalidPatterns(invalidEntries, context);

    if (!validPieces.length) {
        return null;
    }

    return new RegExp(validPieces.join('|'), finalFlags);
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

        const escapeVerbList = (list) => {
            const seen = new Set();
            return (list || [])
                .map(entry => parsePatternEntry(entry))
                .filter(Boolean)
                .map(entry => entry.body)
                .filter(body => {
                    if (!body || seen.has(body)) return false;
                    seen.add(body);
                    return true;
                })
                .join('|');
        };
        const attributionVerbsPattern = escapeVerbList(profile.attributionVerbs);
        const actionVerbsPattern = escapeVerbList(profile.actionVerbs);
        const pronounVocabulary = Array.isArray(profile.pronounVocabulary) && profile.pronounVocabulary.length
            ? profile.pronounVocabulary
            : DEFAULT_PRONOUNS;
        const pronounPattern = escapeVerbList(pronounVocabulary);

        const speakerTemplate = '(?:^|[\r\n]+|[>\]]\s*)({{PATTERNS}})\s*:';
        const boundaryLookbehind = "(?<![A-Za-z0-9_'’])";
        const attributionTemplate = attributionVerbsPattern
            ? `${boundaryLookbehind}({{PATTERNS}})\\s+(?:${attributionVerbsPattern})`
            : null;
        const actionTemplate = actionVerbsPattern
            ? `${boundaryLookbehind}({{PATTERNS}})(?:['’]s)?\\s+(?:${UNICODE_WORD_PATTERN}+\\s+){0,3}?(?:${actionVerbsPattern})`
            : null;

        state.compiledRegexes = {
            speakerRegex: buildRegex(effectivePatterns, speakerTemplate),
            attributionRegex: attributionTemplate ? buildRegex(effectivePatterns, attributionTemplate) : null,
            actionRegex: actionTemplate ? buildRegex(effectivePatterns, actionTemplate, { extraFlags: 'u' }) : null,
            pronounRegex: (actionVerbsPattern && pronounPattern)
                ? new RegExp(`(?:^|[\r\n]+)\s*(?:${pronounPattern})(?:['’]s)?\s+(?:${UNICODE_WORD_PATTERN}+\\s+){0,3}?(?:${actionVerbsPattern})`, 'iu')
                : null,
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
