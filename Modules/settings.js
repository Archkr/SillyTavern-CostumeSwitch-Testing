import { DEFAULTS, PROFILE_DEFAULTS } from './constants.js';
import { SCRIPT_CONTEXT, logPrefix } from '../index.js';

export let settings = {};

/**
 * Gets the currently active profile object.
 * @returns {object|null} The active profile object or null if not found.
 */
export function getActiveProfile() {
    return settings?.profiles?.[settings.activeProfile];
}

/**
 * Initializes the settings object from the extension settings, migrating old formats if necessary.
 */
export function loadSettings() {
    const ctx = SCRIPT_CONTEXT.getContext();
    let storeSource = (ctx && ctx.extensionSettings) ? ctx.extensionSettings : (typeof extension_settings !== 'undefined' ? extension_settings : {});
    const extensionName = "SillyTavern-CostumeSwitch-Testing";

    // Migrate from pre-profile structure if needed
    if (!storeSource[extensionName] || !storeSource[extensionName].profiles) {
        console.log(`${logPrefix} Migrating old settings to new profile format.`);
        const oldSettings = storeSource[extensionName] || {};
        const newSettings = structuredClone(DEFAULTS);
        Object.keys(PROFILE_DEFAULTS).forEach(key => {
            if (oldSettings.hasOwnProperty(key)) {
                newSettings.profiles.Default[key] = oldSettings[key];
            }
        });
        if (oldSettings.hasOwnProperty('enabled')) {
            newSettings.enabled = oldSettings.enabled;
        }
        storeSource[extensionName] = newSettings;
    }
    
    // Ensure all defaults are present
    settings = Object.assign({}, structuredClone(DEFAULTS), storeSource[extensionName]);
    for (const profileName in settings.profiles) {
        settings.profiles[profileName] = Object.assign({}, structuredClone(PROFILE_DEFAULTS), settings.profiles[profileName]);
    }

    // Persist any changes made during migration/defaulting
    storeSource[extensionName] = settings;
}

/**
 * Saves the current settings state.
 */
export function saveSettings() {
    if (SCRIPT_CONTEXT.saveSettingsDebounced) {
        SCRIPT_CONTEXT.saveSettingsDebounced();
    }
}

/**
 * Finds a mapped costume folder for a given character name.
 * @param {string} name - The character name to look up.
 * @returns {string|null} The mapped costume folder or null.
 */
export function getMappedCostume(name) {
    const profile = getActiveProfile();
    if (!name || !profile?.mappings?.length) return null;
    const lowerName = name.toLowerCase();
    for (const m of (profile.mappings || [])) {
        if (m?.name?.toLowerCase() === lowerName) {
            return m.folder?.trim() || null;
        }
    }
    return null;
}
