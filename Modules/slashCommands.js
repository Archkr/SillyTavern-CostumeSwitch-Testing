import { registerSlashCommand } from "../../../../slash-commands.js";
import { getActiveProfile, saveSettings } from './settings.js';
import { recompileRegexes } from './detection.js';
import { loadProfileUI } from './ui.js';
import { SCRIPT_CONTEXT } from '../index.js';

export function registerCommands() {
    registerSlashCommand("cs-addchar",
        "Adds a character to the current profile's pattern list for this session.",
        ["char"],
        (args) => {
            const profile = getActiveProfile();
            const charName = args.join(" ").trim();
            if (profile && charName) {
                if (!profile.patterns.includes(charName)) {
                    profile.patterns.push(charName);
                    recompileRegexes();
                    loadProfileUI(profile.activeProfile); // Refresh UI to show new pattern
                    SCRIPT_CONTEXT.callPopup(`Added "<b>${charName}</b>" to current session patterns.`, 'success');
                } else {
                    SCRIPT_CONTEXT.callPopup(`"<b>${charName}</b>" is already in the pattern list.`, 'info');
                }
            }
        },
        true // is_hidden
    );

    registerSlashCommand("cs-ignore",
        "Adds a character to the current profile's ignore list for this session.",
        ["char"],
        (args) => {
            const profile = getActiveProfile();
            const charName = args.join(" ").trim();
            if (profile && charName) {
                if (!profile.ignorePatterns.includes(charName)) {
                    profile.ignorePatterns.push(charName);
                    recompileRegexes();
                    loadProfileUI(profile.activeProfile);
                    SCRIPT_CONTEXT.callPopup(`Ignoring "<b>${charName}</b>" for the current session.`, 'success');
                } else {
                    SCRIPT_CONTEXT.callPopup(`"<b>${charName}</b>" is already on the ignore list.`, 'info');
                }
            }
        },
        true // is_hidden
    );

    registerSlashCommand("cs-map",
        "Maps a character alias to a costume folder for this session. Use 'to' to separate.",
        ["alias", "to", "folder"],
        (args) => {
            const profile = getActiveProfile();
            const commandString = args.join(" ");
            const parts = commandString.split(/\s+to\s+/i);
            if (profile && parts.length === 2) {
                const name = parts[0].trim();
                const folder = parts[1].trim();
                profile.mappings = profile.mappings || [];
                // Remove existing mapping for this name if it exists, then add new one
                profile.mappings = profile.mappings.filter(m => m.name.toLowerCase() !== name.toLowerCase());
                profile.mappings.push({ name, folder });
                loadProfileUI(profile.activeProfile);
                SCRIPT_CONTEXT.callPopup(`Mapped "<b>${name}</b>" to "<b>${folder}</b>" for this session.`, 'success');
            } else {
                SCRIPT_CONTEXT.callPopup("Invalid map format. Use: /cs-map [alias] to [folder]", 'error');
            }
        },
        true // is_hidden
    );
}
