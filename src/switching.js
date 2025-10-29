import { executeSlashCommandsOnChatInput } from "./dependencies.js";
import { getActiveProfile } from "./settings.js";
import { state } from "./state.js";
import { showStatus } from "./status.js";
import { escapeHtml, normalizeCostumeName } from "./utils.js";
import { logPrefix } from "./constants.js";

function getCooldownMaps(runtimeState) {
    return {
        lastTriggerTimes: runtimeState.lastTriggerTimes instanceof Map ? runtimeState.lastTriggerTimes : new Map(),
        failedTriggerTimes: runtimeState.failedTriggerTimes instanceof Map ? runtimeState.failedTriggerTimes : new Map(),
    };
}

function resolveMappingFolder(name) {
    if (!name) return null;
    const normalized = String(name).toLowerCase();
    if (!normalized) return null;
    return state.mappingLookup.get(normalized) || null;
}

export function evaluateSwitchDecision(rawName, opts = {}, contextState = null, nowOverride = null) {
    const profile = getActiveProfile();
    if (!profile) {
        return { shouldSwitch: false, reason: 'no-profile' };
    }
    if (!rawName) {
        return { shouldSwitch: false, reason: 'no-name' };
    }

    const runtimeState = contextState || state;
    const now = Number.isFinite(nowOverride) ? nowOverride : Date.now();
    const decision = { now };

    decision.name = normalizeCostumeName(rawName);
    const currentName = normalizeCostumeName(runtimeState.lastIssuedCostume || "");

    if (!opts.isLock && currentName && currentName.toLowerCase() === decision.name.toLowerCase()) {
        return { shouldSwitch: false, reason: 'already-active', name: decision.name, now };
    }

    const cooldowns = getCooldownMaps(runtimeState);
    const folder = resolveMappingFolder(decision.name) || decision.name;
    decision.folder = folder;

    const folderKey = folder.toLowerCase();

    const cooldown = Number.isFinite(profile.perTriggerCooldownMs) ? profile.perTriggerCooldownMs : 0;
    const failedCooldown = Number.isFinite(profile.failedTriggerCooldownMs) ? profile.failedTriggerCooldownMs : 0;
    const globalCooldown = Number.isFinite(profile.globalCooldownMs) ? profile.globalCooldownMs : 0;

    const lastGlobal = Number(runtimeState.lastSwitchTimestamp) || 0;
    if (!opts.force && now - lastGlobal < globalCooldown) {
        return { shouldSwitch: false, reason: 'global-cooldown', name: decision.name, folder, now };
    }

    if (!opts.force) {
        const lastTrigger = Number(cooldowns.lastTriggerTimes.get(folderKey)) || 0;
        if (now - lastTrigger < cooldown) {
            return { shouldSwitch: false, reason: 'trigger-cooldown', name: decision.name, folder, now };
        }
        const lastFailure = Number(cooldowns.failedTriggerTimes.get(folderKey)) || 0;
        if (now - lastFailure < failedCooldown) {
            return { shouldSwitch: false, reason: 'failed-cooldown', name: decision.name, folder, now };
        }
    }

    if (opts.vetoed) {
        return { shouldSwitch: false, reason: 'vetoed', name: decision.name, folder, now };
    }

    return { shouldSwitch: true, name: decision.name, folder, now };
}

export async function issueCostumeForName(name, opts = {}) {
    const decision = evaluateSwitchDecision(name, opts);
    if (!decision.shouldSwitch) {
        return;
    }

    const command = `/costume \\${decision.folder}`;
    try {
        await executeSlashCommandsOnChatInput(command);
        state.lastTriggerTimes.set(decision.folder, decision.now);
        state.lastIssuedCostume = decision.name;
        state.lastSwitchTimestamp = decision.now;
        showStatus(`Switched -> <b>${escapeHtml(decision.folder)}</b>`, 'success');
    } catch (err) {
        state.failedTriggerTimes.set(decision.folder, decision.now);
        showStatus(`Failed to switch to costume "<b>${escapeHtml(decision.folder)}</b>". Check console (F12).`, 'error');
        console.error(`${logPrefix} Failed to execute /costume command for "${decision.folder}".`, err);
    }
}
