import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, event_types, eventSource } from "../../../../script.js";
import { registerSlashCommand, executeSlashCommandsOnChatInput } from "../../../slash-commands.js";

const extensionName = "SillyTavern-CostumeSwitch-Testing";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const DEFAULT_ATTRIBUTION_VERBS = ["acknowledged", "added", "admitted", "advised", "affirmed", "agreed", "announced", "answered", "argued", "asked", "barked", "began", "bellowed", "blurted", "boasted", "bragged", "called", "chirped", "choked", "commanded", "commented", "complained", "conceded", "concluded", "confessed", "confirmed", "continued", "corrected", "countered", "cried", "croaked", "crowed", "deadpanned", "declared", "decreed", "demanded", "denied", "drawled", "echoed", "emphasized", "enquired", "enthused", "estimated", "exclaimed", "explained", "gasped", "groaned", "grunted", "hissed", "insisted", "instructed", "interjected", "interrupted", "joked", "lamented", "laughed", "lied", "maintained", "moaned", "mumbled", "murmured", "mused", "muttered", "nagged", "nodded", "noted", "objected", "offered", "ordered", "perked up", "pleaded", "pondered", "prayed", "predicted", "proclaimed", "promised", "proposed", "protested", "queried", "questioned", "quipped", "rambled", "reasoned", "reassured", "recited", "rejoined", "remarked", "repeated", "replied", "responded", "retorted", "roared", "said", "scolded", "scoffed", "screamed", "shouted", "sighed", "smiled", "snapped", "snarled", "spat", "spoke", "stammered", "stated", "stuttered", "suggested", "surmised", "tapped", "theorized", "threatened", "turned", "urged", "volunteered", "vowed", "wailed", "warned", "whimpered", "whispered", "wondered", "yelled"];
const DEFAULT_ACTION_VERBS = ["adjust", "adjusted", "appear", "appeared", "approach", "approached", "arrive", "arrived", "blink", "blinked", "bow", "bowed", "charge", "charged", "chase", "chased", "chew", "chewed", "clasp", "clasped", "clench", "clenched", "click", "clicked", "climb", "climbed", "collapse", "collapsed", "crack", "cracked", "crawl", "crawled", "crept", "cross", "crossed", "crouch", "crouched", "dance", "danced", "dart", "darted", "dash", "dashed", "deepen", "deepened", "depart", "departed", "dive", "dived", "dodge", "dodged", "drag", "dragged", "drift", "drifted", "drop", "dropped", "drum", "drummed", "emerge", "emerged", "enter", "entered", "exit", "exited", "fall", "fell", "firm", "firmed", "fix", "fixed", "flare", "flared", "flash", "flashed", "flee", "fled", "flex", "flexed", "flick", "flicked", "flicker", "flickered", "flinch", "flinched", "float", "floated", "fly", "flew", "fold", "folded", "follow", "followed", "freeze", "froze", "frown", "frowned", "furrow", "furrowed", "gesture", "gestured", "giggle", "giggled", "glance", "glanced", "glare", "glared", "grab", "grabbed", "grasp", "grasped", "grin", "grinned", "grip", "gripped", "groan", "groaned", "growl", "growled", "grumble", "grumbled", "grunt", "grunted", "hiss", "hissed", "hit", "hold", "held", "hop", "hopped", "huff", "huffed", "hurry", "hurried", "jerk", "jerked", "jog", "jogged", "jolt", "jolted", "jump", "jumped", "kneel", "knelt", "knock", "knocked", "laugh", "laughed", "lean", "leaned", "leap", "leapt", "left", "lift", "lifted", "limp", "limped", "look", "looked", "lower", "lowered", "lunge", "lunged", "march", "marched", "motion", "motioned", "move", "moved", "narrow", "narrowed", "nod", "nodded", "observe", "observed", "pace", "paced", "pause", "paused", "point", "pointed", "pop", "popped", "position", "positioned", "pounce", "pounced", "press", "pressed", "pull", "pulled", "puff", "puffed", "push", "pushed", "quiver", "quivered", "race", "raced", "raise", "raised", "reach", "reached", "retreat", "retreated", "rise", "rose", "rock", "rocked", "roll", "rolled", "rub", "rubbed", "run", "ran", "rush", "rushed", "scan", "scanned", "scowl", "scowled", "scramble", "scrambled", "scream", "screamed", "set", "shake", "shook", "shift", "shifted", "shove", "shoved", "shrug", "shrugged", "shudder", "shuddered", "sigh", "sighed", "sip", "sipped", "sit", "sat", "slam", "slammed", "slide", "slid", "slip", "slipped", "slump", "slumped", "smile", "smiled", "snap", "snapped", "snatch", "snatched", "snort", "snorted", "soften", "softened", "spin", "spun", "spread", "spreads", "squeeze", "squeezed", "sprint", "sprinted", "stagger", "staggered", "stand", "stood", "stare", "stared", "step", "stepped", "stiffen", "stiffened", "stomp", "stomped", "straighten", "straightened", "stumble", "stumbled", "swagger", "swaggered", "swallow", "swallowed", "swap", "swapped", "sweep", "swept", "swing", "swung", "tap", "tapped", "take", "took", "throw", "threw", "tighten", "tightened", "tilt", "tilted", "tiptoe", "tiptoed", "toss", "tossed", "tremble", "trembled", "trudge", "trudged", "turn", "turned", "twitch", "twitched", "twist", "twisted", "vanish", "vanished", "wake", "woke", "walk", "walked", "wander", "wandered", "watch", "watched", "wave", "waved", "widen", "widened", "wince", "winced", "withdraw", "withdrew"];

