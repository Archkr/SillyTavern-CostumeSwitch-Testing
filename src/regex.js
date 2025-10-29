import {
    DEFAULT_PRONOUNS,
    PROFILE_DEFAULTS,
    UNICODE_WORD_PATTERN,
} from "./constants.js";
import { state } from "./state.js";
import { getActiveProfile } from "./settings.js";
import { normalizeCostumeName } from "./utils.js";
import { showStatus } from "./status.js";

export function parsePatternEntry(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (!trimmed) return null;
        const body = trimmed
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\s+/g, '\\s+');
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

export function buildRegex(patterns, template, { flags = 'iu', extraFlags = '' } = {}) {
    if (!Array.isArray(patterns) || patterns.length === 0) return null;
    const pieces = patterns
        .map(entry => parsePatternEntry(entry))
        .filter(Boolean)
        .map(entry => entry.body)
        .filter(Boolean);

    if (!pieces.length) return null;
    const body = template.replace('{{PATTERNS}}', `(?:${pieces.join('|')})`);
    const finalFlags = Array.from(new Set(`${flags}${extraFlags}`.split(''))).join('');
    return new RegExp(body, finalFlags);
}

export function buildGenericRegex(patterns, { flags = 'iu' } = {}) {
    if (!Array.isArray(patterns) || patterns.length === 0) return null;
    const pieces = patterns
        .map(entry => parsePatternEntry(entry))
        .filter(Boolean)
        .map(entry => entry.body)
        .filter(Boolean);
    if (!pieces.length) return null;
    return new RegExp(pieces.join('|'), flags);
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
        $("#cs-error").prop('hidden', true).find('.cs-status-text').text('');
    } catch (e) {
        $("#cs-error").prop('hidden', false).find('.cs-status-text').text(`Pattern compile error: ${String(e)}`);
        showStatus(`Pattern compile error: ${String(e)}`, 'error', 5000);
    }
}
