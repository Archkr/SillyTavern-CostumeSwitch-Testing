import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, event_types, eventSource } from "../../../../script.js";
import { executeSlashCommandsOnChatInput } from "../../../slash-commands.js";

const extensionName = "SillyTavern-CostumeSwitch-Testing";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const logPrefix = "[CostumeSwitch]";

// Constants for configuration and state management
const MAX_MESSAGE_BUFFERS = 60;
const STREAM_EVENT_NAME = event_types?.STREAM_TOKEN_RECEIVED || event_types?.SMOOTH_STREAM_TOKEN_RECEIVED || 'stream_token_received';
const DEFAULT_ATTRIBUTION_VERBS = ["acknowledged", "added", "admitted", "advised", "affirmed", "agreed", "announced", "answered", "argued", "asked", "barked", "began", "bellowed", "blurted", "boasted", "bragged", "called", "chirped", "commanded", "commented", "complained", "conceded", "concluded", "confessed", "confirmed", "continued", "countered", "cried", "croaked", "crowed", "declared", "decreed", "demanded", "denied", "drawled", "echoed", "emphasized", "enquired", "enthused", "estimated", "exclaimed", "explained", "gasped", "insisted", "instructed", "interjected", "interrupted", "joked", "lamented", "lied", "maintained", "moaned", "mumbled", "murmured", "mused", "muttered", "nagged", "nodded", "noted", "objected", "offered", "ordered", "perked up", "pleaded", "prayed", "predicted", "proclaimed", "promised", "proposed", "protested", "queried", "questioned", "quipped", "rambled", "reasoned", "reassured", "recited", "rejoined", "remarked", "repeated", "replied", "responded", "retorted", "roared", "said", "scolded", "scoffed", "screamed", "shouted", "sighed", "snapped", "snarled", "spoke", "stammered", "stated", "stuttered", "suggested", "surmised", "tapped", "threatened", "turned", "urged", "vowed", "wailed", "warned", "whimpered", "whispered", "wondered", "yelled"];
const DEFAULT_ACTION_VERBS = ["adjust", "adjusted", "appear", "appeared", "approach", "approached", "arrive", "arrived", "blink", "blinked", "bow", "bowed", "charge", "charged", "chase", "chased", "climb", "climbed", "collapse", "collapsed", "crawl", "crawled", "crept", "crouch", "crouched", "dance", "danced", "dart", "darted", "dash", "dashed", "depart", "departed", "dive", "dived", "dodge", "dodged", "drag", "dragged", "drift", "drifted", "drop", "dropped", "emerge", "emerged", "enter", "entered", "exit", "exited", "fall", "fell", "flee", "fled", "flinch", "flinched", "float", "floated", "fly", "flew", "follow", "followed", "freeze", "froze", "frown", "frowned", "gesture", "gestured", "giggle", "giggled", "glance", "glanced", "grab", "grabbed", "grasp", "grasped", "grin", "grinned", "groan", "groaned", "growl", "growled", "grumble", "grumbled", "grunt", "grunted", "hold", "held", "hit", "hop", "hopped", "hurry", "hurried", "jerk", "jerked", "jog", "jogged", "jump", "jumped", "kneel", "knelt", "laugh", "laughed", "lean", "leaned", "leap", "leapt", "left", "limp", "limped", "look", "looked", "lower", "lowered", "lunge", "lunged", "march", "marched", "motion", "motioned", "move", "moved", "nod", "nodded", "observe", "observed", "pace", "paced", "pause", "paused", "point", "pointed", "pop", "popped", "position", "positioned", "pounce", "pounced", "push", "pushed", "race", "raced", "raise", "raised", "reach", "reached", "retreat", "retreated", "rise", "rose", "run", "ran", "rush", "rushed", "sit", "sat", "scramble", "scrambled", "set", "shift", "shifted", "shake", "shook", "shrug", "shrugged", "shudder", "shuddered", "sigh", "sighed", "sip", "sipped", "slip", "slipped", "slump", "slumped", "smile", "smiled", "snort", "snorted", "spin", "spun", "sprint", "sprinted", "stagger", "staggered", "stare", "stared", "step", "stepped", "stand", "stood", "straighten", "straightened", "stumble", "stumbled", "swagger", "swaggered", "swallow", "swallowed", "swap", "swapped", "swing", "swung", "tap", "tapped", "throw", "threw", "tilt", "tilted", "tiptoe", "tiptoed", "take", "took", "toss", "tossed", "trudge", "trudged", "turn", "turned", "twist", "twisted", "vanish", "vanished", "wake", "woke", "walk", "walked", "wander", "wandered", "watch", "watched", "wave", "waved", "wince", "winced", "withdraw", "withdrew"];

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
    repeatSuppressMs: 800,
    tokenProcessThreshold: 60,
    mappings: [],
    detectAttribution: true,
    detectAction: true,
    detectVocative: true,
    detectPossessive: true,
    detectGeneral: false,
    attributionVerbs: [...DEFAULT_ATTRIBUTION_VERBS],
    actionVerbs: [...DEFAULT_ACTION_VERBS],
    detectionBias: 0,
};

