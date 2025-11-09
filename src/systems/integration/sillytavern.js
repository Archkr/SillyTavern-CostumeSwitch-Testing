const STREAM_START_KEYS = [
    "GENERATION_STARTED",
    "GENERATION_REQUESTED",
    "STREAM_STARTED",
    "STREAM_START",
];

const STREAM_TOKEN_KEYS = [
    "STREAM_TOKEN_RECEIVED",
    "STREAM_TOKEN",
    "TOKEN_RECEIVED",
];

const MESSAGE_FINISHED_KEYS = [
    "CHARACTER_MESSAGE_RENDERED",
    "MESSAGE_RENDERED",
    "GENERATION_ENDED",
    "STREAM_ENDED",
    "STREAM_FINISHED",
    "STREAM_COMPLETE",
];

const HISTORY_UPDATE_KEYS = [
    "MESSAGE_SWIPED",
    "MESSAGE_EDITED",
    "MESSAGE_DELETED",
    "MESSAGE_RESTORED",
    "UNDO_BUTTON_CLICKED",
    "UNDO_MESSAGE",
    "UNDO_COMPLETED",
];

const CHAT_CHANGED_KEYS = [
    "CHAT_CHANGED",
];

function resolveEventIdentifiers(eventTypes, candidates) {
    const results = new Set();
    const source = typeof eventTypes === "object" && eventTypes !== null ? eventTypes : null;
    candidates.forEach((candidate) => {
        if (typeof candidate !== "string" || !candidate.trim()) {
            return;
        }
        if (source && typeof source[candidate] === "string" && source[candidate].trim()) {
            results.add(source[candidate]);
        } else {
            results.add(candidate);
        }
    });
    return Array.from(results).filter((name) => typeof name === "string" && name.trim().length);
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
