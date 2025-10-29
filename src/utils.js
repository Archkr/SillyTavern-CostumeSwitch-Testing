import { logPrefix, PROFILE_DEFAULTS } from "./constants.js";
import { getActiveProfile } from "./settings.js";

export function escapeHtml(str) {
    const p = document.createElement("p");
    p.textContent = str;
    return p.innerHTML;
}

export function normalizeStreamText(s) {
    return s
        ? String(s)
            .replace(/[\uFEFF\u200B\u200C\u200D]/g, "")
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
            .replace(/(\*\*|__|~~|`{1,3})/g, "")
            .replace(/\u00A0/g, " ")
        : "";
}

export function normalizeCostumeName(n) {
    if (!n) return "";
    let s = String(n).trim();
    if (s.startsWith("/") || s.startsWith("\\")) {
        s = s.slice(1).trim();
    }
    const segments = s.split(/[\\/]+/).filter(Boolean);
    const base = segments.length ? segments[segments.length - 1] : s;
    return String(base).replace(/[-_](?:sama|san)$/i, "").trim();
}

export function debugLog(...args) {
    try {
        if (getActiveProfile()?.debug) console.debug(logPrefix, ...args);
    } catch (e) {
        /* noop */
    }
}

export function resolveNumericSetting(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

export function resolveMaxBufferChars(profile) {
    const raw = Number(profile?.maxBufferChars);
    if (Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return PROFILE_DEFAULTS.maxBufferChars;
}

export function buildLowercaseSet(values) {
    if (!values) return null;
    const iterable = values instanceof Set ? values : new Set(values);
    const lower = new Set();
    for (const value of iterable) {
        const normalized = String(value ?? '').trim().toLowerCase();
        if (normalized) {
            lower.add(normalized);
        }
    }
    return lower.size ? lower : null;
}

export function normalizeVerbCandidate(word) {
    let base = String(word || '').toLowerCase();
    base = base.replace(/['’]s$/u, '');
    if (base.endsWith('ing') && base.length > 4) {
        base = base.slice(0, -3);
    } else if (base.endsWith('ies') && base.length > 4) {
        base = `${base.slice(0, -3)}y`;
    } else if (base.endsWith('ed') && base.length > 3) {
        base = base.slice(0, -2);
    } else if (base.endsWith('es') && base.length > 3) {
        base = base.slice(0, -2);
    } else if (base.endsWith('s') && base.length > 3) {
        base = base.slice(0, -1);
    }
    return base;
}

export function mergeUniqueList(target = [], additions = []) {
    const list = Array.isArray(target) ? [...target] : [];
    const seen = new Set(list.map(item => String(item).toLowerCase()));
    (additions || []).forEach((item) => {
        const value = String(item || '').trim();
        if (!value) return;
        const lower = value.toLowerCase();
        if (!seen.has(lower)) {
            list.push(value);
            seen.add(lower);
        }
    });
    return list;
}
