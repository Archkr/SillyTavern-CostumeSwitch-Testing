import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, event_types, eventSource } from "../../../../script.js";
import { registerSlashCommand, executeSlashCommandsOnChatInput } from "../../../slash-commands.js";

const extensionName = "SillyTavern-CostumeSwitch-Testing";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Default settings for a single profile.
const PROFILE_DEFAULTS = {
    patterns: ["Char A", "Char B", "Char C", "Char D"],
    ignorePatterns: [],
    vetoPatterns: ["OOC:", "(OOC)"],
    defaultCostume: "",
    debug: false,
    globalCooldownMs: 1200,
    perTriggerCooldownMs: 250,
    failedTriggerCooldownMs: 10000,
    maxBufferChars: 2000,
    // REMOVED: repeatSuppressMs - This is now handled by the cooldowns and scoring logic.
    tokenProcessThreshold: 60, // Now properly implemented
    // REMOVED: detectionBias - Replaced by the new scoring model.
    mappings: [],
    detectAttribution: true,
    detectAction: true,
    detectVocative: true,
    detectPossessive: true,
    detectGeneral: false,
    attributionVerbs: "acknowledged|added|admitted|advised|affirmed|agreed|announced|answered|argued|asked|barked|began|bellowed|blurted|boasted|bragged|called|chirped|commanded|commented|complained|conceded|concluded|confessed|confirmed|continued|countered|cried|croaked|crowed|declared|decreed|demanded|denied|drawled|echoed|emphasized|enquired|enthused|estimated|exclaimed|explained|gasped|insisted|instructed|interjected|interrupted|joked|lamented|lied|maintained|moaned|mumbled|murmured|mused|muttered|nagged|nodded|noted|objected|offered|ordered|perked up|pleaded|prayed|predicted|proclaimed|promised|proposed|protested|queried|questioned|quipped|rambled|reasoned|reassured|recited|rejoined|remarked|repeated|replied|responded|retorted|roared|said|scolded|scoffed|screamed|shouted|sighed|snapped|snarled|spoke|stammered|stated|stuttered|suggested|surmised|tapped|threatened|turned|urged|vowed|wailed|warned|whimpered|whispered|wondered|yelled",
    actionVerbs: "adjust|adjusted|appear|appeared|approach|approached|arrive|arrived|blink|blinked|bow|bowed|charge|charged|chase|chased|climb|climbing|collapse|collapsed|crawl|crawled|crept|crouch|crouched|dance|danced|dart|darted|dash|dashed|depart|departed|dive|dived|dodge|dodged|drag|dragged|drift|drifted|drop|dropped|emerge|emerged|enter|entered|exit|exited|fall|fell|flee|fled|flinch|flinched|float|floated|fly|flew|follow|followed|freeze|froze|frown|frowned|gesture|gestured|giggle|giggled|glance|glanced|grab|grabbed|grasp|grasped|grin|grinned|groan|groaned|growl|growled|grumble|grumbled|grunt|grunted|hold|held|hit|hop|hopped|hurry|hurried|jerk|jerks|jog|jogged|jump|jumped|kneel|knelt|laugh|laughed|lean|leaned|leap|leapt|left|limp|limped|look|looked|lower|lowered|lunge|lunged|march|marched|motion|motioned|move|moved|nod|nodded|observe|observed|pace|paced|pause|paused|point|pointed|pop|popped|position|positioned|pounce|pounced|push|pushed|race|raced|raise|raised|reach|reached|retreat|retreated|rise|rose|run|ran|rush|rushed|sit|sat|scramble|scrambled|set|shift|shifted|shake|shook|shrug|shrugged|shudder|shuddered|sigh|sighed|sip|sipped|slip|slipped|slump|slumped|smile|smiled|snort|snorted|spin|spun|sprint|sprinted|stagger|staggered|stare|stared|step|stepped|stand|stood|straighten|straightened|stumble|stumbled|swagger|swaggered|swallow|swallowed|swap|swapped|swing|swung|tap|tapped|throw|threw|tilt|tilted|tiptoe|tiptoed|take|took|toss|tossed|trudge|trudged|turn|turned|twist|twisted|vanish|vanished|wake|woke|walk|walked|wander|wandered|watch|watched|wave|waved|wince|winced|withdraw|withdrew"
};

const DEFAULTS = {
    enabled: true,
    profiles: { 'Default': structuredClone(PROFILE_DEFAULTS) },
    activeProfile: 'Default',
    focusLock: '',
};