const PROFILE_DEFAULTS = {
    patterns: ["Char A", "Char B", "Char C", "Char D"],
    ignorePatterns: [],
    vetoPatterns: ["OOC:", "(OOC)"],
    defaultCostume: "",
    debug: false,
    globalCooldownMs: 1200,
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
    priorityWeight: 150,
    biasMultiplierHigh: 4,
    biasMultiplierLow: 1,
    stickinessWeight: 100,
};

const DEFAULTS = {
    enabled: true,
    profiles: {
        'Default': structuredClone(PROFILE_DEFAULTS),
    },
    activeProfile: 'Default',
    focusLock: { character: null },
};

const __regexCompileCache = new Map();
function compileRegexFromBody(body, flags = '') {
    const key = `${body}::${flags}`;
    if (__regexCompileCache.has(key)) return __regexCompileCache.get(key);
    try {
        const rx = new RegExp(body, flags);
        __regexCompileCache.set(key, rx);
        return rx;
    } catch (err) {
        __regexCompileCache.set(key, null);
        throw err;
    }
}

function normalizeCostumeName(n) {
    if (!n) return "";
    let s = String(n).trim();
    if (s.startsWith("/")) s = s.slice(1).trim();
    if (s.includes("/")) {
        const parts = s.split("/").map(p => String(p || "").trim()).filter(Boolean);
        s = parts.length ? parts[parts.length - 1] : s;
    }
    const first = (s.split(/\s+/).filter(Boolean)[0]) || s;
    return String(first).replace(/[-_](?:sama|san)$/i, "").trim();
}

function buildCostumeCommand(folder) {
    const f = normalizeCostumeName(folder);
    if (!f) return { command: `/costume`, folderName: "" };
    const needsQuotes = /[\s"']/.test(f);
    const safeFolder = needsQuotes ? `"${String(f).replace(/"/g, '\\"')}"` : f;
    return { command: `/costume ${safeFolder}`, folderName: f };
}

function getQuoteRanges(s) {
    if (!s) return [];
    const q = /["'\u2018\u2019\u201C\u201D]/g;
    const pos = [];
    let m;
    while ((m = q.exec(s)) !== null) pos.push(m.index);
    const ranges = [];
    for (let i = 0; i + 1 < pos.length; i += 2) ranges.push([pos[i], pos[i + 1]]);
    if (pos.length % 2 === 1) ranges.push([pos[pos.length - 1], s.length]);
    return ranges;
}

function isIndexInsideQuotesRanges(ranges, idx) {
    for (const [a, b] of ranges) if (idx >= a && idx <= b) return true;
    return false;
}

function findMatches(combined, regex, quoteRanges, allowInsideQuotes = false) {
    if (!combined || !regex) return [];
    const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
    const re = compileRegexFromBody(regex.source, flags);
    if (!re) return [];
    const results = [];
    let m;
    while ((m = re.exec(combined)) !== null) {
        const idx = m.index || 0;
        if (!allowInsideQuotes && isIndexInsideQuotesRanges(quoteRanges, idx)) {
            if (re.lastIndex === m.index) re.lastIndex++;
            continue;
        }
        results.push({
            match: m[0],
            index: idx,
            matchIndex: idx,
            groupsArray: Array.prototype.slice.call(m).slice(1),
            groups: m.groups || null,
            matchLength: (m[0] || '').length
        });
        if (re.lastIndex === m.index) re.lastIndex++;
    }
    return results;
}

function getMatchedName(matchObjOrArray) {
    if (!matchObjOrArray) return null;
    if (typeof matchObjOrArray === 'object' && !Array.isArray(matchObjOrArray)) {
        const mo = matchObjOrArray;
        if (mo.groups && typeof mo.groups === 'object') {
            for (const key of ['name','character','char']) {
                if (mo.groups[key]) return String(mo.groups[key]).trim();
            }
            for (const v of Object.values(mo.groups)) {
                if (v) return String(v).trim();
            }
        }
        if (Array.isArray(mo.groupsArray) && mo.groupsArray.length) {
            for (const g of mo.groupsArray) if (g) return String(g).trim();
        }
        if (typeof mo.match === 'string' && mo.match.trim()) return mo.match.trim();
        return null;
    }
    if (Array.isArray(matchObjOrArray)) {
        for (const g of matchObjOrArray) if (g) return String(g).trim();
        return null;
    }
    return null;
}

function findBestMatchFromList(combined, matches = [], settings = {}, lastAcceptedName = null) {
    if (!combined || !matches || matches.length === 0) return null;
    const bufferLen = Math.max(1, combined.length);
    const profile = getActiveProfile(settings) || {};
    const bias = Number(profile.detectionBias || 0);
    const PRIORITY_WEIGHT = Number(profile.priorityWeight || 150);
    const BIAS_MULT_HIGH = Number(profile.biasMultiplierHigh || 4);
    const BIAS_MULT_LOW = Number(profile.biasMultiplierLow || 1);
    const STICKINESS_BONUS = Number(profile.stickinessWeight || 100);
    const lastAcceptedCanonical = lastAcceptedName ? normalizeCostumeName(lastAcceptedName).toLowerCase() : null;
    const scored = matches.map(m => {
        const recencyNorm = (m.matchIndex / bufferLen) * 1000;
        let score = (m.priority * PRIORITY_WEIGHT) + recencyNorm;
        score += bias * (m.priority >= 3 ? BIAS_MULT_HIGH : BIAS_MULT_LOW);
        score += Math.min(50, m.matchLength || 0);
        const candidateCanonical = (m.canonicalName || normalizeCostumeName(m.name)).toLowerCase();
        if (lastAcceptedCanonical && candidateCanonical === lastAcceptedCanonical) {
            score += STICKINESS_BONUS;
        }
        return { ...m, score, recencyNorm, candidateCanonical };
    });
    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.matchIndex - a.matchIndex;
    });
    debugLog(settings, 'Top detection candidates:', scored.slice(0,3).map(s=>`${s.name}[${s.matchKind}] idx:${s.matchIndex} pr:${s.priority} sc:${Math.round(s.score)}`));
    return scored[0] || null;
}

