import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, event_types, eventSource, callPopup } from "../../../../script.js";
import { executeSlashCommandsOnChatInput, registerSlashCommand } from "../../../slash-commands.js";

import { DEFAULTS, PROFILE_DEFAULTS } from './modules/constants.js';
import { state, perMessageBuffers, perMessageStates, resetGlobalState, ensureBufferLimit, handleGenerationStart, cleanupMessageState } from './modules/state.js';
import { settings, getActiveProfile, loadSettings, getMappedCostume } from './modules/settings.js';
import { compiledRegexes, recompileRegexes, findBestMatch, normalizeStreamText } from './modules/detection.js';
import { wireUI, loadProfileUI, populateProfileDropdown, updateFocusLockUI } from './modules/ui.js';
import { registerCommands } from './modules/slashCommands.js';

const extensionName = "SillyTavern-CostumeSwitch-Testing";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
export const logPrefix = "[CostumeSwitch 2.0]";

// To be accessible by other modules
export let SCRIPT_CONTEXT = {};

// --- MAIN SCRIPT LOGIC ---
jQuery(async () => {
    // Make context available globally within the module scope
    SCRIPT_CONTEXT.getContext = typeof getContext === 'function' ? getContext : () => (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null);
    SCRIPT_CONTEXT.saveSettingsDebounced = typeof saveSettingsDebounced !== 'undefined' ? saveSettingsDebounced : () => {};
    SCRIPT_CONTEXT.callPopup = typeof callPopup !== 'undefined' ? callPopup : (msg) => console.log(msg);
    SCRIPT_CONTEXT.executeSlashCommandsOnChatInput = executeSlashCommandsOnChatInput;

    $('head').append(`<link rel="stylesheet" type="text/css" href="${extensionFolderPath}/style.css">`);

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHtml);
    } catch (e) {
        console.warn(`${logPrefix} Failed to load settings.html:`, e);
    }

    loadSettings();
    recompileRegexes();

    // Initial UI setup
    $("#cs-enable").prop("checked", !!settings.enabled);
    populateProfileDropdown();
    loadProfileUI(settings.activeProfile);
    wireUI();
    registerCommands();

    load(); // Attach event listeners
    
    // Make unload function available for extension management
    window[`__${extensionName}_unload`] = unload;

    console.log(`${logPrefix} v2.0.0 loaded successfully.`);
});


/**
 * Issues a costume switch command for a given character name.
 * Handles all cooldowns, mappings, and state updates.
 * @param {string} name - The detected character name.
 * @param {object} opts - Options { matchKind, isLock, isPronoun }
 */
export async function issueCostumeForName(name, opts = {}) {
    const profile = getActiveProfile();
    if (!name || !profile) return;
    const now = Date.now();
    
    // Normalize and map the name to a costume folder
    const cleanName = normalizeStreamText(name, { isCostumeName: true });
    let argFolder = getMappedCostume(cleanName) || cleanName;

    const currentCostume = normalizeStreamText(state.lastIssuedCostume || profile.defaultCostume || (SCRIPT_CONTEXT.getContext()?.characters?.[SCRIPT_CONTEXT.getContext().characterId]?.name) || '', { isCostumeName: true });
    
    // --- Pre-switch checks ---
    if (!opts.isLock && currentCostume?.toLowerCase() === argFolder.toLowerCase()) {
        console.debug(`${logPrefix} Already using costume for "${argFolder}" - skipping.`);
        return;
    }
    if (!opts.isLock && now - state.lastSwitchTimestamp < (profile.globalCooldownMs ?? PROFILE_DEFAULTS.globalCooldownMs)) {
        console.debug(`${logPrefix} Global cooldown active, skipping switch to "${argFolder}".`);
        return;
    }
    if (!opts.isLock) {
        const lastSuccess = state.lastTriggerTimes.get(argFolder) || 0;
        if (now - lastSuccess < (profile.perTriggerCooldownMs ?? PROFILE_DEFAULTS.perTriggerCooldownMs)) {
            console.debug(`${logPrefix} Per-trigger cooldown active for "${argFolder}".`);
            return;
        }
        const lastFailed = state.failedTriggerTimes.get(argFolder) || 0;
        if (now - lastFailed < (profile.failedTriggerCooldownMs ?? PROFILE_DEFAULTS.failedTriggerCooldownMs)) {
            console.debug(`${logPrefix} Failed-trigger cooldown active for "${argFolder}".`);
            return;
        }
    }

    // --- Execute Switch ---
    const command = `/costume \\${argFolder}`;
    console.debug(`${logPrefix} executing command:`, command, "kind:", opts.matchKind || 'manual', "isLock:", !!opts.isLock);

    try {
        await SCRIPT_CONTEXT.executeSlashCommandsOnChatInput(command);
        state.lastTriggerTimes.set(argFolder, now);
        state.lastIssuedCostume = argFolder;
        state.lastSwitchTimestamp = now;
        
        // Update state for pronoun detection and scene roster
        if (!opts.isPronoun) {
            state.pronounSubject = cleanName;
        }
        if (profile.enableSceneRoster) {
            state.activeRoster.set(cleanName, profile.sceneRosterTTL ?? PROFILE_DEFAULTS.sceneRosterTTL);
        }

        SCRIPT_CONTEXT.callPopup(`Switched to <b>${argFolder}</b>`, 'success', 2000);

    } catch (err) {
        state.failedTriggerTimes.set(argFolder, now);
        SCRIPT_CONTEXT.callPopup(`Failed to switch to costume "<b>${argFolder}</b>". Check console (F12) for errors.`, 'error', 5000);
        console.error(`${logPrefix} Failed to execute /costume command for "${argFolder}".`, err);
    }
}