// Top-level settings object which contains all profiles.
const DEFAULTS = {
    enabled: true,
    profiles: {
        'Default': structuredClone(PROFILE_DEFAULTS),
    },
    activeProfile: 'Default',
    focusLock: { character: null },
};

// --- REGEX HELPER FUNCTIONS ---
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parsePatternEntry(raw) { 
    const t = String(raw || '').trim(); 
    if (!t) return null; 
    const m = t.match(/^\/((?:\\.|[^\/])+)\/([gimsuy]*)$/); 
    const entry = m ? { body: m[1], flags: m[2] || '', raw: t } : { body: escapeRegex(t), flags: '', raw: t };
    return entry;
}
function computeFlagsFromEntries(entries, requireI = true) { const f = new Set(); for (const e of entries) { if (!e) continue; for (const c of (e.flags || '')) f.add(c); } if (requireI) f.add('i'); return Array.from(f).filter(c => 'gimsuy'.includes(c)).join(''); }

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
                const singleFlags = computeFlagsFromEntries([entries[i]], true);
                new RegExp(entries[i].body, singleFlags);
            } catch (err) {
                const raw = entries[i].raw || entries[i].body;
                throw new Error(`Pattern #${i+1} failed to compile: "${raw}" — ${err.message}`);
            }
        }
        throw new Error(`Combined pattern failed to compile: ${e.message}`);
    }
}

function buildNameRegex(patternList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const p = e.map(x => `(?:${x.body})`), b = `(?:^|\\n|[\\(\\[\\-—–])(?:(${p.join('|')}))(?:\\W|$)`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(b, f) } catch (err) { return console.warn("buildNameRegex compile failed:", err), null } }
function buildSpeakerRegex(patternList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const p = e.map(x => `(?:${x.body})`), b = `(?:^|\\n)\\s*(${p.join('|')})\\s*[:;,]\\s*`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(b, f) } catch (err) { return console.warn("buildSpeakerRegex compile failed:", err), null } }
function buildVocativeRegex(patternList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const p = e.map(x => `(?:${x.body})`), b = `(?:["“'\\s])(${p.join('|')})[,.!?]`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(b, f) } catch (err) { return console.warn("buildVocativeRegex compile failed:", err), null } }
function buildAttributionRegex(patternList, verbList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const n = e.map(x => `(?:${x.body})`).join("|"), v = (verbList || []).map(escapeRegex).join("|"), p = v + "(?:\\s+(?:out|back|over))?", l = "(?:\\s+[A-Z][a-z]+)*", a = `(?:["“”][^"“”]{0,400}["“”])\\s*,?\\s*(${n})${l}\\s+${p}(?:,)?`, b = `\\b(${n})${l}\\s+${p}\\s*[:,]?\\s*["“”]`, V = `(${n})${l}[’\`']s\\s+(?:[a-z]+,\\s*)?[a-z]+\\s+voice`, c = `(?:["“”][^"“”]{0,400}["“”])\\s*,?\\s*${V}`, d = `${V}[^"“]{0,150}?["“"]`, D = `\\b(${n})${l}[^"“”]{0,150}?["“”]`, B = `(?:${a})|(?:${b})|(?:${c})|(?:${d})|(?:${D})`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(B, f) } catch (err) { return console.warn("buildAttributionRegex compile failed:", err), null } }
function buildActionRegex(patternList, verbList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const n = e.map(x => `(?:${x.body})`).join("|"), a = (verbList || []).map(escapeRegex).join("|"), p = `\\b(${n})(?:\\s+[A-Z][a-z]+)*\\b(?:\\s+[a-zA-Z'’]+){0,4}?\\s+${a}\\b`, b = `\\b(${n})(?:\\s+[A-Z][a-z]+)*[’\`']s\\s+(?:[a-zA-Z'’]+\\s+){0,4}?[a-zA-Z'’]+\\s+${a}\\b`, c = `\\b(${n})(?:\\s+[A-Z][a-z]+)*[’\`']s\\s+(?:gaze|expression|hand|hands|feet|eyes|head|shoulders|body|figure|glance|smile|frown)`, B = `(?:${p})|(?:${b})|(?:${c})`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(B, f) } catch (err) { return console.warn("buildActionRegex compile failed:", err), null } }

