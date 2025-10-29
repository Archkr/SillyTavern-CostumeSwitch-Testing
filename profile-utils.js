function safeClone(value) {
    if (value === undefined) {
        return undefined;
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (err) {
            // Fall back to manual cloning below
        }
    }

    try {
        const json = JSON.stringify(value);
        return json === undefined ? undefined : JSON.parse(json);
    } catch (err) {
        if (Array.isArray(value)) {
            return value.map((item) => safeClone(item));
        }
        if (value && typeof value === 'object') {
            return Object.keys(value).reduce((acc, key) => {
                acc[key] = safeClone(value[key]);
                return acc;
            }, {});
        }
        return value;
    }
}

function cloneOutfits(outfits) {
    if (!Array.isArray(outfits)) {
        return [];
    }

    const result = [];
    outfits.forEach((item) => {
        if (item == null) {
            return;
        }
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed) {
                result.push(trimmed);
            }
            return;
        }
        if (typeof item === 'object') {
            const cloned = safeClone(item);
            if (cloned && typeof cloned === 'object') {
                result.push(cloned);
            }
        }
    });
    return result;
}

export function normalizeMappingEntry(entry = {}) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const cloned = safeClone(source) || {};
    const name = typeof cloned.name === 'string' ? cloned.name.trim() : '';

    let defaultFolder = typeof cloned.defaultFolder === 'string' ? cloned.defaultFolder.trim() : '';
    if (!defaultFolder && typeof cloned.folder === 'string') {
        defaultFolder = cloned.folder.trim();
    }
    const outfits = cloneOutfits(cloned.outfits);

    const normalized = {
        ...cloned,
        name,
        defaultFolder,
        outfits,
    };

    if (defaultFolder) {
        normalized.folder = defaultFolder;
    } else if (typeof normalized.folder === 'string') {
        normalized.folder = normalized.folder.trim();
        if (!normalized.defaultFolder && normalized.folder) {
            normalized.defaultFolder = normalized.folder;
        }
    }

    return normalized;
}

export function normalizeProfile(profile = {}, defaults = {}) {
    const base = defaults && typeof defaults === 'object' ? (safeClone(defaults) || {}) : {};
    const source = profile && typeof profile === 'object' ? (safeClone(profile) || {}) : {};
    const merged = Object.assign(base, source);

    if (Array.isArray(source.mappings)) {
        merged.mappings = source.mappings.map((mapping) => normalizeMappingEntry(mapping));
    } else {
        merged.mappings = [];
    }

    return merged;
}

export function loadProfiles(rawProfiles = {}, defaults = {}) {
    const normalized = {};
    if (!rawProfiles || typeof rawProfiles !== 'object') {
        return normalized;
    }

    for (const [name, profile] of Object.entries(rawProfiles)) {
        normalized[name] = normalizeProfile(profile, defaults);
    }

    return normalized;
}