function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
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
function buildGenericRegex(patternList) {
    const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!entries.length) return null;
    const parts = entries.map(e => `(?:${e.body})`);
    const body = `(?:${parts.join('|')})`;
    const flags = computeFlagsFromEntries(entries, true);
    try {
        return compileRegexFromBody(body, flags);
    } catch (e) {
        throw new Error(`Pattern failed to compile: ${e.message}`);
    }
}
function buildSpeakerRegex(patternList) {
    const e = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!e.length) return null;
    const p = e.map(x => `(?:${x.body})`);
    const b = `(?:^|\\n)\\s*(${p.join('|')})\\s*[:;,]\\s*`;
    const f = computeFlagsFromEntries(e, true);
    try { return compileRegexFromBody(b, f) } catch (err) { console.warn("buildSpeakerRegex failed:", err); return null; }
}
function buildVocativeRegex(patternList) {
    const e = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!e.length) return null;
    const p = e.map(x => `(?:${x.body})`);
    const b = `(?:["“'\\s])(${p.join('|')})[,.!?]`;
    const f = computeFlagsFromEntries(e, true);
    try { return compileRegexFromBody(b, f) } catch (err) { console.warn("buildVocativeRegex failed:", err); return null; }
}
function buildAttributionRegex(patternList, verbList) {
    const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!entries.length) return null;
    const names = entries.map(x => `(?:${x.body})`).join("|");
    const verbs = (verbList || []).map(escapeRegex).join("|");
    if (!verbs) return null;
    const postQuote = `(?:["“”][^"“”]*["“”])\\s*[,:;\\-–—]?\\s*(${names})\\s+(?:${verbs})\\b`;
    const preQuote = `\\b(${names})\\s+(?:${verbs})\\s*[:,]?\\s*["“”]`;
    const body = `(?:${postQuote})|(?:${preQuote})`;
    const flags = computeFlagsFromEntries(entries, true);
    try { return compileRegexFromBody(body, flags) } catch (err) { console.warn("buildAttributionRegex failed:", err); return null; }
}
function buildActionRegex(patternList, verbList) {
    const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!entries.length) return null;
    const names = entries.map(x => `(?:${x.body})`).join("|");
    const verbs = (verbList || []).map(escapeRegex).join("|");
    if (!verbs) return null;
    const possessivePronouns = 'his|her|its|their';
    const directAction = `\\b(?<name>${names})(?:\\s+\\w+)?\\s+(?:${verbs})\\b`;
    const possessiveAction = `\\b(?:${possessivePronouns}|(?<name2>${names})[’'\`’]s)\\s+\\w+\\s+(?:${verbs})\\b`;
    const body = `(?:${directAction})|(?:${possessiveAction})`;
    const flags = computeFlagsFromEntries(entries, true);
    try { return compileRegexFromBody(body, flags) } catch (err) { console.warn("buildActionRegex failed:", err); return null; }
}