// --- DETECTION LOGIC ---
function getQuoteRanges(s) { const q=/"|\u201C|\u201D/g,pos=[],ranges=[];let m;while((m=q.exec(s))!==null)pos.push(m.index);for(let i=0;i+1<pos.length;i+=2)ranges.push([pos[i],pos[i+1]]);return ranges }
function isIndexInsideQuotesRanges(ranges,idx){for(const[a,b]of ranges)if(idx>a&&idx<b)return!0;return!1}
function findMatches(combined,regex,quoteRanges,searchInsideQuotes=!1){if(!combined||!regex)return[];const flags=regex.flags.includes("g")?regex.flags:regex.flags+"g",re=new RegExp(regex.source,flags),results=[];let m;for(; (m=re.exec(combined))!==null;){const idx=m.index||0;(searchInsideQuotes||!isIndexInsideQuotesRanges(quoteRanges,idx))&&results.push({match:m[0],groups:m.slice(1),index:idx}),re.lastIndex===m.index&&re.lastIndex++}return results}
function findAllMatches(combined,regexes,settings,quoteRanges){const allMatches=[],{speakerRegex,attributionRegex,actionRegex,vocativeRegex,nameRegex}=regexes,priorities={speaker:5,attribution:4,action:3,vocative:2,possessive:1,name:0};if(speakerRegex&&findMatches(combined,speakerRegex,quoteRanges).forEach(m=>{const name=m.groups?.[0]?.trim();name&&allMatches.push({name,matchKind:"speaker",matchIndex:m.index,priority:priorities.speaker})}),settings.detectAttribution&&attributionRegex&&findMatches(combined,attributionRegex,quoteRanges).forEach(m=>{const name=m.groups?.find(g=>g)?.trim();name&&allMatches.push({name,matchKind:"attribution",matchIndex:m.index,priority:priorities.attribution})}),settings.detectAction&&actionRegex&&findMatches(combined,actionRegex,quoteRanges).forEach(m=>{const name=m.groups?.find(g=>g)?.trim();name&&allMatches.push({name,matchKind:"action",matchIndex:m.index,priority:priorities.action})}),settings.detectVocative&&vocativeRegex&&findMatches(combined,vocativeRegex,quoteRanges,!0).forEach(m=>{const name=m.groups?.[0]?.trim();name&&allMatches.push({name,matchKind:"vocative",matchIndex:m.index,priority:priorities.vocative})}),settings.detectPossessive&&settings.patterns?.length){const names_poss=settings.patterns.map(s=>(s||"").trim()).filter(Boolean);if(names_poss.length){const possRe=new RegExp("\\b("+names_poss.map(escapeRegex).join("|")+")[’'`']s\\b","gi");findMatches(combined,possRe,quoteRanges).forEach(m=>{const name=m.groups?.[0]?.trim();name&&allMatches.push({name,matchKind:"possessive",matchIndex:m.index,priority:priorities.possessive})})}}return settings.detectGeneral&&nameRegex&&findMatches(combined,nameRegex,quoteRanges).forEach(m=>{const name=String(m.groups?.[0]||m.match).replace(/-(?:sama|san)$/i,"").trim();name&&allMatches.push({name,matchKind:"name",matchIndex:m.index,priority:priorities.name})}),allMatches}

function findBestMatch(combined, regexes, settings, quoteRanges) {
    if (!combined) return null;
    const allMatches = findAllMatches(combined, regexes, settings, quoteRanges);
    if (allMatches.length === 0) return null;

    const bias = Number(settings.detectionBias || 0);
    const scoredMatches = allMatches.map(match => {
        const isActive = match.priority >= 3; // speaker, attribution, action
        let score = match.matchIndex + (isActive ? bias : 0);
        return { ...match, score };
    });

    scoredMatches.sort((a, b) => b.score - a.score);
    return scoredMatches[0];
}

// --- UTILITY FUNCTIONS ---
function normalizeStreamText(s){return s?String(s).replace(/[\uFEFF\u200B\u200C\u200D]/g,"").replace(/[\u2018\u2019\u201A\u201B]/g,"'").replace(/[\u201C\u201D\u201E\u201F]/g,'"').replace(/(\*\*|__|~~|`{1,3})/g,"").replace(/\u00A0/g," "):""}
function normalizeCostumeName(n){if(!n)return"";let s=String(n).trim();s.startsWith("/")&&(s=s.slice(1).trim());const first=s.split(/[\/\s]+/).filter(Boolean)[0]||s;return String(first).replace(/[-_](?:sama|san)$/i,"").trim()}
function debugLog(settings,...args){try{settings&&getActiveProfile(settings)?.debug&&console.debug.apply(console,[logPrefix].concat(args))}catch(e){}}
function getActiveProfile(settings) { return settings?.profiles?.[settings.activeProfile]; }

// --- STATE MANAGEMENT ---
const perMessageBuffers = new Map();
const perMessageStates = new Map();
const state = {
    lastIssuedCostume: null,
    lastSwitchTimestamp: 0,
    lastTriggerTimes: new Map(),
    failedTriggerTimes: new Map(),
};
let eventHandlers = {}; // To hold references to our bound event handlers

function ensureBufferLimit(){if(!(perMessageBuffers.size<=MAX_MESSAGE_BUFFERS)){for(;perMessageBuffers.size>MAX_MESSAGE_BUFFERS;){const firstKey=perMessageBuffers.keys().next().value;perMessageBuffers.delete(firstKey),perMessageStates.delete(firstKey)}}}

// --- MAIN SCRIPT LOGIC ---
jQuery(async () => {
    if (typeof executeSlashCommandsOnChatInput !== 'function') {
        console.error(`${logPrefix} FATAL: 'executeSlashCommandsOnChatInput' is not available.`);
        return;
    }

    const { store, save, ctx } = getSettingsObj();
    let settings = store[extensionName]; 

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings").append(settingsHtml);
    } catch (e) {
        console.warn(`${logPrefix} Failed to load settings.html:`, e);
        $("#extensions_settings").append(`<div><h3>Costume Switch</h3><div>Failed to load UI (see console)</div></div>`);
    }

    let compiledRegexes = {};

    function recompileRegexes() {
        try {
            const profile = getActiveProfile(settings);
            if (!profile) return;
            const lowerIgnored = (profile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
            const effectivePatterns = (profile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
            compiledRegexes = {
                nameRegex: buildNameRegex(effectivePatterns),
                speakerRegex: buildSpeakerRegex(effectivePatterns),
                attributionRegex: buildAttributionRegex(effectivePatterns, profile.attributionVerbs),
                actionRegex: buildActionRegex(effectivePatterns, profile.actionVerbs),
                vocativeRegex: buildVocativeRegex(effectivePatterns),
                vetoRegex: buildGenericRegex(profile.vetoPatterns),
            };
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
        lockSelect.empty().append($('<option>', { value: '', text: 'None' }));
        (profile.patterns || []).forEach(name => {
            const cleanName = normalizeCostumeName(name);
            if (cleanName) lockSelect.append($('<option>', { value: cleanName, text: cleanName }));
        });
        if (settings.focusLock.character) {
            lockSelect.val(settings.focusLock.character).prop("disabled", true);
            lockToggle.text("Unlock");
        } else {
            lockSelect.val('').prop("disabled", false);
            lockToggle.text("Lock");
        }
    }

    // Data-driven UI mapping
    const uiMapping = {
        patterns: { selector: '#cs-patterns', type: 'textarea' },
        ignorePatterns: { selector: '#cs-ignore-patterns', type: 'textarea' },
        vetoPatterns: { selector: '#cs-veto-patterns', type: 'textarea' },
        defaultCostume: { selector: '#cs-default', type: 'text' },
        debug: { selector: '#cs-debug', type: 'checkbox' },
        globalCooldownMs: { selector: '#cs-global-cooldown', type: 'number' },
        repeatSuppressMs: { selector: '#cs-repeat-suppress', type: 'number' },
        tokenProcessThreshold: { selector: '#cs-token-process-threshold', type: 'number' },
        detectionBias: { selector: '#cs-detection-bias', type: 'number' },
        detectAttribution: { selector: '#cs-detect-attribution', type: 'checkbox' },
        detectAction: { selector: '#cs-detect-action', type: 'checkbox' },
        detectVocative: { selector: '#cs-detect-vocative', type: 'checkbox' },
        detectPossessive: { selector: '#cs-detect-possessive', type: 'checkbox' },
        detectGeneral: { selector: '#cs-detect-general', type: 'checkbox' },
        attributionVerbs: { selector: '#cs-attribution-verbs', type: 'csvTextarea' },
        actionVerbs: { selector: '#cs-action-verbs', type: 'csvTextarea' },
    };

    function loadProfile(profileName) {
        if (!settings.profiles[profileName]) {
            console.warn(`${logPrefix} Profile "${profileName}" not found. Loading default.`);
            profileName = Object.keys(settings.profiles)[0];
        }
        settings.activeProfile = profileName;
        const profile = getActiveProfile(settings);
        $("#cs-profile-name").val(profileName);
        for (const key in uiMapping) {
            const { selector, type } = uiMapping[key];
            const value = profile[key] ?? PROFILE_DEFAULTS[key];
            switch (type) {
                case 'checkbox': $(selector).prop('checked', !!value); break;
                case 'textarea': $(selector).val((value || []).join('\n')); break;
                case 'csvTextarea': $(selector).val((value || []).join(', ')); break;
                default: $(selector).val(value); break;
            }
        }
        $("#cs-detection-bias-value").text(profile.detectionBias || PROFILE_DEFAULTS.detectionBias);
        renderMappings(profile);
        recompileRegexes();
        updateFocusLockUI();
    }

    function saveCurrentProfileData() {
        const profileData = {};
        for (const key in uiMapping) {
            const { selector, type } = uiMapping[key];
            switch (type) {
                case 'checkbox': profileData[key] = $(selector).prop('checked'); break;
                case 'textarea': profileData[key] = $(selector).val().split(/\r?\n/).map(s => s.trim()).filter(Boolean); break;
                case 'csvTextarea': profileData[key] = $(selector).val().split(',').map(s => s.trim()).filter(Boolean); break;
                case 'number': profileData[key] = parseInt($(selector).val(), 10) || 0; break;
                default: profileData[key] = $(selector).val().trim(); break;
            }
        }
        profileData.mappings = [];
        $("#cs-mappings-tbody tr").each(function () {
            const name = $(this).find(".map-name").val().trim();
            const folder = $(this).find(".map-folder").val().trim();
            if (name && folder) profileData.mappings.push({ name, folder });
        });
        return profileData;
    }

    function renderMappings(profile) {
        const tbody = $("#cs-mappings-tbody");
        tbody.empty();
        (profile.mappings || []).forEach((m, idx) => {
            tbody.append($("<tr>").attr("data-idx", idx)
                .append($("<td>").append($("<input>").addClass("map-name text_pole").val(m.name || "")))
                .append($("<td>").append($("<input>").addClass("map-folder text_pole").val(m.folder || "")))
                .append($("<td>").append($("<button>").addClass("map-remove menu_button interactable").text("Remove")))
            );
        });
    }

    function persistSettings(message) {
        if (save) save();
        $("#cs-status").text(message || `Saved ${new Date().toLocaleTimeString()}`);
        setTimeout(() => $("#cs-status").text("Ready"), 2000);
    }
    
    function testRegexPattern() {
        $("#cs-test-veto-result").text('N/A').css('color', 'var(--text-color-soft)');
        const text = $("#cs-regex-test-input").val();
        if (!text) {
            $("#cs-test-all-detections, #cs-test-winner-list").html('<li class="cs-tester-list-placeholder">Enter text to test.</li>');
            return;
        }
        const tempProfile = saveCurrentProfileData();
        const combined = normalizeStreamText(text);
        const tempVetoRegex = buildGenericRegex(tempProfile.vetoPatterns);
        if (tempVetoRegex && tempVetoRegex.test(combined)) {
            const vetoMatch = combined.match(tempVetoRegex)[0];
            $("#cs-test-veto-result").html(`Vetoed by: <b style="color: var(--red);">${vetoMatch}</b>`).css('color', 'var(--text-color)');
            $("#cs-test-all-detections, #cs-test-winner-list").html('<li class="cs-tester-list-placeholder">Message vetoed.</li>');
            return;
        }
        $("#cs-test-veto-result").text('No veto phrases matched.').css('color', 'var(--green)');
        const lowerIgnored = (tempProfile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
        const effectivePatterns = (tempProfile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
        const tempRegexes = {
            speakerRegex: buildSpeakerRegex(effectivePatterns), attributionRegex: buildAttributionRegex(effectivePatterns, tempProfile.attributionVerbs),
            actionRegex: buildActionRegex(effectivePatterns, tempProfile.actionVerbs), vocativeRegex: buildVocativeRegex(effectivePatterns),
            nameRegex: buildNameRegex(effectivePatterns)
        };
        const quoteRanges = getQuoteRanges(combined);
        const allMatches = findAllMatches(combined, tempRegexes, tempProfile, quoteRanges);
        allMatches.sort((a, b) => a.matchIndex - b.matchIndex);
        const allDetectionsList = $("#cs-test-all-detections").empty();
        if (allMatches.length > 0) {
            allMatches.forEach(m => allDetectionsList.append(`<li><b>${m.name}</b> <small>(${m.matchKind} @ ${m.matchIndex}, p: ${m.priority})</small></li>`));
        } else {
            allDetectionsList.html('<li class="cs-tester-list-placeholder">No detections found.</li>');
        }
        const winnerList = $("#cs-test-winner-list").empty();
        const winners = [];
        const words = combined.split(/(\s+)/);
        let currentBuffer = "", lastWinnerName = null;
        for (const word of words) {
            currentBuffer += word;
            const bestMatch = findBestMatch(currentBuffer, tempRegexes, tempProfile, getQuoteRanges(currentBuffer));
            if (bestMatch && bestMatch.name !== lastWinnerName) { winners.push(bestMatch); lastWinnerName = bestMatch.name; }
        }
        if (winners.length > 0) {
            winners.forEach(m => winnerList.append(`<li><b>${m.name}</b> <small>(${m.matchKind} @ ${m.matchIndex}, s: ${Math.round(m.score)})</small></li>`));
        } else {
            winnerList.html('<li class="cs-tester-list-placeholder">No winning match.</li>');
        }
    }

    function wireUI() {
        const UIEvents = {
            '#cs-enable': { on: 'change', handler: function() { settings.enabled = $(this).prop("checked"); persistSettings(); }},
            '#cs-save': { on: 'click', handler: () => { const profileData = saveCurrentProfileData(); if(profileData) { settings.profiles[settings.activeProfile] = profileData; recompileRegexes(); updateFocusLockUI(); persistSettings(); }}},
            '#cs-profile-select': { on: 'change', handler: function() { loadProfile($(this).val()); }},
            '#cs-profile-save': { on: 'click', handler: () => {
                const newName = $("#cs-profile-name").val().trim(); if (!newName) return;
                const oldName = settings.activeProfile;
                if (newName !== oldName && settings.profiles[newName]) { $("#cs-error").text("A profile with that name already exists.").show(); return; }
                const profileData = saveCurrentProfileData(); if (!profileData) return;
                if (newName !== oldName) delete settings.profiles[oldName];
                settings.profiles[newName] = profileData; settings.activeProfile = newName;
                populateProfileDropdown(); $("#cs-error").text("").hide(); persistSettings();
            }},
            '#cs-profile-delete': { on: 'click', handler: () => {
                if (Object.keys(settings.profiles).length <= 1) { $("#cs-error").text("Cannot delete the last profile.").show(); return; }
                const profileNameToDelete = settings.activeProfile;
                if (confirm(`Are you sure you want to delete the profile "${profileNameToDelete}"?`)) {
                    delete settings.profiles[profileNameToDelete];
                    settings.activeProfile = Object.keys(settings.profiles)[0];
                    populateProfileDropdown(); loadProfile(settings.activeProfile);
                    persistSettings(`Deleted profile "${profileNameToDelete}".`);
                }
            }},
            '#cs-profile-export': { on: 'click', handler: () => {
                const profile = getActiveProfile(settings);
                const profileName = settings.activeProfile;
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({name: profileName, data: profile}, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `${profileName}_costume_profile.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                persistSettings("Profile exported.");
            }},
            '#cs-profile-import': { on: 'click', handler: () => { $('#cs-profile-file-input').click(); }},
            '#cs-profile-file-input': { on: 'change', handler: function(event) {
                const file = event.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const content = JSON.parse(e.target.result);
                        if (!content.name || !content.data) throw new Error("Invalid profile format.");
                        let profileName = content.name;
                        if (settings.profiles[profileName]) {
                            profileName = `${profileName} (Imported) ${Date.now()}`;
                        }
                        settings.profiles[profileName] = Object.assign({}, structuredClone(PROFILE_DEFAULTS), content.data);
                        settings.activeProfile = profileName;
                        populateProfileDropdown();
                        loadProfile(profileName);
                        persistSettings(`Imported profile as "${profileName}".`);
                    } catch (err) {
                        $("#cs-error").text(`Import failed: ${err.message}`).show();
                    }
                };
                reader.readAsText(file);
                $(this).val(''); // Reset file input
            }},
            '#cs-focus-lock-toggle': { on: 'click', handler: async () => {
                if (settings.focusLock.character) {
                    settings.focusLock.character = null;
                    await manualReset();
                } else {
                    const selectedChar = $("#cs-focus-lock-select").val();
                    if (selectedChar) { settings.focusLock.character = selectedChar; await issueCostumeForName(selectedChar, { isLock: true }); }
                }
                updateFocusLockUI(); persistSettings();
            }},
            '#cs-detection-bias': { on: 'input change', handler: function(evt) {
                $("#cs-detection-bias-value").text($(this).val());
                if(evt.type === 'change') {
                    const profile = getActiveProfile(settings);
                    if(profile) { profile.detectionBias = parseInt($(this).val(), 10); persistSettings(); testRegexPattern(); }
                }
            }},
            '#cs-reset': { on: 'click', handler: async () => { await manualReset(); }},
            '#cs-mapping-add': { on: 'click', handler: () => { const profile = getActiveProfile(settings); if (profile) { profile.mappings = profile.mappings || []; profile.mappings.push({ name: "", folder: "" }); renderMappings(profile); }}},
            '#cs-mappings-tbody': { on: 'click', delegate: '.map-remove', handler: function() { const profile = getActiveProfile(settings); if (profile) { const idx = parseInt($(this).closest('tr').attr('data-idx'), 10); if (!isNaN(idx)) { profile.mappings.splice(idx, 1); renderMappings(profile); }}}},
            '#cs-regex-test-button': { on: 'click', handler: testRegexPattern },
        };
        for(const selector in UIEvents) {
            const { on, handler, delegate } = UIEvents[selector];
            if (delegate) { $(document).off(on, selector).on(on, selector, delegate, handler); }
            else { $(document).off(on, selector).on(on, selector, handler); }
        }
    }

    async function manualReset() {
        const profile = getActiveProfile(settings);
        const costumeArg = profile?.defaultCostume?.trim() ? `\\${profile.defaultCostume.trim()}` : '\\';
        const command = `/costume ${costumeArg}`;
        debugLog(settings, "Attempting manual reset with command:", command);
        try {
            await executeSlashCommandsOnChatInput(command);
            state.lastIssuedCostume = costumeArg;
            persistSettings(`Reset -> ${costumeArg}`);
        } catch (err) { console.error(`${logPrefix} Manual reset failed for "${costumeArg}".`, err); }
    }

    function getMappedCostume(name) {
        const profile = getActiveProfile(settings);
        if (!name || !profile) return null;
        for (const m of (profile.mappings || [])) {
            if (m?.name?.toLowerCase() === name.toLowerCase()) return m.folder?.trim() || null;
        }
        return null;
    }

    async function issueCostumeForName(name, opts = {}) {
        const profile = getActiveProfile(settings);
        if (!name || !profile) return;
        const now = Date.now();
        name = normalizeCostumeName(name);
        const matchKind = opts.matchKind || null;
        const currentName = normalizeCostumeName(state.lastIssuedCostume || profile.defaultCostume || (ctx?.characters?.[ctx.characterId]?.name) || '');
        if (!opts.isLock && currentName?.toLowerCase() === name.toLowerCase()) { debugLog(settings, "Already using costume for", name, "- skipping."); return; }
        if (!opts.isLock && now - state.lastSwitchTimestamp < (profile.globalCooldownMs ?? PROFILE_DEFAULTS.globalCooldownMs)) { debugLog(settings, "Global cooldown active, skipping switch to", name); return; }
        let argFolder = getMappedCostume(name) || name;
        if (!opts.isLock) {
            const lastSuccess = state.lastTriggerTimes.get(argFolder) || 0;
            if (now - lastSuccess < (profile.perTriggerCooldownMs ?? PROFILE_DEFAULTS.perTriggerCooldownMs)) { debugLog(settings, "Per-trigger cooldown active for", argFolder); return; }
            const lastFailed = state.failedTriggerTimes.get(argFolder) || 0;
            if (now - lastFailed < (profile.failedTriggerCooldownMs ?? PROFILE_DEFAULTS.failedTriggerCooldownMs)) { debugLog(settings, "Failed-trigger cooldown active for", argFolder); return; }
        }
        const command = `/costume \\${argFolder}`;
        debugLog(settings, "executing command:", command, "kind:", matchKind, "isLock:", !!opts.isLock);
        try {
            await executeSlashCommandsOnChatInput(command);
            state.lastTriggerTimes.set(argFolder, now);
            state.lastIssuedCostume = argFolder;
            state.lastSwitchTimestamp = now;
            persistSettings(`Switched -> ${argFolder}`);
        } catch (err) {
            state.failedTriggerTimes.set(argFolder, now);
            console.error(`${logPrefix} Failed to execute /costume command for "${argFolder}".`, err);
        }
    }

    // --- EVENT HANDLERS ---
    const handleGenerationStart = (messageId) => {
        const bufKey = messageId != null ? `m${messageId}` : 'live';
        debugLog(settings, `Generation started for ${bufKey}, resetting state.`);
        perMessageStates.set(bufKey, { lastAcceptedName: null, lastAcceptedTs: 0, vetoed: false });
        perMessageBuffers.delete(bufKey);
    };

    const handleStream = (...args) => {
        try {
            if (!settings.enabled || settings.focusLock.character) return;
            const profile = getActiveProfile(settings);
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
                debugLog(settings, "Veto phrase matched. Halting detection for this message.");
                msgState.vetoed = true; return;
            }

            const quoteRanges = getQuoteRanges(combined);
            const bestMatch = findBestMatch(combined, compiledRegexes, profile, quoteRanges);
            if (bestMatch) {
                const { name: matchedName, matchKind } = bestMatch;
                const now = Date.now();
                const suppressMs = Number(profile.repeatSuppressMs ?? PROFILE_DEFAULTS.repeatSuppressMs);
                if (msgState.lastAcceptedName?.toLowerCase() === matchedName.toLowerCase() && (now - msgState.lastAcceptedTs < suppressMs)) {
                    debugLog(settings, 'Suppressing repeat match for same name (flicker guard)', { matchedName }); return;
                }
                msgState.lastAcceptedName = matchedName;
                msgState.lastAcceptedTs = now;
                issueCostumeForName(matchedName, { matchKind, bufKey });
            }
        } catch (err) { console.error(`${logPrefix} stream handler error:`, err); }
    };
    
    const cleanupMessageState = (messageId) => { if (messageId != null) { perMessageBuffers.delete(`m${messageId}`); perMessageStates.delete(`m${messageId}`); }};
    const resetGlobalState = () => { perMessageBuffers.clear(); perMessageStates.clear(); Object.assign(state, { lastIssuedCostume: null, lastSwitchTimestamp: 0, lastTriggerTimes: new Map(), failedTriggerTimes: new Map() }); };

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
            [event_types.GENERATION_STARTED]: handleGenerationStart,
            [event_types.GENERATION_ENDED]: cleanupMessageState,
            [event_types.MESSAGE_RECEIVED]: cleanupMessageState,
            [event_types.CHAT_CHANGED]: resetGlobalState,
        };
        for (const [event, handler] of Object.entries(eventHandlers)) {
            eventSource.on?.(event, handler);
        }
    }

    // Initial setup
    $("#cs-enable").prop("checked", !!settings.enabled);
    populateProfileDropdown();
    loadProfile(settings.activeProfile);
    wireUI();
    load();
    window[`__${extensionName}_unload`] = unload;
    console.log(`${logPrefix} v1.3.0 (Refactored) loaded successfully.`);
});

