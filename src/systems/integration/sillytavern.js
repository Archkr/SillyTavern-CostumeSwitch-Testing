const STREAM_START_KEYS = [
    "GENERATION_STARTED",
    "GENERATION_REQUESTED",
    "STREAM_STARTED",
    "STREAM_START",
    "STREAM_BEGIN",
    "GENERATION_BEGIN",
    { match: /(GENERATION|STREAM).*START/i },
];

const STREAM_TOKEN_KEYS = [
    "STREAM_TOKEN_RECEIVED",
    "STREAM_TOKEN",
    "TOKEN_RECEIVED",
    "GENERATION_TOKEN",
    "GENERATION_OUTPUT_CHUNK",
    "STREAM_OUTPUT",
    { match: /(GENERATION|STREAM).*TOKEN/i, fallback: ["GENERATION_TOKEN", "STREAM_TOKEN_EVENT"] },
    { match: /(GENERATION|STREAM).*(CHUNK|PART|DELTA|UPDATE)/i },
];

const MESSAGE_FINISHED_KEYS = [
    "CHARACTER_MESSAGE_RENDERED",
    "MESSAGE_RENDERED",
    "GENERATION_ENDED",
    "STREAM_ENDED",
    "STREAM_FINISHED",
    "STREAM_COMPLETE",
    "GENERATION_FINISHED",
    "GENERATION_STOPPED",
    "STREAM_STOPPED",
    "GENERATION_COMPLETED",
    "MESSAGE_FINALIZED",
    { match: /(GENERATION|STREAM|MESSAGE).*(END|FINISH|COMPLETE|STOP|FINAL)/i, fallback: ["GENERATION_STOPPED", "STREAM_STOPPED"] },
];

const HISTORY_UPDATE_KEYS = [
    "MESSAGE_SWIPED",
    "MESSAGE_EDITED",
    "MESSAGE_DELETED",
    "MESSAGE_RESTORED",
    "UNDO_BUTTON_CLICKED",
    "UNDO_MESSAGE",
    "UNDO_COMPLETED",
    "MESSAGE_REGENERATED",
    { match: /MESSAGE_(REGEN|REGENERAT|RESTOR|DELETE|UNDO)/i },
];

const CHAT_CHANGED_KEYS = [
    "CHAT_CHANGED",
    "CHAT_LOADED",
    { match: /CHAT_(CHANGED|LOADED|SELECTED)/i },
];

function resolveEventIdentifiers(eventTypes, candidates) {
    const results = new Set();
    const source = typeof eventTypes === "object" && eventTypes !== null ? eventTypes : null;
    const entries = source
        ? Object.entries(source).filter(([key, value]) => typeof value === "string" && value.trim().length)
        : [];

    const addName = (name) => {
        if (typeof name === "string") {
            const trimmed = name.trim();
            if (trimmed) {
                results.add(trimmed);
            }
        }
    };

    const applyFallback = (fallback) => {
        if (!fallback) {
            return;
        }
        if (Array.isArray(fallback)) {
            fallback.forEach(addName);
        } else {
            addName(fallback);
        }
    };

    const matchEntries = (pattern) => {
        if (!entries.length) {
            return false;
        }
        let matched = false;
        entries.forEach(([key, value]) => {
            const keyName = typeof key === "string" ? key : "";
            const resolved = value || keyName;
            if (pattern.test(keyName) || pattern.test(resolved)) {
                addName(resolved);
                matched = true;
            }
        });
        return matched;
    };

    candidates.forEach((candidate) => {
        if (!candidate) {
            return;
        }
        if (typeof candidate === "string") {
            const key = candidate.trim();
            if (!key) {
                return;
            }
            if (source && typeof source[key] === "string" && source[key].trim()) {
                addName(source[key]);
            } else {
                addName(key);
            }
            return;
        }
        if (typeof candidate === "object") {
            const matcher = candidate.match;
            if (matcher) {
                const pattern = matcher instanceof RegExp
                    ? matcher
                    : new RegExp(String(matcher), "i");
                const matched = matchEntries(pattern);
                if (!matched) {
                    applyFallback(candidate.fallback || candidate.names);
                }
                return;
            }
            if (candidate.names || candidate.fallback) {
                applyFallback(candidate.names || candidate.fallback);
            }
        }
    });

    return Array.from(results);
}

function normalizeHandlers(handlers) {
    if (typeof handlers === "function") {
        return [handlers];
    }
    if (Array.isArray(handlers)) {
        return handlers.filter((handler) => typeof handler === "function");
    }
    return [];
}

function registerEventListeners(source, eventTypes, eventNames, handlers, registry) {
    const callbacks = normalizeHandlers(handlers);
    if (!callbacks.length) {
        return;
    }
    const names = resolveEventIdentifiers(eventTypes, eventNames);
    names.forEach((eventName) => {
        const wrapper = (...args) => {
            callbacks.forEach((handler) => {
                try {
                    handler(...args);
                } catch (error) {
                    console.warn("[CostumeSwitch] Integration handler error for", eventName, error);
                }
            });
        };
        source.on(eventName, wrapper);
        if (!registry.has(eventName)) {
            registry.set(eventName, []);
        }
        registry.get(eventName).push(wrapper);
    });
}

export function registerSillyTavernIntegration({
    eventSource = null,
    eventTypes = null,
    onGenerationStarted = null,
    onStreamStarted = null,
    onStreamToken = null,
    onMessageFinished = null,
    onChatChanged = null,
    onHistoryChanged = null,
} = {}) {
    const source = eventSource && typeof eventSource.on === "function" ? eventSource : null;
    const registry = new Map();
    const record = { eventSource: source, handlers: registry };
    if (!source) {
        return record;
    }

    registerEventListeners(source, eventTypes, STREAM_START_KEYS, normalizeHandlers([onGenerationStarted, onStreamStarted]), registry);
    registerEventListeners(source, eventTypes, STREAM_TOKEN_KEYS, onStreamToken, registry);
    registerEventListeners(source, eventTypes, MESSAGE_FINISHED_KEYS, onMessageFinished, registry);
    registerEventListeners(source, eventTypes, CHAT_CHANGED_KEYS, onChatChanged, registry);
    registerEventListeners(source, eventTypes, HISTORY_UPDATE_KEYS, onHistoryChanged, registry);

    return record;
}

export function unregisterSillyTavernIntegration(registered, { eventSource = null } = {}) {
    if (!registered) {
        return;
    }
    const source = registered.eventSource && typeof registered.eventSource.off === "function"
        ? registered.eventSource
        : eventSource;
    if (!source || typeof source.off !== "function") {
        return;
    }
    const handlers = registered.handlers instanceof Map ? registered.handlers : new Map();
    handlers.forEach((wrappers, eventName) => {
        if (!Array.isArray(wrappers)) {
            return;
        }
        wrappers.forEach((wrapper) => {
            if (typeof wrapper === "function") {
                source.off(eventName, wrapper);
            }
        });
    });
    handlers.clear();
}

export const __testing = {
    resolveEventIdentifiers,
};
