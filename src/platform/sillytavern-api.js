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

let bindingsLoaded = false;
let loadPromise = null;

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

function snapshotBindings() {
    return {
        extension_settings,
        saveSettingsDebounced,
        saveChatDebounced,
        executeSlashCommandsOnChatInput,
        registerSlashCommand,
        substituteParams,
        substituteParamsExtended,
        writeExtensionField,
        event_types,
        eventSource,
        system_message_types,
        getContext,
        renderExtensionTemplateAsync,
    };
}

function isModuleNotFoundError(error) {
    if (!error) {
        return false;
    }
    const code = error.code || error?.cause?.code;
    if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") {
        return true;
    }
    const message = typeof error.message === "string" ? error.message : "";
    return message.includes("Cannot find module") || message.includes("Failed to fetch dynamically imported module");
}

async function importHostModule(specifier, label) {
    try {
        return await import(specifier);
    } catch (error) {
        if (!isModuleNotFoundError(error)) {
            console.warn(`[CostumeSwitch] Failed to load SillyTavern ${label} module '${specifier}'.`, error);
        }
        return null;
    }
}

async function loadHostBindings() {
    const sources = [];
    const extensionModule = await importHostModule("../../../../extensions.js", "extensions");
    if (extensionModule) {
        sources.push(extensionModule);
    }
    const scriptModule = await importHostModule("../../../../script.js", "core script");
    if (scriptModule) {
        sources.push(scriptModule);
    }
    const slashModule = await importHostModule("../../../../slash-commands.js", "slash commands");
    if (slashModule) {
        sources.push(slashModule);
    }
    sources.push(host);
    assignBindingsFromSources(sources);
    bindingsLoaded = true;
    return snapshotBindings();
}

export async function ensureSillyTavernModuleBindings() {
    if (bindingsLoaded) {
        return snapshotBindings();
    }
    if (!loadPromise) {
        loadPromise = loadHostBindings().catch((error) => {
            loadPromise = null;
            throw error;
        });
    }
    return loadPromise;
}

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