function getSettingsObj() {
    const ctx = typeof getContext === 'function' ? getContext() : (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null);
    let storeSource;
    if (ctx && ctx.extensionSettings) { storeSource = ctx.extensionSettings; }
    else if (typeof extension_settings !== 'undefined') { storeSource = extension_settings; }
    else { throw new Error("Can't find SillyTavern extension settings storage."); }

    if (!storeSource[extensionName] || !storeSource[extensionName].profiles) {
        console.log(`${logPrefix} Migrating old settings to new profile format.`);
        const oldSettings = storeSource[extensionName] || {};
        const newSettings = structuredClone(DEFAULTS);
        Object.keys(PROFILE_DEFAULTS).forEach(key => {
            if (oldSettings.hasOwnProperty(key)) newSettings.profiles.Default[key] = oldSettings[key];
        });
        if (oldSettings.hasOwnProperty('enabled')) newSettings.enabled = oldSettings.enabled;
        storeSource[extensionName] = newSettings;
    }
    
    storeSource[extensionName] = Object.assign({}, structuredClone(DEFAULTS), storeSource[extensionName]);
    for (const profileName in storeSource[extensionName].profiles) {
        storeSource[extensionName].profiles[profileName] = Object.assign({}, structuredClone(PROFILE_DEFAULTS), storeSource[extensionName].profiles[profileName]);
    }
    
    return { store: storeSource, save: ctx?.saveSettingsDebounced || saveSettingsDebounced, ctx };
}
