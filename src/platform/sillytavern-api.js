import * as extensionsModule from "/scripts/extensions.js";
import * as scriptModule from "/scripts/script.js";
import * as slashModule from "/scripts/slash-commands.js";

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
const fallbackExecuteSlashCommandsOnChatInput = async () => false;
const fallbackWriteExtensionField = async () => {};
const fallbackRenderExtensionTemplateAsync = async () => "<div id=\"cs-scene-panel\"></div>";

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

const fallbackEventSource = createEventSourceFallback();
const fallbackEventTypes = {};
const fallbackSystemMessageTypes = { NARRATOR: "narrator" };

export let extension_settings = extensionSettingsStore;
export let saveSettingsDebounced = noop;
export let saveChatDebounced = noop;
export let executeSlashCommandsOnChatInput = fallbackExecuteSlashCommandsOnChatInput;
export let registerSlashCommand = noop;
export let substituteParams = fallbackSubstituteParams;
export let substituteParamsExtended = fallbackSubstituteParamsExtended;
export let writeExtensionField = fallbackWriteExtensionField;
export let event_types = fallbackEventTypes;
export let eventSource = fallbackEventSource;
export let system_message_types = fallbackSystemMessageTypes;
let getContextImpl = defaultGetContext;
export let renderExtensionTemplateAsync = fallbackRenderExtensionTemplateAsync;

function toArray(value) {
    return Array.isArray(value) ? value : [value];
}

function isFunction(value) {
    return typeof value === "function";
}

function isObject(value) {
    return value && typeof value === "object";
}

function pickFromSources({ sources, names, predicate, fallback, warnName, bindHost = true, warnOnFallback = true }) {
    const nameList = toArray(names);
    const displayName = warnName ?? nameList[0];
    for (const source of sources) {
        if (!source) {
            continue;
        }
        for (const name of nameList) {
            const candidate = source[name];
            if (predicate(candidate)) {
                if (bindHost && source === host && typeof candidate === "function") {
                    return candidate.bind(host);
                }
                return candidate;
            }
        }
    }
    if (warnOnFallback && displayName) {
        warnOnce(displayName);
    }
    return fallback;
}

function defaultGetContext() {
    if (typeof host.getContext === "function") {
        try {
            return host.getContext();
        } catch (error) {
            warnOnce(`getContext (threw: ${error?.message ?? error})`);
        }
    }

    const baseContext = {
        extensionSettings: extension_settings ?? extensionSettingsStore,
        saveSettingsDebounced,
        saveChatDebounced,
    };

    const extra = host.__mockContext;
    if (extra && typeof extra === "object") {
        return { ...baseContext, ...extra };
    }

    return baseContext;
}

function assignBindingsFromSources(sources) {
    extension_settings = pickFromSources({
        sources,
        names: ["extension_settings", "extensionSettings"],
        predicate: isObject,
        fallback: extensionSettingsStore,
        bindHost: false,
        warnOnFallback: false,
    });

    saveSettingsDebounced = pickFromSources({
        sources,
        names: "saveSettingsDebounced",
        predicate: isFunction,
        fallback: noop,
    });

    saveChatDebounced = pickFromSources({
        sources,
        names: "saveChatDebounced",
        predicate: isFunction,
        fallback: noop,
    });

    executeSlashCommandsOnChatInput = pickFromSources({
        sources,
        names: "executeSlashCommandsOnChatInput",
        predicate: isFunction,
        fallback: fallbackExecuteSlashCommandsOnChatInput,
    });

    registerSlashCommand = pickFromSources({
        sources,
        names: "registerSlashCommand",
        predicate: isFunction,
        fallback: noop,
    });

    substituteParams = pickFromSources({
        sources,
        names: "substituteParams",
        predicate: isFunction,
        fallback: fallbackSubstituteParams,
    });

    substituteParamsExtended = pickFromSources({
        sources,
        names: "substituteParamsExtended",
        predicate: isFunction,
        fallback: fallbackSubstituteParamsExtended,
    });

    writeExtensionField = pickFromSources({
        sources,
        names: "writeExtensionField",
        predicate: isFunction,
        fallback: fallbackWriteExtensionField,
    });

    event_types = pickFromSources({
        sources,
        names: "event_types",
        predicate: isObject,
        fallback: fallbackEventTypes,
        bindHost: false,
    });

    eventSource = pickFromSources({
        sources,
        names: "eventSource",
        predicate: isObject,
        fallback: fallbackEventSource,
        bindHost: false,
    });

    system_message_types = pickFromSources({
        sources,
        names: "system_message_types",
        predicate: isObject,
        fallback: fallbackSystemMessageTypes,
        bindHost: false,
    });

    getContextImpl = pickFromSources({
        sources,
        names: "getContext",
        predicate: isFunction,
        fallback: defaultGetContext,
    });

    renderExtensionTemplateAsync = pickFromSources({
        sources,
        names: "renderExtensionTemplateAsync",
        predicate: isFunction,
        fallback: fallbackRenderExtensionTemplateAsync,
    });
}

const moduleSources = [extensionsModule, scriptModule, slashModule, host];
assignBindingsFromSources(moduleSources);

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
    return getContextImpl();
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