// --- MAIN EVENT HANDLER ---
const handleStream = (...args) => {
    try {
        if (!settings.enabled || settings.focusLock.character) return;
        const profile = getActiveProfile();
        if (!profile) return;

        let tokenText = "", messageId = null;
        if (typeof args[0] === 'number') { messageId = args[0]; tokenText = String(args[1] ?? ""); } 
        else if (typeof args[0] === 'object') { tokenText = String(args[0].token ?? args[0].text ?? ""); messageId = args[0].messageId ?? args[1] ?? null; } 
        else { tokenText = String(args.join(' ') || ""); }
        if (!tokenText) return;

        const bufKey = messageId != null ? `m${messageId}` : 'live';
        if (!perMessageStates.has(bufKey)) handleGenerationStart(messageId);
        
        const msgState = perMessageStates.get(bufKey);
        if (msgState.vetoed) return;

        const prev = perMessageBuffers.get(bufKey) || "";
        const combined = (prev + normalizeStreamText(tokenText)).slice(-(profile.maxBufferChars ?? PROFILE_DEFAULTS.maxBufferChars));
        perMessageBuffers.set(bufKey, combined);
        ensureBufferLimit();
        
        const threshold = Number(profile.tokenProcessThreshold ?? PROFILE_DEFAULTS.tokenProcessThreshold);
        if (!/[\s.,!?:\u2014)\]]$/.test(tokenText.slice(-1)) && combined.length < (msgState.nextThreshold || threshold)) return;
        msgState.nextThreshold = combined.length + threshold;

        if (compiledRegexes.vetoRegex && compiledRegexes.vetoRegex.test(combined)) {
            console.debug(`${logPrefix} Veto phrase matched. Halting detection for this message.`);
            msgState.vetoed = true; return;
        }

        const bestMatch = findBestMatch(combined);
        if (bestMatch) {
            const { name: matchedName, matchKind, isPronoun } = bestMatch;
            const now = Date.now();
            const suppressMs = Number(profile.repeatSuppressMs ?? PROFILE_DEFAULTS.repeatSuppressMs);
            
            // Flicker guard: don't switch to the same character repeatedly in a short time
            if (msgState.lastAcceptedName?.toLowerCase() === matchedName.toLowerCase() && (now - msgState.lastAcceptedTs < suppressMs)) {
                return;
            }

            msgState.lastAcceptedName = matchedName;
            msgState.lastAcceptedTs = now;
            issueCostumeForName(matchedName, { matchKind, isPronoun });
        }
    } catch (err) { console.error(`${logPrefix} stream handler error:`, err); }
};

// --- LIFECYCLE MANAGEMENT ---
let eventHandlers = {};
const STREAM_EVENT_NAME = event_types?.STREAM_TOKEN_RECEIVED || event_types?.SMOOTH_STREAM_TOKEN_RECEIVED || 'stream_token_received';

function unload() {
    if (eventSource) {
        for (const [event, handler] of Object.entries(eventHandlers)) {
            eventSource.off?.(event, handler);
        }
    }
    eventHandlers = {};
    resetGlobalState();
}

function load() {
    unload(); // Ensure clean state before loading
    eventHandlers = {
        [STREAM_EVENT_NAME]: handleStream,
        [event_types.GENERATION_STARTED]: (messageId) => {
            handleGenerationStart(messageId);
            if (getActiveProfile()?.enableSceneRoster) {
                // Decrement TTL for all characters in the roster at the start of a new message
                for (const [name, ttl] of state.activeRoster.entries()) {
                    if (ttl - 1 <= 0) {
                        state.activeRoster.delete(name);
                    } else {
                        state.activeRoster.set(name, ttl - 1);
                    }
                }
            }
        },
        [event_types.GENERATION_ENDED]: cleanupMessageState,
        [event_types.MESSAGE_RECEIVED]: cleanupMessageState,
        [event_types.CHAT_CHANGED]: resetGlobalState,
    };
    for (const [event, handler] of Object.entries(eventHandlers)) {
        eventSource.on?.(event, handler);
    }
}
