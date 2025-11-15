import Fuse from "../vendor/fuse.mjs";
import { sampleClassifyText } from "./sample-text.js";

function toTrimmedString(value) {
    if (value == null) {
        return "";
    }
    return String(value).trim();
}

export function stripDiacritics(value) {
    if (typeof value !== "string") {
        return "";
    }
    return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

export function hasDiacritics(value) {
    if (typeof value !== "string") {
        return false;
    }
    return stripDiacritics(value) !== value;
}

const DEFAULT_TOLERANCE = Object.freeze({
    enabled: false,
    accentSensitive: true,
    lowConfidenceThreshold: null,
    maxScore: 0.35,
});

function normalizeBoolean(value, fallback = false) {
    if (value === null || value === undefined) {
        return fallback;
    }
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "yes" || normalized === "on") {
            return true;
        }
        if (normalized === "false" || normalized === "no" || normalized === "off") {
            return false;
        }
    }
    return fallback;
}

function parseNumeric(value, fallback = null) {
    const number = Number(value);
    if (Number.isFinite(number)) {
        return number;
    }
    return fallback;
}

export function resolveFuzzyTolerance(value) {
    if (value == null || value === false) {
        return { ...DEFAULT_TOLERANCE };
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return {
            enabled: true,
            accentSensitive: true,
            lowConfidenceThreshold: Math.max(0, Math.floor(value)),
            maxScore: DEFAULT_TOLERANCE.maxScore,
        };
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        switch (normalized) {
            case "off":
            case "disabled":
                return { ...DEFAULT_TOLERANCE };
            case "always":
            case "on":
                return {
                    enabled: true,
                    accentSensitive: false,
                    lowConfidenceThreshold: null,
                    maxScore: 0.45,
                };
            case "accent":
            case "accented":
                return {
                    enabled: true,
                    accentSensitive: true,
                    lowConfidenceThreshold: null,
                    maxScore: DEFAULT_TOLERANCE.maxScore,
                };
            case "low":
            case "low-confidence":
            case "lowconfidence":
                return {
                    enabled: true,
                    accentSensitive: false,
                    lowConfidenceThreshold: 2,
                    maxScore: DEFAULT_TOLERANCE.maxScore,
                };
            case "auto":
            default:
                return {
                    enabled: true,
                    accentSensitive: true,
                    lowConfidenceThreshold: 2,
                    maxScore: DEFAULT_TOLERANCE.maxScore,
                };
        }
    }
    if (typeof value === "object") {
        const enabled = normalizeBoolean(value.enabled, true);
        if (!enabled) {
            return { ...DEFAULT_TOLERANCE };
        }
        const accentSensitive = normalizeBoolean(value.accentSensitive, true);
        const threshold = value.lowConfidenceThreshold ?? value.threshold;
        const lowConfidenceThreshold = parseNumeric(threshold, DEFAULT_TOLERANCE.lowConfidenceThreshold);
        const maxScore = parseNumeric(value.maxScore, DEFAULT_TOLERANCE.maxScore) ?? DEFAULT_TOLERANCE.maxScore;
        return {
            enabled: true,
            accentSensitive,
            lowConfidenceThreshold: lowConfidenceThreshold == null
                ? DEFAULT_TOLERANCE.lowConfidenceThreshold
                : Math.max(0, Math.floor(lowConfidenceThreshold)),
            maxScore: Math.max(0, Math.min(1, maxScore)),
        };
    }
    return { ...DEFAULT_TOLERANCE };
}

function shouldApplyFuzzy(tolerance, { priority = null, hasAccents = false } = {}) {
    if (!tolerance || !tolerance.enabled) {
        return false;
    }
    const lowConfidence = tolerance.lowConfidenceThreshold != null
        && Number.isFinite(priority)
        && priority <= tolerance.lowConfidenceThreshold;
    const accentTrigger = tolerance.accentSensitive && hasAccents;
    if (tolerance.lowConfidenceThreshold == null && !tolerance.accentSensitive) {
        return true;
    }
    return lowConfidence || accentTrigger;
}

function buildCandidateMaps(candidates) {
    const direct = new Map();
    const accentless = new Map();
    candidates.forEach((candidate) => {
        const trimmed = toTrimmedString(candidate);
        if (!trimmed) {
            return;
        }
        const lowered = trimmed.toLowerCase();
        if (!direct.has(lowered)) {
            direct.set(lowered, trimmed);
        }
        const accentKey = stripDiacritics(trimmed).toLowerCase();
        if (accentKey && !accentless.has(accentKey)) {
            accentless.set(accentKey, trimmed);
        }
    });
    return { direct, accentless };
}

export function createNamePreprocessor({
    candidates = [],
    tolerance = DEFAULT_TOLERANCE,
    translate = false,
    sample = sampleClassifyText,
    fuseOptions = {},
    aliasMap = null,
} = {}) {
    const uniqueCandidates = Array.from(new Set(candidates.map(toTrimmedString).filter(Boolean)));
    const fuse = uniqueCandidates.length && tolerance.enabled
        ? new Fuse(uniqueCandidates, {
            includeScore: true,
            threshold: 0.45,
            ignoreLocation: true,
            ignoreFieldNorm: true,
            ...fuseOptions,
        })
        : null;
    const maps = buildCandidateMaps(uniqueCandidates);
    const aliasLookup = aliasMap instanceof Map
        ? aliasMap
        : aliasMap && typeof aliasMap === "object"
            ? new Map(Object.entries(aliasMap).map(([key, value]) => [String(key ?? "").toLowerCase(), String(value ?? "")]))
            : new Map();

    return function preprocess(rawName, meta = {}) {
        const raw = toTrimmedString(rawName);
        if (!raw) {
            return {
                raw: "",
                normalized: "",
                canonical: "",
                method: "empty",
                score: null,
                applied: false,
                changed: false,
            };
        }

        const sampled = sample(raw) || raw;
        const sampledTrimmed = toTrimmedString(sampled);
        const normalized = translate ? stripDiacritics(sampledTrimmed) : sampledTrimmed;
        const lowered = normalized.toLowerCase();
        let canonical = maps.direct.get(lowered) || aliasLookup.get(lowered) || null;
        let method = canonical ? "direct" : "raw";
        let score = null;
        let applied = false;

        if (!canonical) {
            const accentKey = stripDiacritics(normalized).toLowerCase();
            canonical = maps.accentless.get(accentKey) || aliasLookup.get(accentKey) || null;
            if (canonical) {
                method = "accent-fold";
            }
        }

        if (!canonical && shouldApplyFuzzy(tolerance, {
            priority: meta.priority,
            hasAccents: hasDiacritics(sampledTrimmed),
        })) {
            applied = true;
            if (fuse) {
                const query = translate ? normalized : stripDiacritics(sampledTrimmed);
                const results = fuse.search(query);
                if (Array.isArray(results) && results.length) {
                    const top = results[0];
                    if (top?.item && (top.score == null || top.score <= tolerance.maxScore)) {
                        canonical = top.item;
                        method = "fuzzy";
                        score = typeof top.score === "number" ? top.score : null;
                    }
                }
            }
        }

        if (!canonical) {
            canonical = normalized;
        }

        const changed = canonical.toLowerCase() !== raw.toLowerCase();

        return {
            raw,
            normalized,
            canonical,
            method,
            score,
            applied,
            changed,
        };
    };
}
