import { extension_settings } from "./dependencies.js";
import { extensionName } from "./constants.js";

export function getSettings() {
    return extension_settings[extensionName];
}

export function setSettings(settings) {
    extension_settings[extensionName] = settings;
}

export function getActiveProfile() {
    const settings = getSettings();
    return settings?.profiles?.[settings.activeProfile];
}
