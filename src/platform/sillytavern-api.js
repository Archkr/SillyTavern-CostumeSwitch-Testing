const host = typeof globalThis !== "undefined" ? globalThis : {};

const missingWarnings = host.__costumeSwitchMissingWarnings || (host.__costumeSwitchMissingWarnings = new Set());

function warnOnce(name) {
    if (missingWarnings.has(name)) {
        return;
    }
    missingWarnings.add(name);
    if (typeof host.console?.warn === "function") {
        host.console.warn(`[CostumeSwitch] Host API '${name}' is unavailable; falling back to a stub.`);
    }
}

function createHostFunction(name, fallback) {
    return function hostFunctionBridge(...args) {
        const handler = typeof host[name] === "function" ? host[name] : null;
        if (handler) {
            return handler.apply(host, args);
        }
        warnOnce(name);
        return fallback.apply(host, args);
    };
}

function createHostObject(name, fallback) {
    const fallbackValue = typeof fallback === "function" ? fallback() : fallback;

    const resolveSource = () => {
        const value = host[name];
        if (value && typeof value === "object") {
            return value;
        }
        warnOnce(name);
        return fallbackValue;
    };

    return new Proxy(fallbackValue, {
        get(_target, property, receiver) {
            const source = resolveSource();
            const result = Reflect.get(source, property, receiver);
            if (typeof result === "function") {
                return result.bind(source);
            }
            return result;
        },
        set(_target, property, value, receiver) {
            const source = resolveSource();
            return Reflect.set(source, property, value, receiver);
        },
        has(_target, property) {
            const source = resolveSource();
            return Reflect.has(source, property);
        },
        ownKeys() {
            const source = resolveSource();
            return Reflect.ownKeys(source);
        },
        getOwnPropertyDescriptor(_target, property) {
            const source = resolveSource();
            const descriptor = Object.getOwnPropertyDescriptor(source, property);
            if (!descriptor) {
                return undefined;
            }
            return { ...descriptor, configurable: true };
        },
    });
}

function createEventSourceFallback() {
    const noop = () => {};
    return {
        on: noop,
        off: noop,
        once: noop,
        emit: noop,
    };
}

const noop = () => {};

function normalizeText(value) {
    if (value == null) {
        return "";
    }
    return typeof value === "string" ? value : String(value);
}

const fallbackSubstituteParams = (value) => normalizeText(value);

const fallbackSubstituteParamsExtended = (value, _options, transform) => {
    const result = normalizeText(value);
    if (typeof transform === "function") {
        try {
            return transform(result);
        } catch {
            return result;
        }
    }
    return result;
};

const extensionSettingsStore = (() => {
    if (host.extension_settings && typeof host.extension_settings === "object") {
        return host.extension_settings;
    }
    if (host.extensionSettings && typeof host.extensionSettings === "object") {
        return host.extensionSettings;
    }
    const shared = host.__extensionSettingsStore || (host.__extensionSettingsStore = {});
    return shared;
})();

export const extension_settings = extensionSettingsStore;

export const saveSettingsDebounced = createHostFunction("saveSettingsDebounced", noop);
export const saveChatDebounced = createHostFunction("saveChatDebounced", noop);
export const executeSlashCommandsOnChatInput = createHostFunction("executeSlashCommandsOnChatInput", async () => false);
export const registerSlashCommand = createHostFunction("registerSlashCommand", noop);
export const substituteParams = createHostFunction("substituteParams", fallbackSubstituteParams);
export const substituteParamsExtended = createHostFunction("substituteParamsExtended", fallbackSubstituteParamsExtended);
export const writeExtensionField = createHostFunction("writeExtensionField", async () => {});

export const event_types = createHostObject("event_types", {});
export const eventSource = createHostObject("eventSource", createEventSourceFallback);
export const system_message_types = createHostObject("system_message_types", { NARRATOR: "narrator" });

export function getCharacters() {
    const characters = host.characters;
    if (characters && typeof characters === "object") {
        return characters;
    }
    warnOnce("characters");
    return {};
}

export function getCurrentCharacterId() {
    if (typeof host.this_chid === "number" || typeof host.this_chid === "string") {
        return host.this_chid;
    }
    if (typeof host.getCurrentChatId === "function") {
        try {
            return host.getCurrentChatId();
        } catch (error) {
            warnOnce(`getCurrentChatId (threw: ${error?.message ?? error})`);
        }
    }
    warnOnce("this_chid");
    return null;
}

function resolvePresetManager() {
    if (typeof host.getPresetManager === "function") {
        try {
            const manager = host.getPresetManager();
            if (manager && typeof manager === "object") {
                return manager;
            }
        } catch (error) {
            warnOnce(`getPresetManager (threw: ${error?.message ?? error})`);
            return null;
        }
    }
    const manager = host.presetManager;
    if (manager && typeof manager === "object") {
        return manager;
    }
    warnOnce("getPresetManager");
    return null;
}

export function getPresetManager() {
    return resolvePresetManager();
}

export function getContext() {
    if (typeof host.getContext === "function") {
        try {
            return host.getContext();
        } catch (error) {
            warnOnce(`getContext (threw: ${error?.message ?? error})`);
        }
    }

    const baseContext = {
        extensionSettings: extensionSettingsStore,
        saveSettingsDebounced,
        saveChatDebounced,
    };

    const extra = host.__mockContext;
    if (extra && typeof extra === "object") {
        return { ...baseContext, ...extra };
    }

    return baseContext;
}

export function regexFromString(value) {
    if (value instanceof RegExp) {
        return value;
    }
    const input = typeof value === "string" ? value.trim() : "";
    if (!input) {
        return null;
    }
    if (input.startsWith("/") && input.lastIndexOf("/") > 0) {
        const lastSlash = input.lastIndexOf("/");
        const body = input.slice(1, lastSlash);
        const flags = input.slice(lastSlash + 1);
        try {
            return new RegExp(body, flags);
        } catch {
            return null;
        }
    }
    try {
        return new RegExp(input, "g");
    } catch {
        return null;
    }
}

export const renderExtensionTemplateAsync = createHostFunction(
    "renderExtensionTemplateAsync",
    async () => "<div id=\"cs-scene-panel\"></div>"
);