function findAllMatches(combined, regexes, settings, quoteRanges) {
    const allMatches = [];
    const { speakerRegex, attributionRegex, actionRegex, vocativeRegex } = regexes || {};
    const priorities = { speaker: 5, attribution: 4, action: 3, vocative: 2, possessive: 1, name: 1 };
    const pushFromMatches = (ms, kind, priority) => {
        ms.forEach(m => {
            const name = getMatchedName(m);
            if (!name) return;
            const canonicalName = normalizeCostumeName(name);
            allMatches.push({ name, canonicalName, matchKind: kind, matchIndex: m.matchIndex, priority, matchText: m.match, matchLength: m.matchLength });
        });
    };
    if (speakerRegex) pushFromMatches(findMatches(combined, speakerRegex, quoteRanges, false), "speaker", priorities.speaker);
    if (settings?.detectAttribution && attributionRegex) pushFromMatches(findMatches(combined, attributionRegex, quoteRanges, false), "attribution", priorities.attribution);
    if (settings?.detectAction && actionRegex) pushFromMatches(findMatches(combined, actionRegex, quoteRanges, false), "action", priorities.action);
    if (settings?.detectVocative && vocativeRegex) pushFromMatches(findMatches(combined, vocativeRegex, quoteRanges, true), "vocative", priorities.vocative);
    if (settings?.detectPossessive && settings.patterns?.length) {
        const body = `\\b(${(settings.patterns || []).map(p => parsePatternEntry(p)?.body).filter(Boolean).join("|")})[’\`'’]s\\b`;
        const possRe = compileRegexFromBody(body, "gi");
        if (possRe) {
             pushFromMatches(findMatches(combined, possRe, quoteRanges, false), "possessive", priorities.possessive);
        }
    }
    if (settings?.detectGeneral) {
        const nameRegex = buildGenericRegex(settings.patterns);
        if (nameRegex) pushFromMatches(findMatches(combined, nameRegex, quoteRanges, false), "name", priorities.name);
    }
    return allMatches;
}

function makeBufferSignature(s, tailLen = 512) {
    if (!s) return '';
    const tail = s.length > tailLen ? s.slice(-tailLen) : s;
    return `${s.length}-${tail.slice(0,8)}-${tail.slice(-8)}`;
}
function shouldProcessBufferForKey(combined, bufKey) {
    const sig = makeBufferSignature(combined, 800);
    const state = perMessageStates.get(bufKey);
    if (!state) return true;
    if (state.lastProcessedSig === sig) return false;
    state.lastProcessedSig = sig;
    return true;
}

function waitForSelector(selector, timeout = 3000) {
    return new Promise(resolve => {
        try {
            const el = document.querySelector(selector);
            if (el) return resolve(true);
            const observer = new MutationObserver((mutations, obs) => {
                if (document.querySelector(selector)) { obs.disconnect(); resolve(true); }
            });
            observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
            setTimeout(() => { try { observer.disconnect(); } catch(e){}; resolve(Boolean(document.querySelector(selector))); }, timeout);
        } catch (e) {
            const iv = setInterval(() => {
                if (document.querySelector(selector)) { clearInterval(iv); resolve(true); }
            }, 120);
            setTimeout(() => { clearInterval(iv); resolve(Boolean(document.querySelector(selector))); }, timeout);
        }
    });
}