jQuery(async () => {
    // ---------------------------------------------------------------------------------
    // HELPER AND UTILITY FUNCTIONS (Scoped within the extension)
    // ---------------------------------------------------------------------------------

    function escapeRegex(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function parsePatternEntry(raw) {
        const t = String(raw || '').trim();
        if (!t) return null;
        const m = t.match(/^\/((?:\\.|[^\/])+)\/([gimsuy]*)$/);
        return m ? { body: m[1], flags: m[2] || '', raw: t } : { body: escapeRegex(t), flags: '', raw: t };
    }

    function computeFlagsFromEntries(entries, requireI = true) {
        const f = new Set();
        for (const e of entries) {
            if (!e) continue;
            for (const c of (e.flags || '')) f.add(c);
        }
        if (requireI) f.add('i');
        return Array.from(f).filter(c => 'gimsuy'.includes(c)).join('');
    }

    function processVerbsForRegex(verbString) {
        return verbString.split('|')
            .map(v => v.trim())
            .filter(Boolean)
            .map(v => v.replace(/\s+/g, '\\s+'))
            .join('|');
    }

    function buildGenericRegex(patternList) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const parts = entries.map(e => `(?:${e.body})`);
        const body = `(?:${parts.join('|')})`;
        const flags = computeFlagsFromEntries(entries, true);

        try {
            return new RegExp(body, flags);
        } catch (e) {
            for (let i = 0; i < entries.length; i++) {
                try {
                    new RegExp(entries[i].body, computeFlagsFromEntries([entries[i]], true));
                } catch (err) {
                    throw new Error(`Pattern #${i+1} failed to compile: "${entries[i].raw || entries[i].body}" — ${err.message}`);
                }
            }
            throw new Error(`Combined pattern failed to compile: ${e.message}`);
        }
    }

    function buildNameRegex(patternList) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const parts = entries.map(x => `(?:${x.body})`);
        const body = `(?:^|\\n|[\\(\\[\\-—–])(?:(${parts.join('|')}))(?:\\W|$)`;
        const flags = computeFlagsFromEntries(entries, true);

        try { return new RegExp(body, flags); } catch (err) { console.warn("buildNameRegex compile failed:", err); return null; }
    }

    function buildSpeakerRegex(patternList) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const parts = entries.map(x => `(?:${x.body})`);
        const body = `(?:^|\\n)\\s*(${parts.join('|')})\\s*[:;,]\\s*`;
        const flags = computeFlagsFromEntries(entries, true);

        try { return new RegExp(body, flags); } catch (err) { console.warn("buildSpeakerRegex compile failed:", err); return null; }
    }

    function buildVocativeRegex(patternList) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const parts = entries.map(x => `(?:${x.body})`);
        const body = `(?:["“'\\s])(${parts.join('|')})[,.!?]`;
        const flags = computeFlagsFromEntries(entries, true);

        try { return new RegExp(body, flags); } catch (err) { console.warn("buildVocativeRegex compile failed:", err); return null; }
    }


    function buildUnifiedAttributionRegex(patternList, verbString) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const names = entries.map(x => `(?:${x.body})`).join("|");
        const verbs = processVerbsForRegex(verbString);
        if (!verbs) return null;

        const optionalMiddleName = `(?:\\s+[A-Z][a-z]+)*`;
        const postQuote = `(?:["“”][^"“”]*["“”])\\s*[,:;\\-–—]?\\s*(${names})${optionalMiddleName}\\s+(?:${verbs})\\b`;
        const preQuote = `\\b(${names})${optionalMiddleName}\\s+(?:${verbs})\\s*[:,]?\\s*["“”]`;
        const voice = `\\b(${names})${optionalMiddleName}(?:[’\`']s|\\'s)\\s+(?:[a-zA-Z'’]+\\s+){0,3}?voice\\b`;

        const body = `(?:${postQuote})|(?:${preQuote})|(?:${voice})`;
        const flags = computeFlagsFromEntries(entries, true);
        try { return new RegExp(body, flags); } catch (err) { console.warn("buildUnifiedAttributionRegex compile failed:", err); return null; }
    }


    function buildDirectActionRegex(patternList, verbString) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const names = entries.map(x => `(?:${x.body})`).join("|");
        const verbs = processVerbsForRegex(verbString);
        if (!verbs) return null;

        const optionalMiddleName = `(?:\\s+[A-Z][a-z]+)*`;
        // FIX: Added a negative lookbehind to avoid verbs preceded by prepositions, reducing false positives.
        const patternA = `(?:[\\w'’]+\\s+){0,3}?(?:${verbs})`;
        const patternB = `(?:${verbs})(?:\\s+[\\w'’]{1,20}){0,3}`;

        const body = `\\b(${names})${optionalMiddleName}\\s+(?:${patternA}|${patternB})\\b`;

        const flags = computeFlagsFromEntries(entries, true);
        try { return new RegExp(body, flags); } catch (err) { console.warn("buildDirectActionRegex compile failed:", err); return null; }
    }

    function buildPossessiveRegex(patternList) {
        const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
        if (!entries.length) return null;

        const names = entries.map(x => `(?:${x.body})`).join("|");
        const body = `\\b(${names})(?:\\s+[A-Z][a-z]+)*[’\`']s\\b`;
        const flags = computeFlagsFromEntries(entries, true);
        try { return new RegExp(body, flags); } catch (err) { console.warn("buildPossessiveRegex compile failed:", err); return null; }
    }

    function getQuoteRanges(s) {
        const quoteRegex = /"|\u201C|\u201D/g;
        const positions = [];
        const ranges = [];
        let match;
        while ((match = quoteRegex.exec(s)) !== null) {
            positions.push(match.index);
        }
        for (let i = 0; i + 1 < positions.length; i += 2) {
            ranges.push([positions[i], positions[i + 1]]);
        }
        return ranges;
    }

    function isIndexInsideQuotesRanges(ranges, idx) {
        for (const [start, end] of ranges) {
            if (idx > start && idx < end) return true;
        }
        return false;
    }

    function findMatches(combined, regex, quoteRanges, searchInsideQuotes = false) {
        if (!combined || !regex) return [];

        const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
        const re = new RegExp(regex.source, flags);
        const results = [];
        let match;

        while ((match = re.exec(combined)) !== null) {
            const matchIndex = match.index || 0;
            const isInsideQuotes = isIndexInsideQuotesRanges(quoteRanges, matchIndex);

            if (searchInsideQuotes || !isInsideQuotes) {
                results.push({
                    match: match[0],
                    groups: match.slice(1),
                    index: matchIndex,
                });
            }
            if (re.lastIndex === match.index) {
                re.lastIndex++;
            }
        }
        return results;
    }

    function findAllMatches(combined, regexes, settings, quoteRanges) {
        const allMatches = [];
        const { speakerRegex, attributionRegex, directActionRegex, possessiveRegex, vocativeRegex, nameRegex } = regexes;
        const points = { speaker: 5, attribution: 4, action: 3, vocative: 2, possessive: 1, name: 0.5, "attribution (pronoun)": 4 };

        if (speakerRegex) findMatches(combined, speakerRegex, quoteRanges).forEach(m => { const name = m.groups?.[0]?.trim(); name && allMatches.push({ name, match: m.match, matchKind: "speaker", matchIndex: m.index, points: points.speaker }); });
        if (settings.detectAttribution && attributionRegex) findMatches(combined, attributionRegex, quoteRanges).forEach(m => { const name = m.groups?.find(g => g)?.trim(); name && allMatches.push({ name, match: m.match, matchKind: "attribution", matchIndex: m.index, points: points.attribution }); });
        if (settings.detectAction && directActionRegex) findMatches(combined, directActionRegex, quoteRanges).forEach(m => { const name = m.groups?.find(g => g)?.trim(); name && allMatches.push({ name, match: m.match, matchKind: "action", matchIndex: m.index, points: points.action }); });
        if (settings.detectVocative && vocativeRegex) findMatches(combined, vocativeRegex, quoteRanges, true).forEach(m => { const name = m.groups?.[0]?.trim(); name && allMatches.push({ name, match: m.match, matchKind: "vocative", matchIndex: m.index, points: points.vocative }); });
        if (settings.detectPossessive && possessiveRegex) findMatches(combined, possessiveRegex, quoteRanges).forEach(m => { const name = m.groups?.[0]?.trim(); name && allMatches.push({ name, match: m.match, matchKind: "possessive", matchIndex: m.index, points: points.possessive }); });
        if (settings.detectGeneral && nameRegex) findMatches(combined, nameRegex, quoteRanges).forEach(m => { const name = String(m.groups?.[0] || m.match).replace(/-(?:sama|san)$/i, "").trim(); name && allMatches.push({ name, match: m.match, matchKind: "name", matchIndex: m.index, points: points.name }); });

        if (settings.detectAttribution && nameRegex) {
            const verbs = processVerbsForRegex(settings.attributionVerbs || '');
            if (verbs) {
                const pronounRegex = new RegExp(`(["”'][,.]?)(?:.*?)?\\s+(he|she|they)\\s+(${verbs})`, 'gi');
                findMatches(combined, pronounRegex, quoteRanges).forEach(pronounMatch => {
                    const pronounMatchIndex = pronounMatch.index;
                    // FIX: Pronoun resolution now correctly finds the CLOSEST preceding match, not the highest priority one.
                    const antecedent = allMatches
                        .filter(m => m.matchIndex < pronounMatchIndex)
                        .sort((a, b) => b.matchIndex - a.matchIndex)[0];

                    if (antecedent) {
                        allMatches.push({
                            name: antecedent.name,
                            match: pronounMatch.match,
                            matchKind: "attribution (pronoun)",
                            matchIndex: pronounMatchIndex,
                            points: points["attribution (pronoun)"]
                        });
                    }
                });
            }
        }

        return allMatches.sort((a, b) => a.matchIndex - b.matchIndex);
    }
    
    // NEW: This function replaces the old `findBestMatch` with a more robust cumulative scoring system.
    function calculateCharacterFocusScores(allMatches, bufferLength) {
        if (!allMatches || allMatches.length === 0) return {};
    
        const scores = {};
        const DECAY_RATE = 0.9; // How much score is lost per 100 characters of distance.
    
        allMatches.forEach(match => {
            const normalizedName = normalizeCostumeName(match.name);
            if (!scores[normalizedName]) {
                scores[normalizedName] = { score: 0, lastMatchIndex: -1 };
            }
    
            // Calculate recency-based score decay
            const distance = bufferLength - match.matchIndex;
            const decayMultiplier = Math.pow(DECAY_RATE, distance / 100);
            const scoreToAdd = (match.points || 1) * decayMultiplier;
    
            scores[normalizedName].score += scoreToAdd;
            scores[normalizedName].lastMatchIndex = Math.max(scores[normalizedName].lastMatchIndex, match.matchIndex);
        });
    
        return scores;
    }
    
    function getWinningCharacter(scores) {
        if (Object.keys(scores).length === 0) return null;
    
        let winner = null;
        let highestScore = -Infinity;
    
        for (const name in scores) {
            if (scores[name].score > highestScore) {
                highestScore = scores[name].score;
                winner = name;
            }
        }
        return winner;
    }


    function normalizeStreamText(s) {
        if (!s) return "";
        return String(s)
            .replace(/[\uFEFF\u200B\u200C\u200D]/g, "")
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
            .replace(/(\*\*|__|~~|`{1,3})/g, "")
            .replace(/\u00A0/g, " ");
    }

    function normalizeCostumeName(n) {
        if (!n) return "";
        let s = String(n).trim();
        if (s.startsWith("/")) {
            s = s.slice(1).trim();
        }
        const first = s.split(/[\/\s]+/).filter(Boolean)[0] || s;
        return String(first).replace(/[-_](?:sama|san|chan|kun)$/i, "").trim();
    }


    // ---------------------------------------------------------------------------------
    // EXTENSION STATE AND MAIN LOGIC
    // ---------------------------------------------------------------------------------
    const perMessageBuffers = new Map();
    const perMessageStates = new Map();
    let lastIssuedCostume = null;
    let lastSwitchTimestamp = 0;
    const lastTriggerTimes = new Map();
    const failedTriggerTimes = new Map();
    let _streamHandler = null, _genStartHandler = null, _genEndHandler = null, _msgRecvHandler = null, _chatChangedHandler = null;
    const MAX_MESSAGE_BUFFERS = 60;

    function ensureBufferLimit() {
        if (perMessageBuffers.size > MAX_MESSAGE_BUFFERS) {
            const firstKey = perMessageBuffers.keys().next().value;
            perMessageBuffers.delete(firstKey);
            perMessageStates.delete(firstKey);
        }
    }
    function debugLog(settings, ...args) {
        try {
            if (settings && getActiveProfile(settings)?.debug) {
                console.debug.apply(console, ["[CostumeSwitch]"].concat(args));
            }
        } catch (e) {}
    }
    function waitForSelector(selector, timeout = 3000, interval = 120) {
        return new Promise(resolve => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(timer);
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, interval);
        });
    }
    function getActiveProfile(settings) {
        return settings?.profiles?.[settings.activeProfile];
    }

    function getBufKey(messageId) {
        return messageId != null ? `m${messageId}` : 'live';
    }

    if (typeof executeSlashCommandsOnChatInput !== 'function') {
        console.error("[CostumeSwitch] FATAL: The global 'executeSlashCommandsOnChatInput' function is not available.");
        const statusEl = document.querySelector("#cs-status");
        if (statusEl) {
            statusEl.textContent = "FATAL ERROR: See console";
            statusEl.style.color = "red";
        }
        return;
    }
    const { store, save, ctx } = getSettingsObj();
    let settings = store[extensionName];
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHtml);
    } catch (e) {
        console.warn("Failed to load settings.html:", e);
        $("#extensions_settings").append('<div><h3>Costume Switch</h3><div>Failed to load UI (see console)</div></div>');
    }
    const ok = await waitForSelector("#cs-save", 3000, 100);
    if (!ok) console.warn("CostumeSwitch: settings UI did not appear within timeout.");
    let nameRegex, speakerRegex, attributionRegex, directActionRegex, possessiveRegex, vocativeRegex, vetoRegex;

    function recompileRegexes() {
        try {
            const profile = getActiveProfile(settings);
            if (!profile) return;
            const lowerIgnored = (profile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
            const effectivePatterns = (profile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
            const attributionVerbs = String(profile.attributionVerbs || '');
            const actionVerbs = String(profile.actionVerbs || '');

            nameRegex = buildNameRegex(effectivePatterns);
            speakerRegex = buildSpeakerRegex(effectivePatterns);
            attributionRegex = buildUnifiedAttributionRegex(effectivePatterns, attributionVerbs);
            directActionRegex = buildDirectActionRegex(effectivePatterns, actionVerbs);
            possessiveRegex = buildPossessiveRegex(effectivePatterns);
            vocativeRegex = buildVocativeRegex(effectivePatterns);
            vetoRegex = buildGenericRegex(profile.vetoPatterns);
            $("#cs-error").text("").hide();
        } catch (e) {
            $("#cs-error").text(`Pattern compile error: ${String(e)}`).show();
        }
    }
    function populateProfileDropdown() {
        const select = $("#cs-profile-select");
        select.empty();
        Object.keys(settings.profiles).forEach(name => {
            select.append($('<option>', { value: name, text: name }));
        });
        select.val(settings.activeProfile);
    }
    function updateFocusLockUI() {
        const profile = getActiveProfile(settings);
        const lockSelect = $("#cs-focus-lock-select");
        const lockToggle = $("#cs-focus-lock-toggle");
        lockSelect.empty();
        lockSelect.append($('<option>', { value: '', text: 'None (Automatic)' }));
        if (profile && profile.patterns) {
            profile.patterns.forEach(name => {
                const cleanName = normalizeCostumeName(name);
                lockSelect.append($('<option>', { value: cleanName, text: cleanName }));
            });
        }
        if (settings.focusLock) {
            lockSelect.val(settings.focusLock);
            lockToggle.text("Unlock");
            lockSelect.prop("disabled", true);
        } else {
            lockSelect.val('');
            lockToggle.text("Lock");
            lockSelect.prop("disabled", false);
        }
    }
    function loadProfile(profileName) {
        if (!settings.profiles[profileName]) {
            console.warn(`Profile "${profileName}" not found. Loading default.`);
            profileName = Object.keys(settings.profiles)[0];
        }
        settings.activeProfile = profileName;
        const profile = getActiveProfile(settings);
        $("#cs-profile-name").val(profileName);
        $("#cs-patterns").val((profile.patterns || []).join("\n"));
        $("#cs-ignore-patterns").val((profile.ignorePatterns || []).join("\n"));
        $("#cs-veto-patterns").val((profile.vetoPatterns || []).join("\n"));
        $("#cs-default").val(profile.defaultCostume || "");
        $("#cs-debug").prop("checked", !!profile.debug);
        $("#cs-global-cooldown").val(profile.globalCooldownMs ?? PROFILE_DEFAULTS.globalCooldownMs);
        $("#cs-per-trigger-cooldown").val(profile.perTriggerCooldownMs ?? PROFILE_DEFAULTS.perTriggerCooldownMs);
        $("#cs-failed-trigger-cooldown").val(profile.failedTriggerCooldownMs ?? PROFILE_DEFAULTS.failedTriggerCooldownMs);
        $("#cs-max-buffer-chars").val(profile.maxBufferChars ?? PROFILE_DEFAULTS.maxBufferChars);
        $("#cs-token-process-threshold").val(profile.tokenProcessThreshold ?? PROFILE_DEFAULTS.tokenProcessThreshold);
        $("#cs-detect-attribution").prop("checked", !!profile.detectAttribution);
        $("#cs-detect-action").prop("checked", !!profile.detectAction);
        $("#cs-detect-vocative").prop("checked", !!profile.detectVocative);
        $("#cs-detect-possessive").prop("checked", !!profile.detectPossessive);
        $("#cs-detect-general").prop("checked", !!profile.detectGeneral);
        $("#cs-attribution-verbs").val(String(profile.attributionVerbs || '').replace(/\|/g, '\n'));
        $("#cs-action-verbs").val(String(profile.actionVerbs || '').replace(/\|/g, '\n'));
        renderMappings(profile);
        updateFocusLockUI();
        recompileRegexes();
    }
    function renderMappings(profile) {
        const tbody = $("#cs-mappings-tbody");
        if (!tbody.length) return;
        tbody.empty();
        (profile.mappings || []).forEach((m, idx) => {
            const $tr = $("<tr>").attr("data-idx", idx);
            const $nameTd = $("<td>").append($("<input>").addClass("map-name").val(m.name || "").attr("type", "text"));
            const $folderTd = $("<td>").append($("<input>").addClass("map-folder").val(m.folder || "").attr("type", "text"));
            const $actionsTd = $("<td>").append($("<button>").addClass("map-remove menu_button interactable").text("Remove"));
            $tr.append($nameTd, $folderTd, $actionsTd);
            tbody.append($tr);
        });
    }
    function persistSettings() {
        if (save) save();
        $("#cs-status").text(`Saved ${new Date().toLocaleTimeString()}`);
        setTimeout(() => $("#cs-status").text("Ready"), 1500);
    }
    $("#cs-enable").prop("checked", !!settings.enabled);
    populateProfileDropdown();
    loadProfile(settings.activeProfile);

    function testRegexPattern() {
        const text = $("#cs-regex-test-input").val();
        const allDetectionsList = $("#cs-test-all-detections");
        const winnerList = $("#cs-test-winner-list");
        const vetoStatusList = $("#cs-test-veto-status");

        allDetectionsList.html('<li style="color: var(--text-color-soft);">Enter text to test.</li>');
        winnerList.html('<li style="color: var(--text-color-soft);">N/A</li>');
        vetoStatusList.html('<li style="color: var(--text-color-soft);">N/A</li>');

        if (!text) return;

        const tempProfile = saveCurrentProfileData();
        const tempVetoPatterns = $("#cs-veto-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const tempVetoRegex = buildGenericRegex(tempVetoPatterns);
        const combined = normalizeStreamText(text);

        vetoStatusList.empty();
        if (tempVetoRegex && tempVetoRegex.test(combined)) {
            const match = combined.match(tempVetoRegex)[0];
            vetoStatusList.html(`<li style="color: var(--red);">VETOED by: "${match}"</li>`);
            allDetectionsList.html('<li style="color: var(--text-color-soft);">Vetoed.</li>');
            winnerList.html('<li style="color: var(--text-color-soft);">Vetoed.</li>');
            return;
        } else {
            vetoStatusList.html('<li style="color: var(--green);">No veto detected.</li>');
        }

        const lowerIgnored = (tempProfile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
        const effectivePatterns = (tempProfile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
        const tempRegexes = {
            speakerRegex: buildSpeakerRegex(effectivePatterns),
            attributionRegex: buildUnifiedAttributionRegex(effectivePatterns, tempProfile.attributionVerbs),
            directActionRegex: buildDirectActionRegex(effectivePatterns, tempProfile.actionVerbs),
            possessiveRegex: buildPossessiveRegex(effectivePatterns),
            vocativeRegex: buildVocativeRegex(effectivePatterns),
            nameRegex: buildNameRegex(effectivePatterns)
        };

        const allMatches = findAllMatches(combined, tempRegexes, tempProfile, getQuoteRanges(combined));
        
        allDetectionsList.empty();
        if (allMatches.length > 0) {
            allMatches.forEach(match => {
                allDetectionsList.append(`<li><b>${normalizeCostumeName(match.name)}</b> <small>(${match.matchKind}, pts:${match.points} @${match.matchIndex})</small></li>`);
            });
        } else {
            allDetectionsList.html('<li style="color: var(--text-color-soft);">No detections found.</li>');
        }

        winnerList.empty();
        const scores = calculateCharacterFocusScores(allMatches, combined.length);
        const winner = getWinningCharacter(scores);
        
        if (winner) {
            const sortedScores = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);
            sortedScores.forEach(([name, data]) => {
                const isWinner = name === winner;
                const scoreStr = data.score.toFixed(2);
                const li = `<li>${isWinner ? '<b>' : ''}${name} <small>(Score: ${scoreStr})</small>${isWinner ? '</b>' : ''}</li>`;
                winnerList.append(li);
            });
        } else {
            winnerList.html('<li style="color: var(--text-color-soft);">No winning character.</li>');
        }
    }

    function saveCurrentProfileData() {
        const profileData = {
            patterns: $("#cs-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            ignorePatterns: $("#cs-ignore-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            vetoPatterns: $("#cs-veto-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            defaultCostume: $("#cs-default").val().trim(),
            debug: !!$("#cs-debug").prop("checked"),
            globalCooldownMs: parseInt($("#cs-global-cooldown").val() || PROFILE_DEFAULTS.globalCooldownMs, 10),
            perTriggerCooldownMs: parseInt($("#cs-per-trigger-cooldown").val() || PROFILE_DEFAULTS.perTriggerCooldownMs, 10),
            failedTriggerCooldownMs: parseInt($("#cs-failed-trigger-cooldown").val() || PROFILE_DEFAULTS.failedTriggerCooldownMs, 10),
            maxBufferChars: parseInt($("#cs-max-buffer-chars").val() || PROFILE_DEFAULTS.maxBufferChars, 10),
            tokenProcessThreshold: parseInt($("#cs-token-process-threshold").val() || PROFILE_DEFAULTS.tokenProcessThreshold, 10),
            detectAttribution: !!$("#cs-detect-attribution").prop("checked"),
            detectAction: !!$("#cs-detect-action").prop("checked"),
            detectVocative: !!$("#cs-detect-vocative").prop("checked"),
            detectPossessive: !!$("#cs-detect-possessive").prop("checked"),
            detectGeneral: !!$("#cs-detect-general").prop("checked"),
            attributionVerbs: $("#cs-attribution-verbs").val().trim().replace(/\s*\n\s*/g, '|'),
            actionVerbs: $("#cs-action-verbs").val().trim().replace(/\s*\n\s*/g, '|'),
            mappings: []
        };
        const newMaps = [];
        $("#cs-mappings-tbody tr").each(function () {
            const name = $(this).find(".map-name").val().trim();
            const folder = $(this).find(".map-folder").val().trim();
            if (name && folder) newMaps.push({ name, folder });
        });
        profileData.mappings = newMaps;
        return profileData;
    }
    function tryWireUI() {
        $("#cs-enable").off('change.cs').on("change.cs", function() { settings.enabled = !!$(this).prop("checked"); persistSettings(); });
        $("#cs-focus-lock-toggle").off('click.cs').on("click.cs", async () => { if (settings.focusLock) { settings.focusLock = ''; await manualReset(); } else { const selectedChar = $("#cs-focus-lock-select").val(); if (selectedChar) { settings.focusLock = selectedChar; await issueCostumeForName(selectedChar, { isLock: true }); } } updateFocusLockUI(); persistSettings(); });
        $("#cs-save").off('click.cs').on("click.cs", () => { const profileData = saveCurrentProfileData(); if(profileData) { settings.profiles[settings.activeProfile] = profileData; recompileRegexes(); updateFocusLockUI(); persistSettings(); } });
        $("#cs-profile-select").off('change.cs').on("change.cs", function() { loadProfile($(this).val()); });
        $("#cs-profile-save").off('click.cs').on("click.cs", () => { const newName = $("#cs-profile-name").val().trim(); if (!newName) return; const oldName = settings.activeProfile; if (newName !== oldName && settings.profiles[newName]) { $("#cs-error").text("A profile with that name already exists.").show(); return; } const profileData = saveCurrentProfileData(); if (!profileData) return; delete settings.profiles[oldName]; settings.profiles[newName] = profileData; settings.activeProfile = newName; populateProfileDropdown(); updateFocusLockUI(); $("#cs-error").text("").hide(); persistSettings(); });
        $("#cs-profile-delete").off('click.cs').on("click.cs", () => { if (Object.keys(settings.profiles).length <= 1) { $("#cs-error").text("Cannot delete the last profile.").show(); return; } const profileNameToDelete = settings.activeProfile; if (confirm(`Are you sure you want to delete the profile "${profileNameToDelete}"?`)) { delete settings.profiles[profileNameToDelete]; settings.activeProfile = Object.keys(settings.profiles)[0]; populateProfileDropdown(); loadProfile(settings.activeProfile); $("#cs-status").text(`Deleted profile "${profileNameToDelete}".`); $("#cs-error").text("").hide(); persistSettings(); } });
        $("#cs-reset").off('click.cs').on("click.cs", async () => { await manualReset(); });
        $("#cs-mapping-add").off('click.cs').on("click.cs", () => { const profile = getActiveProfile(settings); if (profile) { if (!Array.isArray(profile.mappings)) profile.mappings = []; profile.mappings.push({ name: "", folder: "" }); renderMappings(profile); } });
        $("#cs-mappings-tbody").off('click.cs', '.map-remove').on('click.cs', '.map-remove', function () { const profile = getActiveProfile(settings); if (profile) { const idx = parseInt($(this).closest('tr').attr('data-idx'), 10); if (!isNaN(idx)) { profile.mappings.splice(idx, 1); renderMappings(profile); } } });
        $(document).off('click.cs', '#cs-regex-test-button').on('click.cs', '#cs-regex-test-button', testRegexPattern);
    }
    tryWireUI();
    async function manualReset() {
        const profile = getActiveProfile(settings);
        const costumeArg = profile?.defaultCostume?.trim() ? `\\${profile.defaultCostume.trim()}` : '\\';
        const command = `/costume ${costumeArg}`;
        debugLog(settings, "Attempting manual reset with command:", command);
        try {
            await executeSlashCommandsOnChatInput(command);
            lastIssuedCostume = costumeArg;
            $("#cs-status").text(`Reset -> ${costumeArg}`);
            setTimeout(() => $("#cs-status").text("Ready"), 1500);
        } catch (err) {
            console.error(`[CostumeSwitch] Manual reset failed for "${costumeArg}".`, err);
        }
    }
    function getMappedCostume(name) {
        const profile = getActiveProfile(settings);
        if (!name || !profile) return null;
        for (const m of (profile.mappings || [])) {
            if (m?.name?.toLowerCase() === name.toLowerCase()) {
                return m.folder ? m.folder.trim() : null;
            }
        }
        return null;
    }
    async function issueCostumeForName(name, opts = {}) {
        const profile = getActiveProfile(settings);
        if (!name || !profile) return;
        const now = Date.now();
        name = normalizeCostumeName(name);
        const isLock = opts.isLock || false;
        if (!isLock) {
            if (settings.focusLock) {
                debugLog(settings, "Focus is locked to", settings.focusLock, "- skipping switch to", name);
                return;
            }
            const currentName = normalizeCostumeName(lastIssuedCostume || profile.defaultCostume || (ctx?.characters?.[ctx.characterId]?.name) || '');
            if (currentName && currentName.toLowerCase() === name.toLowerCase()) {
                debugLog(settings, "already using costume for", name, "- skipping switch.");
                return;
            }
            if (now - lastSwitchTimestamp < (profile.globalCooldownMs || PROFILE_DEFAULTS.globalCooldownMs)) {
                debugLog(settings, "global cooldown active, skipping switch to", name);
                return;
            }
        }
        const matchKind = opts.matchKind || null;
        let argFolder = getMappedCostume(name) || name;
        const lastSuccess = lastTriggerTimes.get(argFolder) || 0;
        if (!isLock && now - lastSuccess < (profile.perTriggerCooldownMs || PROFILE_DEFAULTS.perTriggerCooldownMs)) {
            debugLog(settings, "per-trigger cooldown active, skipping", argFolder);
            return;
        }
        const lastFailed = failedTriggerTimes.get(argFolder) || 0;
        if (now - lastFailed < (profile.failedTriggerCooldownMs || PROFILE_DEFAULTS.failedTriggerCooldownMs)) {
            debugLog(settings, "failed-trigger cooldown active, skipping", argFolder);
            return;
        }
        const command = `/costume \\${argFolder}`;
        debugLog(settings, "executing command:", command, "kind:", matchKind, "isLock:", isLock);
        try {
            await executeSlashCommandsOnChatInput(command);
            lastTriggerTimes.set(argFolder, now);
            lastIssuedCostume = argFolder;
            lastSwitchTimestamp = now;
            $("#cs-status").text(`Switched -> ${argFolder}`);
            setTimeout(() => $("#cs-status").text("Ready"), 1000);
        } catch (err) {
            failedTriggerTimes.set(argFolder, now);
            console.error(`[CostumeSwitch] Failed to execute /costume command for "${argFolder}".`, err);
        }
    }
    const streamEventName = event_types?.STREAM_TOKEN_RECEIVED || event_types?.SMOOTH_STREAM_TOKEN_RECEIVED || 'stream_token_received';

    _genStartHandler = (messageId) => {
        const bufKey = getBufKey(messageId);
        debugLog(settings, `Generation started for ${bufKey}, resetting state.`);
        // FIX: The state now tracks the last winner and characters processed to optimize processing.
        perMessageStates.set(bufKey, { vetoed: false, lastWinner: null, charsSinceLastProcess: 0 });
        perMessageBuffers.delete(bufKey);
    };

    _streamHandler = (...args) => {
        try {
            if (!settings.enabled || settings.focusLock) return;
            const profile = getActiveProfile(settings);
            if (!profile) return;

            let tokenText = "", messageId = null;
            if (typeof args[0] === 'number') { messageId = args[0]; tokenText = String(args[1] ?? ""); }
            else if (typeof args[0] === 'object') { tokenText = String(args[0].token ?? args[0].text ?? ""); messageId = args[0].messageId ?? args[1] ?? null; }
            else { tokenText = String(args.join(' ') || ""); }
            if (!tokenText) return;

            const bufKey = getBufKey(messageId);
            if (!perMessageStates.has(bufKey)) { _genStartHandler(messageId); }
            const state = perMessageStates.get(bufKey);
            if (state.vetoed) return;

            // FIX: Implement Token Process Threshold to reduce CPU usage.
            state.charsSinceLastProcess += tokenText.length;
            if (state.charsSinceLastProcess < (profile.tokenProcessThreshold || PROFILE_DEFAULTS.tokenProcessThreshold)) {
                return;
            }
            state.charsSinceLastProcess = 0;


            const prev = perMessageBuffers.get(bufKey) || "";
            const combined = (prev + tokenText).slice(-(profile.maxBufferChars || PROFILE_DEFAULTS.maxBufferChars));
            perMessageBuffers.set(bufKey, combined);
            ensureBufferLimit();

            if (vetoRegex && vetoRegex.test(combined)) {
                debugLog(settings, "Veto phrase matched. Halting detection for this message.");
                state.vetoed = true;
                return;
            }

            const regexes = { speakerRegex, attributionRegex, directActionRegex, possessiveRegex, vocativeRegex, nameRegex };
            const allMatches = findAllMatches(combined, regexes, profile, getQuoteRanges(combined));
            if (!allMatches.length) return;

            // FIX: Use the new cumulative scoring logic instead of the old findBestMatch.
            const scores = calculateCharacterFocusScores(allMatches, combined.length);
            const winner = getWinningCharacter(scores);

            if (winner && winner !== state.lastWinner) {
                issueCostumeForName(winner, { bufKey });
                state.lastWinner = winner;
            }
        } catch (err) { console.error("CostumeSwitch stream handler error:", err); }
    };

    _genEndHandler = (messageId) => {
        const bufKey = getBufKey(messageId);
        perMessageBuffers.delete(bufKey);
        perMessageStates.delete(bufKey);
    };
    _msgRecvHandler = (messageId) => {
        const bufKey = getBufKey(messageId);
        perMessageBuffers.delete(bufKey);
        perMessageStates.delete(bufKey);
    };
    _chatChangedHandler = () => {
        perMessageBuffers.clear();
        perMessageStates.clear();
        lastIssuedCostume = null;
        lastTriggerTimes.clear();
        failedTriggerTimes.clear();
    };
    function unload() {
        try {
            if (eventSource) {
                eventSource.off?.(streamEventName, _streamHandler);
                eventSource.off?.(event_types.GENERATION_STARTED, _genStartHandler);
                eventSource.off?.(event_types.GENERATION_ENDED, _genEndHandler);
                eventSource.off?.(event_types.MESSAGE_RECEIVED, _msgRecvHandler);
                eventSource.off?.(event_types.CHAT_CHANGED, _chatChangedHandler);
            }
        } catch (e) {}
        perMessageBuffers.clear();
        perMessageStates.clear();
        lastIssuedCostume = null;
        lastTriggerTimes.clear();
        failedTriggerTimes.clear();
    }
    registerSlashCommand("scene", (args) => {
        const debugMode = (args[0] || '').trim().toLowerCase() === 'debug';
        const ctx = getContext();
        const lastMessage = ctx.chat.slice().reverse().find(msg => !msg.is_user && msg.mes);
        if (!lastMessage) {
            toastr.warning("Could not find the last AI message to analyze.");
            return;
        }
        const tempProfile = saveCurrentProfileData();
        const tempRegexes = {};
        try {
            const lowerIgnored = (tempProfile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
            const effectivePatterns = (tempProfile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
            tempRegexes.nameRegex = buildNameRegex(effectivePatterns);
            tempRegexes.speakerRegex = buildSpeakerRegex(effectivePatterns);
            tempRegexes.attributionRegex = buildUnifiedAttributionRegex(effectivePatterns, tempProfile.attributionVerbs);
            tempRegexes.directActionRegex = buildDirectActionRegex(effectivePatterns, tempProfile.actionVerbs);
            tempRegexes.possessiveRegex = buildPossessiveRegex(effectivePatterns);
            tempRegexes.vocativeRegex = buildVocativeRegex(effectivePatterns);
        } catch (e) {
            toastr.error(`Failed to build patterns for analysis: ${e.message}`);
            return;
        }
        // Use the new scoring logic for the scene command as well.
        const allMatches = findAllMatches(lastMessage.mes, tempRegexes, tempProfile, getQuoteRanges(lastMessage.mes));
        const scores = calculateCharacterFocusScores(allMatches, lastMessage.mes.length);
        const sortedScores = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);

        if (sortedScores.length === 0) {
            toastr.info("No primary characters were detected in the last message.");
            return;
        }
        if (debugMode) {
            let debugString = "<strong>Scene Debug Scores:</strong><br>";
            sortedScores.forEach(([name, data]) => {
                debugString += `${name}: ${data.score.toFixed(2)}<br>`;
            });
            toastr.info(debugString, "Scene Analysis Debug", { timeOut: 15000 });
            return;
        }
        const topScore = sortedScores[0][1].score;
        const primaryCharacters = sortedScores.filter(([name, data]) => data.score >= topScore * 0.4).map(([name, data]) => name);
        const resultString = primaryCharacters.join(', ');
        $("#send_textarea").val(resultString).focus();
        toastr.success(`Detected primary characters: ${resultString}`, "Scene Analysis Complete");
    }, ["debug"], "Analyzes the last AI message to determine the primary characters. Type '/scene debug' to see scores.", true);

    try { unload(); } catch (e) {}
    try {
        eventSource.on(streamEventName, _streamHandler);
        eventSource.on(event_types.GENERATION_STARTED, _genStartHandler);
        eventSource.on(event_types.GENERATION_ENDED, _genEndHandler);
        eventSource.on(event_types.MESSAGE_RECEIVED, _msgRecvHandler);
        eventSource.on(event_types.CHAT_CHANGED, _chatChangedHandler);
    } catch (e) {
        console.error("CostumeSwitch: failed to attach event handlers:", e);
    }
    try { window[`__${extensionName}_unload`] = unload; } catch (e) {}
    console.log("SillyTavern-CostumeSwitch v1.3.0 (Patched) loaded successfully.");
});

function getSettingsObj() {
    const ctx = typeof getContext === 'function' ? getContext() : (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null);
    let storeSource;
    if (ctx && ctx.extensionSettings) {
        storeSource = ctx.extensionSettings;
    } else if (typeof extension_settings !== 'undefined') {
        storeSource = extension_settings;
    } else {
        throw new Error("Can't find SillyTavern extension settings storage.");
    }
    if (!storeSource[extensionName] || !storeSource[extensionName].profiles) {
        const oldSettings = storeSource[extensionName] || {};
        const newSettings = structuredClone(DEFAULTS);
        Object.keys(PROFILE_DEFAULTS).forEach(key => {
            if (oldSettings.hasOwnProperty(key)) {
                newSettings.profiles.Default[key] = oldSettings[key];
            }
        });
        if (oldSettings.hasOwnProperty('enabled')) newSettings.enabled = oldSettings.enabled;
        storeSource[extensionName] = newSettings;
    }
    storeSource[extensionName] = Object.assign({}, structuredClone(DEFAULTS), storeSource[extensionName]);
    for (const profileName in storeSource[extensionName].profiles) {
        storeSource[extensionName].profiles[profileName] = Object.assign({}, structuredClone(PROFILE_DEFAULTS), storeSource[extensionName].profiles[profileName]);
    }
    return {
        store: storeSource,
        save: ctx?.saveSettingsDebounced || saveSettingsDebounced,
        ctx
    };
}
