export async function resolve(specifier, context, defaultResolve) {
    if (specifier === "../../../extensions.js") {
        return { url: "node:mock/extensions", shortCircuit: true };
    }
    if (specifier === "../../../../script.js") {
        return { url: "node:mock/script", shortCircuit: true };
    }
    if (specifier === "../../../slash-commands.js") {
        return { url: "node:mock/slash", shortCircuit: true };
    }
    return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
    if (url === "node:mock/extensions") {
        return {
            format: "module",
            source: `const store = globalThis.__extensionSettingsStore || (globalThis.__extensionSettingsStore = {});\nexport const extension_settings = store;\nexport function getContext() {\n    return { extensionSettings: store, saveSettingsDebounced: () => {} };\n}`,
            shortCircuit: true,
        };
    }
    if (url === "node:mock/script") {
        return {
            format: "module",
            source: `export const saveSettingsDebounced = () => {};\nexport const event_types = {};\nexport const eventSource = { on: () => {}, off: () => {} };`,
            shortCircuit: true,
        };
    }
    if (url === "node:mock/slash") {
        return {
            format: "module",
            source: `export const executeSlashCommandsOnChatInput = async () => {};\nexport const registerSlashCommand = () => {};`,
            shortCircuit: true,
        };
    }
    return defaultLoad(url, context, defaultLoad);
}