const normalizeStreamText = (s) => s ? String(s).replace(/[\uFEFF\u200B\u200C\u200D]/g, "").replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/(\*\*|__|~~|`{1,3})/g, "").replace(/\u00A0/g, " ") : "";
const perMessageBuffers = new Map, perMessageStates = new Map;
let lastIssuedCostume = null;
let lastIssuedCharacter = null;
let lastSwitchTimestamp = 0;
const lastTriggerTimes = new Map;
let _streamHandler = null, _genStartHandler = null, _genEndHandler = null, _chatChangedHandler = null;
const MAX_MESSAGE_BUFFERS = 60;
function ensureBufferLimit() { if (perMessageBuffers.size > MAX_MESSAGE_BUFFERS) { const firstKey = perMessageBuffers.keys().next().value; perMessageBuffers.delete(firstKey); perMessageStates.delete(firstKey); } }

function debugLog(settings, ...args) { if (settings && getActiveProfile(settings)?.debug) console.debug("[CostumeSwitch]", ...args); }
function getActiveProfile(settings) { return settings?.profiles?.[settings.activeProfile]; }

jQuery(async () => {
    const { store, save, ctx } = getSettingsObj();
    let settings = store[extensionName];
    try {
        $("#extensions_settings").append(await $.get(`${extensionFolderPath}/settings.html`));
    } catch (e) {
        console.warn("Failed to load settings.html:", e);
        $("#extensions_settings").append('<div><h3>Costume Switch</h3><p>Failed to load UI.</p></div>');
    }
    await waitForSelector("#cs-save");
    let speakerRegex, attributionRegex, actionRegex, vocativeRegex, vetoRegex;
    function recompileRegexes() {
        try {
            const profile = getActiveProfile(settings);
            if (!profile) return;
            __regexCompileCache.clear();
            const lowerIgnored = (profile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
            const effectivePatterns = (profile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
            speakerRegex = buildSpeakerRegex(effectivePatterns);
            attributionRegex = buildAttributionRegex(effectivePatterns, profile.attributionVerbs);
            actionRegex = buildActionRegex(effectivePatterns, profile.actionVerbs);
            vocativeRegex = buildVocativeRegex(effectivePatterns);
            vetoRegex = buildGenericRegex(profile.vetoPatterns);
            $("#cs-error").text("").hide();
        } catch (e) {
            $("#cs-error").text(`Pattern error: ${e.message}`).show();
        }
    }
    function populateProfileDropdown() {
        const select = $("#cs-profile-select");
        select.empty();
        Object.keys(settings.profiles).forEach(name => select.append($('<option>', { value: name, text: name })));
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
    function loadProfile(profileName) {
        settings.activeProfile = settings.profiles[profileName] ? profileName : Object.keys(settings.profiles)[0];
        const profile = getActiveProfile(settings);
        $("#cs-profile-name").val(settings.activeProfile);
        $("#cs-patterns").val((profile.patterns || []).join("\n"));
        $("#cs-ignore-patterns").val((profile.ignorePatterns || []).join("\n"));
        $("#cs-veto-patterns").val((profile.vetoPatterns || []).join("\n"));
        $("#cs-default").val(profile.defaultCostume || "");
        $("#cs-debug").prop("checked", !!profile.debug);
        $("#cs-global-cooldown").val(profile.globalCooldownMs);
        $("#cs-repeat-suppress").val(profile.repeatSuppressMs);
        $("#cs-token-process-threshold").val(profile.tokenProcessThreshold);
        $("#cs-detection-bias").val(profile.detectionBias);
        $("#cs-detection-bias-value").text(profile.detectionBias);
        $("#cs-priority-weight").val(profile.priorityWeight);
        $("#cs-stickiness-weight").val(profile.stickinessWeight);
        $("#cs-bias-mult-high").val(profile.biasMultiplierHigh);
        $("#cs-bias-mult-low").val(profile.biasMultiplierLow);
        $("#cs-detect-attribution").prop("checked", !!profile.detectAttribution);
        $("#cs-detect-action").prop("checked", !!profile.detectAction);
        $("#cs-detect-vocative").prop("checked", !!profile.detectVocative);
        $("#cs-detect-possessive").prop("checked", !!profile.detectPossessive);
        $("#cs-detect-general").prop("checked", !!profile.detectGeneral);
        $("#cs-attribution-verbs").val((profile.attributionVerbs || []).join(', '));
        $("#cs-action-verbs").val((profile.actionVerbs || []).join(', '));
        renderMappings(profile);
        recompileRegexes();
        updateFocusLockUI();
    }
    function renderMappings(profile) {
        const tbody = $("#cs-mappings-tbody").empty();
        (profile.mappings || []).forEach((m, idx) => {
            tbody.append(
                $("<tr>").attr("data-idx", idx)
                    .append($("<td>").append($("<input>").addClass("map-name text_pole").val(m.name || "")))
                    .append($("<td>").append($("<input>").addClass("map-folder text_pole").val(m.folder || "")))
                    .append($("<td>").append($("<button>").addClass("map-remove menu_button interactable").text("Remove")))
            );
        });
    }
    function persistSettings() {
        save();
        $("#cs-status").text(`Saved ${new Date().toLocaleTimeString()}`);
        setTimeout(() => $("#cs-status").text("Ready"), 1500);
    }
    $("#cs-enable").prop("checked", !!settings.enabled);
    populateProfileDropdown();
    loadProfile(settings.activeProfile);
    function testRegexPattern() {
        const text = $("#cs-regex-test-input").val();
        const allDetectionsList = $("#cs-test-all-detections").empty();
        const winnerList = $("#cs-test-winner-list").empty();
        $("#cs-test-veto-result").text('N/A').css('color', 'var(--text-color-soft)');
        if (!text) {
            allDetectionsList.html('<li style="color: var(--text-color-soft);">Enter text.</li>');
            winnerList.html('<li style="color: var(--text-color-soft);">N/A</li>');
            return;
        }
        const tempProfile = saveCurrentProfileData();
        const tempVetoRegex = buildGenericRegex(tempProfile.vetoPatterns);
        const combined = normalizeStreamText(text);
        if (tempVetoRegex && tempVetoRegex.test(combined)) {
            const v = combined.match(tempVetoRegex);
            const vetoText = v ? v[0] : 'Unknown Pattern';
            $("#cs-test-veto-result").html(`Vetoed by: <b style="color: var(--red);">${vetoText}</b>`);
            return;
        } else {
            $("#cs-test-veto-result").text('No veto match.').css('color', 'var(--green)');
        }
        const lowerIgnored = (tempProfile.ignorePatterns || []).map(p => p.trim().toLowerCase());
        const effectivePatterns = tempProfile.patterns.filter(p => !lowerIgnored.includes(p.trim().toLowerCase()));
        const tempRegexes = { speakerRegex: buildSpeakerRegex(effectivePatterns), attributionRegex: buildAttributionRegex(effectivePatterns, tempProfile.attributionVerbs), actionRegex: buildActionRegex(effectivePatterns, tempProfile.actionVerbs), vocativeRegex: buildVocativeRegex(effectivePatterns) };
        const quoteRanges = getQuoteRanges(combined);
        const allMatches = findAllMatches(combined, tempRegexes, tempProfile, quoteRanges);
        allMatches.sort((a, b) => a.matchIndex - b.matchIndex);
        if (allMatches.length) {
            allMatches.forEach(m => allDetectionsList.append(`<li><b>${m.name}</b> <small>(${m.matchKind} @ ${m.matchIndex})</small></li>`));
        } else {
            allDetectionsList.html('<li style="color: var(--text-color-soft);">No detections.</li>');
        }
        const winner = findBestMatchFromList(combined, allMatches, { profiles: { 'temp': tempProfile }, activeProfile: 'temp' });
        if(winner) {
            winnerList.append(`<li><b>${winner.name}</b> <small>(${winner.matchKind} @ ${winner.matchIndex}, score: ${Math.round(winner.score)})</small></li>`);
        } else {
             winnerList.html('<li style="color: var(--text-color-soft);">No winning match.</li>');
        }
    }
    function saveCurrentProfileData() {
        return {
            patterns: $("#cs-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            ignorePatterns: $("#cs-ignore-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            vetoPatterns: $("#cs-veto-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean),
            defaultCostume: $("#cs-default").val().trim(),
            debug: $("#cs-debug").prop("checked"),
            globalCooldownMs: parseInt($("#cs-global-cooldown").val(), 10),
            repeatSuppressMs: parseInt($("#cs-repeat-suppress").val(), 10),
            tokenProcessThreshold: parseInt($("#cs-token-process-threshold").val(), 10),
            detectionBias: parseInt($("#cs-detection-bias").val(), 10),
            priorityWeight: parseInt($("#cs-priority-weight").val(), 10),
            stickinessWeight: parseInt($("#cs-stickiness-weight").val(), 10),
            biasMultiplierHigh: parseFloat($("#cs-bias-mult-high").val()),
            biasMultiplierLow: parseFloat($("#cs-bias-mult-low").val()),
            detectAttribution: $("#cs-detect-attribution").prop("checked"),
            detectAction: $("#cs-detect-action").prop("checked"),
            detectVocative: $("#cs-detect-vocative").prop("checked"),
            detectPossessive: $("#cs-detect-possessive").prop("checked"),
            detectGeneral: $("#cs-detect-general").prop("checked"),
            attributionVerbs: $("#cs-attribution-verbs").val().split(/[\n,]/).map(s => s.trim()).filter(Boolean),
            actionVerbs: $("#cs-action-verbs").val().split(/[\n,]/).map(s => s.trim()).filter(Boolean),
            mappings: Array.from($("#cs-mappings-tbody tr")).map(tr => ({ name: $(tr).find(".map-name").val().trim(), folder: $(tr).find(".map-folder").val().trim() })).filter(m => m.name && m.folder),
        };
    }
    function setupEventHandlers() {
        $(document)
            .on("change.cs", "#cs-enable", function () { settings.enabled = $(this).prop("checked"); persistSettings(); })
            .on("click.cs", "#cs-save", () => {
                const profileData = saveCurrentProfileData();
                if (profileData) {
                    settings.profiles[settings.activeProfile] = profileData;
                    recompileRegexes();
                    updateFocusLockUI();
                    persistSettings();
                }
            })
            .on("change.cs", "#cs-profile-select", function () { loadProfile($(this).val()); })
            .on("click.cs", "#cs-profile-save", () => {
                const newName = $("#cs-profile-name").val().trim();
                if (!newName) return;
                const profileData = saveCurrentProfileData();
                settings.profiles[newName] = profileData;
                settings.activeProfile = newName;
                populateProfileDropdown();
                persistSettings();
            })
            .on("click.cs", "#cs-profile-delete", () => {
                if (Object.keys(settings.profiles).length <= 1) return;
                if (confirm(`Delete profile "${settings.activeProfile}"?`)) {
                    delete settings.profiles[settings.activeProfile];
                    settings.activeProfile = Object.keys(settings.profiles)[0];
                    populateProfileDropdown();
                    loadProfile(settings.activeProfile);
                    persistSettings();
                }
            })
            .on("click.cs", "#cs-focus-lock-toggle", async () => {
                if (settings.focusLock.character) {
                    settings.focusLock.character = null;
                    await manualReset();
                } else {
                    const selectedChar = $("#cs-focus-lock-select").val();
                    if (selectedChar) {
                        settings.focusLock.character = selectedChar;
                        await issueCostumeForName(selectedChar, { isLock: true });
                    }
                }
                updateFocusLockUI();
                persistSettings();
            })
            .on('input.cs', "#cs-detection-bias", function() { $("#cs-detection-bias-value").text($(this).val()); })
            .on("click.cs", "#cs-reset", manualReset)
            .on("click.cs", "#cs-mapping-add", () => {
                const profile = getActiveProfile(settings);
                if (profile) {
                    if (!profile.mappings) profile.mappings = [];
                    profile.mappings.push({ name: "", folder: "" });
                    renderMappings(profile);
                }
            })
            .on("click.cs", ".map-remove", function () {
                const profile = getActiveProfile(settings);
                if (profile) {
                    const idx = $(this).closest('tr').data('idx');
                    profile.mappings.splice(idx, 1);
                    renderMappings(profile);
                }
            })
            .on("click.cs", "#cs-regex-test-button", testRegexPattern);
    }
    setupEventHandlers();
    function getMappedCostume(name) {
        const profile = getActiveProfile(settings);
        if (!name || !profile?.mappings) return null;
        const target = normalizeCostumeName(name).toLowerCase();
        for (const m of profile.mappings) {
            if (normalizeCostumeName(m.name).toLowerCase() === target) {
                return normalizeCostumeName(m.folder);
            }
        }
        return null;
    }

    async function issueCostumeForName(name, opts = {}) {
        const profile = getActiveProfile(settings);
        if (!name || !profile) return;
        const now = Date.now();
        const normalizedName = normalizeCostumeName(name);
        const currentName = lastIssuedCharacter || normalizeCostumeName(profile.defaultCostume || ctx?.characters?.[ctx.characterId]?.name || '');
        if (!opts.isLock && currentName.toLowerCase() === normalizedName.toLowerCase()) {
            debugLog(settings, "Already using costume for", normalizedName); return;
        }
        if (!opts.isLock && now - lastSwitchTimestamp < profile.globalCooldownMs) {
            debugLog(settings, "Global cooldown active, skipping", normalizedName); return;
        }
        const argFolder = getMappedCostume(normalizedName) || normalizedName;
        const { command, folderName } = buildCostumeCommand(argFolder);
        if (!opts.isLock && now - (lastTriggerTimes.get(folderName) || 0) < profile.repeatSuppressMs) {
            debugLog(settings, "Repeat suppression active for", folderName); return;
        }
        debugLog(settings, "Executing:", command, "kind:", opts.matchKind, "isLock:", !!opts.isLock);
        try {
            await executeSlashCommandsOnChatInput(command);
            lastTriggerTimes.set(folderName, now);
            lastIssuedCostume = folderName;
            lastIssuedCharacter = normalizedName;
            lastSwitchTimestamp = now;
            $("#cs-status").text(`Switched -> ${folderName}`).show();
        } catch (err) {
            console.error(`[CostumeSwitch] Failed to execute /costume for "${folderName}".`, err);
        }
    }
    
    async function manualReset() {
        const profile = getActiveProfile(settings);
        const cmdObj = buildCostumeCommand(profile?.defaultCostume?.trim());
        const command = cmdObj.command;
        debugLog(settings, "Attempting manual reset with command:", command);
        try {
            await executeSlashCommandsOnChatInput(command);
            lastIssuedCostume = cmdObj.folderName || "";
            lastIssuedCharacter = null;
            $("#cs-status").text(`Reset -> ${cmdObj.folderName || "(none)"}`);
            setTimeout(() => $("#cs-status").text("Ready"), 1500);
        } catch (err) {
            console.error(`[CostumeSwitch] Manual reset failed for "${cmdObj.folderName}".`, err);
        }
    }
    
    const streamEventName = event_types?.STREAM_TOKEN_RECEIVED || event_types?.SMOOTH_STREAM_TOKEN_RECEIVED || 'stream_token_received';
    _genStartHandler = (messageId) => {
        const bufKey = messageId != null ? `m${messageId}` : 'live';
        perMessageStates.set(bufKey, { lastAcceptedName: null, vetoed: false, nextThreshold: 0, lastProcessedSig: null });
        perMessageBuffers.delete(bufKey);
    };
    _streamHandler = (...args) => {
        try {
            if (!settings.enabled || settings.focusLock.character) return;
            const profile = getActiveProfile(settings);
            if (!profile) return;
            const tokenText = typeof args[0] === 'object' ? String(args[0].token ?? '') : String(args[1] ?? '');
            const messageId = typeof args[0] === 'object' ? args[0].messageId : args[0];
            if (!tokenText) return;
            const bufKey = messageId != null ? `m${messageId}` : 'live';
            if (!perMessageStates.has(bufKey)) _genStartHandler(messageId);
            const state = perMessageStates.get(bufKey);
            if (state.vetoed) return;
            const prev = perMessageBuffers.get(bufKey) || "";
            const combined = (prev + normalizeStreamText(tokenText)).slice(-2000);
            perMessageBuffers.set(bufKey, combined);
            ensureBufferLimit();
            if (!shouldProcessBufferForKey(combined, bufKey)) return;
            if (combined.length < state.nextThreshold) return;
            state.nextThreshold = combined.length + profile.tokenProcessThreshold;
            if (vetoRegex && vetoRegex.test(combined)) {
                state.vetoed = true; return;
            }
            const quoteRanges = getQuoteRanges(combined);
            const regexes = { speakerRegex, attributionRegex, actionRegex, vocativeRegex };
            const allMatches = findAllMatches(combined, regexes, profile, quoteRanges);
            const bestMatch = findBestMatchFromList(combined, allMatches, settings, state.lastAcceptedName);
            const lastAcceptedCanonical = state.lastAcceptedName ? normalizeCostumeName(state.lastAcceptedName).toLowerCase() : null;
            if (bestMatch && bestMatch.canonicalName.toLowerCase() !== lastAcceptedCanonical) {
                state.lastAcceptedName = bestMatch.name;
                issueCostumeForName(bestMatch.name, { matchKind: bestMatch.matchKind });
            }
        } catch (err) { console.error("CostumeSwitch stream handler error:", err); }
    };
    _genEndHandler = (messageId) => { if (messageId != null) { perMessageBuffers.delete(`m${messageId}`); perMessageStates.delete(`m${messageId}`); } };
    _chatChangedHandler = () => {
        perMessageBuffers.clear();
        perMessageStates.clear();
        lastIssuedCostume = null;
        lastIssuedCharacter = null;
        lastTriggerTimes.clear();
        try { __regexCompileCache.clear(); } catch(e) {}
    };
    function unload() {
        eventSource.off(streamEventName, _streamHandler);
        eventSource.off(event_types.GENERATION_STARTED, _genStartHandler);
        eventSource.off(event_types.GENERATION_ENDED, _genEndHandler);
        eventSource.off(event_types.CHAT_CHANGED, _chatChangedHandler);
        $(document).off('.cs');
    }
    eventSource.on(streamEventName, _streamHandler);
    eventSource.on(event_types.GENERATION_STARTED, _genStartHandler);
    eventSource.on(event_types.GENERATION_ENDED, _genEndHandler);
    eventSource.on(event_types.CHAT_CHANGED, _chatChangedHandler);

    try {
        registerSlashCommand?.({
            name: 'scene',
            description: 'Switch scene (forwards to engine)',
            handler: async (args) => {
                const argText = Array.isArray(args) ? args.join(' ') : String(args || '');
                await executeSlashCommandsOnChatInput(`/scene ${argText}`.trim());
            }
        });
    } catch (e) {
        console.warn("[CostumeSwitch] registerSlashCommand for /scene failed (ignored):", e);
    }

    console.log("SillyTavern-CostumeSwitch v1.4.0 (Hybrid) loaded.");
});

function getSettingsObj() {
    const ctx = getContext();
    const storeSource = ctx.extensionSettings;
    if (!storeSource[extensionName] || !storeSource[extensionName].profiles) {
        const oldSettings = storeSource[extensionName] || {};
        const newSettings = structuredClone(DEFAULTS);
        Object.keys(PROFILE_DEFAULTS).forEach(key => {
            if (oldSettings.hasOwnProperty(key)) newSettings.profiles.Default[key] = oldSettings[key];
        });
        if (oldSettings.hasOwnProperty('enabled')) newSettings.enabled = oldSettings.enabled;
        storeSource[extensionName] = newSettings;
    }
    storeSource[extensionName] = Object.assign({}, structuredClone(DEFAULTS), storeSource[extensionName]);
    if (typeof storeSource[extensionName].focusLock !== 'object' || storeSource[extensionName].focusLock === null) {
        storeSource[extensionName].focusLock = structuredClone(DEFAULTS.focusLock);
    }
    for (const profileName in storeSource[extensionName].profiles) {
        storeSource[extensionName].profiles[profileName] = Object.assign({}, structuredClone(PROFILE_DEFAULTS), storeSource[extensionName].profiles[profileName]);
    }
    return { store: storeSource, save: saveSettingsDebounced, ctx };
}
