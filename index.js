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
    repeatSuppressMs: 800,
    tokenProcessThreshold: 60,
    detectionBias: 0,
    mappings: [],
    detectAttribution: true,
    detectAction: true,
    detectVocative: true,
    detectPossessive: true,
    detectGeneral: false,
    attributionVerbs: "acknowledged|added|admitted|advised|affirmed|agreed|announced|answered|argued|asked|barked|began|bellowed|blurted|boasted|bragged|called|chirped|commanded|commented|complained|conceded|concluded|confessed|confirmed|continued|countered|cried|croaked|crowed|declared|decreed|demanded|denied|drawled|echoed|emphasized|enquired|enthused|estimated|exclaimed|explained|gasped|insisted|instructed|interjected|interrupted|joked|lamented|lied|maintained|moaned|mumbled|murmured|mused|muttered|nagged|nodded|noted|objected|offered|ordered|perked up|pleaded|prayed|predicted|proclaimed|promised|proposed|protested|queried|questioned|quipped|rambled|reasoned|reassured|recited|rejoined|remarked|repeated|replied|responded|retorted|roared|said|scolded|scoffed|screamed|shouted|sighed|snapped|snarled|spoke|stammered|stated|stuttered|suggested|surmised|tapped|threatened|turned|urged|vowed|wailed|warned|whimpered|whispered|wondered|yelled",
    actionVerbs: "adjust|adjusted|appear|appeared|approach|approached|arrive|arrived|blink|blinked|bow|bowed|charge|charged|chase|chased|climb|climbed|collapse|collapsed|crawl|crawled|crept|crouch|crouched|dance|danced|dart|darted|dash|dashed|depart|departed|dive|dived|dodge|dodged|drag|dragged|drift|drifted|drop|dropped|emerge|emerged|enter|entered|exit|exited|fall|fell|flee|fled|flinch|flinched|float|floated|fly|flew|follow|followed|freeze|froze|frown|frowned|gesture|gestured|giggle|giggled|glance|glanced|grab|grabbed|grasp|grasped|grin|grinned|groan|groaned|growl|growled|grumble|grumbled|grunt|grunted|hold|held|hit|hop|hopped|hurry|hurried|jerk|jerked|jog|jogged|jump|jumped|kneel|knelt|laugh|laughed|lean|leaned|leap|leapt|left|limp|limped|look|looked|lower|lowered|lunge|lunged|march|marched|motion|motioned|move|moved|nod|nodded|observe|observed|pace|paced|pause|paused|point|pointed|pop|popped|position|positioned|pounce|pounced|push|pushed|race|raced|raise|raised|reach|reached|retreat|retreated|rise|rose|run|ran|rush|rushed|sit|sat|scramble|scrambled|set|shift|shifted|shake|shook|shrug|shrugged|shudder|shuddered|sigh|sighed|sip|sipped|slip|slipped|slump|slumped|smile|smiled|snort|snorted|spin|spun|sprint|sprinted|stagger|staggered|stare|stared|step|stepped|stand|stood|straighten|straightened|stumble|stumbled|swagger|swaggered|swallow|swallowed|swap|swapped|swing|swung|tap|tapped|throw|threw|tilt|tilted|tiptoe|tiptoed|take|took|toss|tossed|trudge|trudged|turn|turned|twist|twisted|vanish|vanished|wake|woke|walk|walked|wander|wandered|watch|watched|wave|waved|wince|winced|withdraw|withdrew"
};

const DEFAULTS = {
    enabled: true,
    profiles: { 'Default': structuredClone(PROFILE_DEFAULTS) },
    activeProfile: 'Default',
    focusLock: '',
};

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

function buildNameRegex(patternList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const p = e.map(x => `(?:${x.body})`), b = `(?:^|\\n|[\\(\\[\\-—–])(?:(${p.join('|')}))(?:\\W|$)`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(b, f) } catch (err) { console.warn("buildNameRegex compile failed:", err); return null } }
function buildSpeakerRegex(patternList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const p = e.map(x => `(?:${x.body})`), b = `(?:^|\\n)\\s*(${p.join('|')})\\s*[:;,]\\s*`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(b, f) } catch (err) { console.warn("buildSpeakerRegex compile failed:", err); return null } }
function buildVocativeRegex(patternList) { const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const p = e.map(x => `(?:${x.body})`), b = `(?:["“'\\s])(${p.join('|')})[,.!?]`, f = computeFlagsFromEntries(e, !0); try { return new RegExp(b, f) } catch (err) { console.warn("buildVocativeRegex compile failed:", err); return null } }


function buildUnifiedAttributionRegex(patternList, verbString) {
    const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null;
    const names = e.map(x => `(?:${x.body})`).join("|");
    const verbs = processVerbsForRegex(verbString);
    if (!verbs) return null;
    const optionalMiddleName = `(?:\s+[A-Z][a-z]+)*`;

    // post-quote: "..." [optional punctuation] Name [MiddleName] verb
    const postQuote = `(?:["“”][^"“”]*["“”])\s*[,:;\-–—]?\s*(${names})${optionalMiddleName}\s+(?:${verbs})\b`;
    // pre-quote: Name [MiddleName] verb [:,]? "...
    const preQuote = `\b(${names})${optionalMiddleName}\s+(?:${verbs})\s*[:,]?\s*["“”]`;
    // voice: Name's voice (allow various apostrophe types)
    const voice = `\b(${names})${optionalMiddleName}(?:[’\`']s|\'s)\s+(?:[a-zA-Z'’]+\s+){0,3}?voice\b`;

    const body = `(?:${postQuote})|(?:${preQuote})|(?:${voice})`;
    const flags = computeFlagsFromEntries(e, true);
    try { return new RegExp(body, flags) } catch (err) { console.warn("buildUnifiedAttributionRegex compile failed:", err); return null }
}

}


function buildDirectActionRegex(patternList, verbString) {
    const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null;
    const names = e.map(x => `(?:${x.body})`).join("|");
    const verbs = processVerbsForRegex(verbString);
    if (!verbs) return null;
    const optionalMiddleName = `(?:\s+[A-Z][a-z]+)*`;

    // Two main forms:
    // A) Name (optional middle/title) [up to 3 short filler words] VERB
    // B) Name (optional middle/title) VERB [0-2 trailing small words]  (to catch "leaned forward")
    const body =
        `\b(${names})${optionalMiddleName}\s+(?:` +
            `(?:[a-zA-Z'’]+\s+){0,3}?(?:${verbs})` +
        `|` +
            `(?:${verbs})(?:\s+[a-zA-Z'’]{1,20}){0,2}` +
        `)\b`;

    const flags = computeFlagsFromEntries(e, true);
    try { return new RegExp(body, flags) } catch (err) { console.warn("buildDirectActionRegex compile failed:", err); return null }
}

}

function buildPossessiveRegex(patternList) {
    const e = (patternList || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null;
    const names = e.map(x => `(?:${x.body})`).join("|");
    const body = `\\b(${names})(?:\\s+[A-Z][a-z]+)*[’\`']s\\b`;
    const flags = computeFlagsFromEntries(e, true);
    try { return new RegExp(body, flags) } catch (err) { console.warn("buildPossessiveRegex compile failed:", err); return null }
}

function getQuoteRanges(s) { const q=/"|\u201C|\u201D/g,pos=[],ranges=[];let m;while((m=q.exec(s))!==null)pos.push(m.index);for(let i=0;i+1<pos.length;i+=2)ranges.push([pos[i],pos[i+1]]);return ranges }
function isIndexInsideQuotesRanges(ranges,idx){for(const[a,b]of ranges)if(idx>a&&idx<b)return!0;return!1}
function findMatches(combined,regex,quoteRanges,searchInsideQuotes=!1){if(!combined||!regex)return[];const flags=regex.flags.includes("g")?regex.flags:regex.flags+"g",re=new RegExp(regex.source,flags),results=[];let m;for(; (m=re.exec(combined))!==null;){const idx=m.index||0;(searchInsideQuotes||!isIndexInsideQuotesRanges(quoteRanges,idx))&&results.push({match:m[0],groups:m.slice(1),index:idx}),re.lastIndex===m.index&&re.lastIndex++}return results}

function findAllMatches(combined, regexes, settings, quoteRanges) {
    const allMatches = [];
    const { speakerRegex, attributionRegex, directActionRegex, possessiveRegex, vocativeRegex, nameRegex } = regexes;
    const priorities = { speaker: 5, attribution: 4, action: 3, vocative: 2, possessive: 1, name: 0 };
    
    if (speakerRegex) findMatches(combined, speakerRegex, quoteRanges).forEach(m => { const name = m.groups?.[0]?.trim(); name && allMatches.push({ name, matchKind: "speaker", matchIndex: m.index, priority: priorities.speaker }); });
    if (settings.detectAttribution && attributionRegex) findMatches(combined, attributionRegex, quoteRanges).forEach(m => { const name = m.groups?.find(g => g)?.trim(); name && allMatches.push({ name, matchKind: "attribution", matchIndex: m.index, priority: priorities.attribution }); });
    if (settings.detectAction && directActionRegex) findMatches(combined, directActionRegex, quoteRanges).forEach(m => { const name = m.groups?.find(g => g)?.trim(); name && allMatches.push({ name, matchKind: "action", matchIndex: m.index, priority: priorities.action }); });
    if (settings.detectVocative && vocativeRegex) findMatches(combined, vocativeRegex, quoteRanges, true).forEach(m => { const name = m.groups?.[0]?.trim(); name && allMatches.push({ name, matchKind: "vocative", matchIndex: m.index, priority: priorities.vocative }); });
    if (settings.detectPossessive && possessiveRegex) findMatches(combined, possessiveRegex, quoteRanges).forEach(m => { const name = m.groups?.[0]?.trim(); name && allMatches.push({ name, matchKind: "possessive", matchIndex: m.index, priority: priorities.possessive }); });
    if (settings.detectGeneral && nameRegex) findMatches(combined, nameRegex, quoteRanges).forEach(m => { const name = String(m.groups?.[0] || m.match).replace(/-(?:sama|san)$/i, "").trim(); name && allMatches.push({ name, matchKind: "name", matchIndex: m.index, priority: priorities.name }); });

    if (settings.detectAttribution && nameRegex) {
        const verbs = processVerbsForRegex(settings.attributionVerbs || '');
        if (verbs) {
            const pronounRegex = new RegExp(`(["”'][,.]?)(?:.*?)?\\s+(he|she|they)\\s+(${verbs})`, 'gi');
            findMatches(combined, pronounRegex, quoteRanges).forEach(pronounMatch => {
                const pronounMatchIndex = pronounMatch.index;
                const textBeforePronoun = combined.substring(0, pronounMatchIndex);
                
                const nameMatchesBefore = findMatches(textBeforePronoun, nameRegex, getQuoteRanges(textBeforePronoun));
                if (nameMatchesBefore.length > 0) {
                    const lastMention = nameMatchesBefore[nameMatchesBefore.length - 1];
                    const name = (lastMention.groups?.[0] || lastMention.match).trim();
                    if (name) {
                        allMatches.push({ name, matchKind: "attribution (pronoun)", matchIndex: pronounMatchIndex, priority: priorities.attribution });
                    }
                }
            });
        }
    }

    return allMatches;
}


function findBestMatch(combined, regexes, settings, quoteRanges) {
    if (!combined) return null;

    const allMatches = findAllMatches(combined, regexes, settings, quoteRanges);
    if (allMatches.length === 0) return null;

    allMatches.sort((a, b) => {
        if (a.matchIndex !== b.matchIndex) {
            return a.matchIndex - b.matchIndex;
        }
        return a.priority - b.priority;
    });

    const bias = Number(settings.detectionBias || 0);

    let bestMatch = allMatches[allMatches.length - 1];

    if (bias !== 0) {
        let highestScore = -Infinity;
        for (const match of allMatches) {
            const score = match.matchIndex + (match.priority * bias);
            if (score >= highestScore) {
                highestScore = score;
                bestMatch = match;
            }
        }
    }
    
    return bestMatch;
}

function calculateCharacterFocusScores(text, profile, regexes) { if (!text || !profile || !regexes) return {}; const combined = normalizeStreamText(text), quoteRanges = getQuoteRanges(combined), allMatches = findAllMatches(combined, regexes, profile, quoteRanges), scores = {}, points = { "attribution (pronoun)": 3, speaker: 3, attribution: 3, action: 2, vocative: 1, possessive: 1, name: 1 }; allMatches.forEach(match => { const normalizedName = normalizeCostumeName(match.name); if (!scores[normalizedName]) { scores[normalizedName] = 0; } scores[normalizedName] += (points[match.matchKind] || 0); }); return scores; }
function normalizeStreamText(s){return s?String(s).replace(/[\uFEFF\u200B\u200C\u200D]/g,"").replace(/[\u2018\u2019\u201A\u201B]/g,"'").replace(/[\u201C\u201D\u201E\u201F]/g,'"').replace(/(\*\*|__|~~|`{1,3})/g,"").replace(/\u00A0/g," "):""}
function normalizeCostumeName(n){if(!n)return"";let s=String(n).trim();s.startsWith("/")&&(s=s.slice(1).trim());const first=s.split(/[\/\s]+/).filter(Boolean)[0]||s;return String(first).replace(/[-_](?:sama|san|chan|kun)$/i,"").trim()}
const perMessageBuffers=new Map,perMessageStates=new Map;let lastIssuedCostume=null,lastSwitchTimestamp=0;const lastTriggerTimes=new Map,failedTriggerTimes=new Map;let _streamHandler=null,_genStartHandler=null,_genEndHandler=null,_msgRecvHandler=null,_chatChangedHandler=null;const MAX_MESSAGE_BUFFERS=60;
function ensureBufferLimit(){if(!(perMessageBuffers.size<=60)){for(;perMessageBuffers.size>60;){const firstKey=perMessageBuffers.keys().next().value;perMessageBuffers.delete(firstKey),perMessageStates.delete(firstKey)}}}
function debugLog(settings,...args){try{settings&&getActiveProfile(settings)?.debug&&console.debug.apply(console,["[CostumeSwitch]"].concat(args))}catch(e){}}
function waitForSelector(s,t=3e3,i=120){return new Promise(r=>{const n=Date.now(),e=setInterval(()=>{const o=document.querySelector(s);if(o)return clearInterval(e),void r(!0);Date.now()-n>t&&(clearInterval(e),r(!1))},i)})}
function getActiveProfile(settings) { return settings?.profiles?.[settings.activeProfile]; }
jQuery(async () => {
    if (typeof executeSlashCommandsOnChatInput !== 'function') { console.error("[CostumeSwitch] FATAL: The global 'executeSlashCommandsOnChatInput' function is not available."); const statusEl = document.querySelector("#cs-status"); if (statusEl) { statusEl.textContent = "FATAL ERROR: See console"; statusEl.style.color = "red"; } return; }
    const { store, save, ctx } = getSettingsObj();
    let settings = store[extensionName]; 
    try { const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`); $("#extensions_settings").append(settingsHtml); } catch (e) { console.warn("Failed to load settings.html:", e); $("#extensions_settings").append('<div><h3>Costume Switch</h3><div>Failed to load UI (see console)</div></div>'); }
    const ok = await waitForSelector("#cs-save", 3000, 100);
    if (!ok) console.warn("CostumeSwitch: settings UI did not appear within timeout.");
    let nameRegex, speakerRegex, attributionRegex, directActionRegex, possessiveRegex, vocativeRegex, vetoRegex;
    function recompileRegexes() { try { const profile = getActiveProfile(settings); if (!profile) return; const lowerIgnored = (profile.ignorePatterns || []).map(p => String(p).trim().toLowerCase()); const effectivePatterns = (profile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase())); const attributionVerbs = String(profile.attributionVerbs || ''); const actionVerbs = String(profile.actionVerbs || ''); nameRegex = buildNameRegex(effectivePatterns); speakerRegex = buildSpeakerRegex(effectivePatterns); attributionRegex = buildUnifiedAttributionRegex(effectivePatterns, attributionVerbs); directActionRegex = buildDirectActionRegex(effectivePatterns, actionVerbs); possessiveRegex = buildPossessiveRegex(effectivePatterns); vocativeRegex = buildVocativeRegex(effectivePatterns); vetoRegex = buildGenericRegex(profile.vetoPatterns); $("#cs-error").text("").hide(); } catch (e) { $("#cs-error").text(`Pattern compile error: ${String(e)}`).show(); } }
    function populateProfileDropdown() { const select = $("#cs-profile-select"); select.empty(); Object.keys(settings.profiles).forEach(name => { select.append($('<option>', { value: name, text: name })); }); select.val(settings.activeProfile); }
    function updateFocusLockUI() { const profile = getActiveProfile(settings), lockSelect = $("#cs-focus-lock-select"), lockToggle = $("#cs-focus-lock-toggle"); lockSelect.empty(); lockSelect.append($('<option>', { value: '', text: 'None (Automatic)' })); if (profile && profile.patterns) { profile.patterns.forEach(name => { const cleanName = normalizeCostumeName(name); lockSelect.append($('<option>', { value: cleanName, text: cleanName })); }); } if (settings.focusLock) { lockSelect.val(settings.focusLock); lockToggle.text("Unlock"); lockSelect.prop("disabled", true); } else { lockSelect.val(''); lockToggle.text("Lock"); lockSelect.prop("disabled", false); } }
    function loadProfile(profileName) { if (!settings.profiles[profileName]) { console.warn(`Profile "${profileName}" not found. Loading default.`); profileName = Object.keys(settings.profiles)[0]; } settings.activeProfile = profileName; const profile = getActiveProfile(settings); $("#cs-profile-name").val(profileName); $("#cs-patterns").val((profile.patterns || []).join("\n")); $("#cs-ignore-patterns").val((profile.ignorePatterns || []).join("\n")); $("#cs-veto-patterns").val((profile.vetoPatterns || []).join("\n")); $("#cs-default").val(profile.defaultCostume || ""); $("#cs-debug").prop("checked", !!profile.debug); $("#cs-global-cooldown").val(profile.globalCooldownMs || PROFILE_DEFAULTS.globalCooldownMs); $("#cs-repeat-suppress").val(profile.repeatSuppressMs || PROFILE_DEFAULTS.repeatSuppressMs); $("#cs-token-process-threshold").val(profile.tokenProcessThreshold || PROFILE_DEFAULTS.tokenProcessThreshold); $("#cs-detection-bias").val(profile.detectionBias || PROFILE_DEFAULTS.detectionBias); $("#cs-detection-bias-value").text(profile.detectionBias || PROFILE_DEFAULTS.detectionBias); $("#cs-detect-attribution").prop("checked", !!profile.detectAttribution); $("#cs-detect-action").prop("checked", !!profile.detectAction); $("#cs-detect-vocative").prop("checked", !!profile.detectVocative); $("#cs-detect-possessive").prop("checked", !!profile.detectPossessive); $("#cs-detect-general").prop("checked", !!profile.detectGeneral); $("#cs-attribution-verbs").val(String(profile.attributionVerbs || '').replace(/\|/g, '\n')); $("#cs-action-verbs").val(String(profile.actionVerbs || '').replace(/\|/g, '\n')); renderMappings(profile); updateFocusLockUI(); recompileRegexes(); }
    function renderMappings(profile) { const tbody = $("#cs-mappings-tbody"); if (!tbody.length) return; tbody.empty(); (profile.mappings || []).forEach((m, idx) => { const $tr = $("<tr>").attr("data-idx", idx); const $nameTd = $("<td>").append($("<input>").addClass("map-name").val(m.name || "").attr("type","text")); const $folderTd = $("<td>").append($("<input>").addClass("map-folder").val(m.folder || "").attr("type","text")); const $actionsTd = $("<td>").append($("<button>").addClass("map-remove menu_button interactable").text("Remove")); $tr.append($nameTd, $folderTd, $actionsTd); tbody.append($tr); }); }
    function persistSettings() { if (save) save(); $("#cs-status").text(`Saved ${new Date().toLocaleTimeString()}`); setTimeout(() => $("#cs-status").text("Ready"), 1500); }
    $("#cs-enable").prop("checked", !!settings.enabled); populateProfileDropdown(); loadProfile(settings.activeProfile);
    function testRegexPattern() { const text = $("#cs-regex-test-input").val(); if (!text) { $("#cs-test-all-detections").html('<li style="color: var(--text-color-soft);">Enter text to test.</li>'); $("#cs-test-winner-list").html('<li style="color: var(--text-color-soft);">N/A</li>'); $("#cs-test-veto-status").html('<li style="color: var(--text-color-soft);">N/A</li>'); return; } const tempProfile = saveCurrentProfileData(); const tempVetoPatterns = $("#cs-veto-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean); const tempVetoRegex = buildGenericRegex(tempVetoPatterns); const combined = normalizeStreamText(text); const vetoStatusList = $("#cs-test-veto-status"); vetoStatusList.empty(); if (tempVetoRegex && tempVetoRegex.test(combined)) { const match = combined.match(tempVetoRegex)[0]; vetoStatusList.html(`<li style="color: var(--red);">VETOED by: "${match}"</li>`); $("#cs-test-all-detections").html('<li style="color: var(--text-color-soft);">Vetoed.</li>'); $("#cs-test-winner-list").html('<li style="color: var(--text-color-soft);">Vetoed.</li>'); return; } else { vetoStatusList.html('<li style="color: var(--green);">No veto detected.</li>'); } const lowerIgnored = (tempProfile.ignorePatterns || []).map(p => String(p).trim().toLowerCase()); const effectivePatterns = (tempProfile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase())); const tempRegexes = { speakerRegex: buildSpeakerRegex(effectivePatterns), attributionRegex: buildUnifiedAttributionRegex(effectivePatterns, tempProfile.attributionVerbs), directActionRegex: buildDirectActionRegex(effectivePatterns, tempProfile.actionVerbs), possessiveRegex: buildPossessiveRegex(effectivePatterns), vocativeRegex: buildVocativeRegex(effectivePatterns), nameRegex: buildNameRegex(effectivePatterns) }; const quoteRanges = getQuoteRanges(combined); const allMatches = findAllMatches(combined, tempRegexes, tempProfile, quoteRanges); allMatches.sort((a, b) => a.matchIndex - b.matchIndex); const allDetectionsList = $("#cs-test-all-detections"); allDetectionsList.empty(); if (allMatches.length > 0) { allMatches.forEach(match => { allDetectionsList.append(`<li><b>${match.name}</b> <small>(${match.matchKind}, p:${match.priority} @${match.matchIndex})</small></li>`); }); } else { allDetectionsList.html('<li style="color: var(--text-color-soft);">No detections found.</li>'); } const winnerList = $("#cs-test-winner-list"); winnerList.empty(); const winners = []; const words = combined.split(/(\s+)/); let currentBuffer = ""; let lastWinnerName = null; for (const word of words) { currentBuffer += word; const bestMatch = findBestMatch(currentBuffer, tempRegexes, tempProfile, getQuoteRanges(currentBuffer)); if (bestMatch && bestMatch.name !== lastWinnerName) { winners.push(bestMatch); lastWinnerName = bestMatch.name; } } if (winners.length > 0) { winners.forEach(match => { winnerList.append(`<li><b>${match.name}</b> <small>(${match.kind || match.matchKind} @${match.matchIndex})</small></li>`); }); } else { winnerList.html('<li style="color: var(--text-color-soft);">No winning match.</li>'); } }
    function saveCurrentProfileData() { const profileData = { patterns: $("#cs-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean), ignorePatterns: $("#cs-ignore-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean), vetoPatterns: $("#cs-veto-patterns").val().split(/\r?\n/).map(s => s.trim()).filter(Boolean), defaultCostume: $("#cs-default").val().trim(), debug: !!$("#cs-debug").prop("checked"), globalCooldownMs: parseInt($("#cs-global-cooldown").val() || PROFILE_DEFAULTS.globalCooldownMs, 10), repeatSuppressMs: parseInt($("#cs-repeat-suppress").val() || PROFILE_DEFAULTS.repeatSuppressMs, 10), tokenProcessThreshold: parseInt($("#cs-token-process-threshold").val() || PROFILE_DEFAULTS.tokenProcessThreshold, 10), detectionBias: parseInt($("#cs-detection-bias").val() || PROFILE_DEFAULTS.detectionBias, 10), detectAttribution: !!$("#cs-detect-attribution").prop("checked"), detectAction: !!$("#cs-detect-action").prop("checked"), detectVocative: !!$("#cs-detect-vocative").prop("checked"), detectPossessive: !!$("#cs-detect-possessive").prop("checked"), detectGeneral: !!$("#cs-detect-general").prop("checked"), attributionVerbs: $("#cs-attribution-verbs").val().trim().replace(/\s*\n\s*/g, '|'), actionVerbs: $("#cs-action-verbs").val().trim().replace(/\s*\n\s*/g, '|'), mappings: [] }; const newMaps = []; $("#cs-mappings-tbody tr").each(function () { const name = $(this).find(".map-name").val().trim(); const folder = $(this).find(".map-folder").val().trim(); if (name && folder) newMaps.push({ name, folder }); }); profileData.mappings = newMaps; return profileData; }
    function tryWireUI() { $("#cs-enable").off('change.cs').on("change.cs", function() { settings.enabled = !!$(this).prop("checked"); persistSettings(); }); $("#cs-focus-lock-toggle").off('click.cs').on("click.cs", async () => { if (settings.focusLock) { settings.focusLock = ''; await manualReset(); } else { const selectedChar = $("#cs-focus-lock-select").val(); if (selectedChar) { settings.focusLock = selectedChar; await issueCostumeForName(selectedChar, { isLock: true }); } } updateFocusLockUI(); persistSettings(); }); $("#cs-detection-bias").off('input.cs change.cs').on('input.cs', function() { $("#cs-detection-bias-value").text($(this).val()); }).on('change.cs', function() { const profile = getActiveProfile(settings); if (profile) { profile.detectionBias = parseInt($(this).val(), 10); persistSettings(); testRegexPattern(); } }); $("#cs-save").off('click.cs').on("click.cs", () => { const profileData = saveCurrentProfileData(); if(profileData) { settings.profiles[settings.activeProfile] = profileData; recompileRegexes(); updateFocusLockUI(); persistSettings(); } }); $("#cs-profile-select").off('change.cs').on("change.cs", function() { loadProfile($(this).val()); }); $("#cs-profile-save").off('click.cs').on("click.cs", () => { const newName = $("#cs-profile-name").val().trim(); if (!newName) return; const oldName = settings.activeProfile; if (newName !== oldName && settings.profiles[newName]) { $("#cs-error").text("A profile with that name already exists.").show(); return; } const profileData = saveCurrentProfileData(); if (!profileData) return; settings.profiles[newName] = profileData; settings.activeProfile = newName; populateProfileDropdown(); updateFocusLockUI(); $("#cs-error").text("").hide(); persistSettings(); }); $("#cs-profile-delete").off('click.cs').on("click.cs", () => { if (Object.keys(settings.profiles).length <= 1) { $("#cs-error").text("Cannot delete the last profile.").show(); return; } const profileNameToDelete = settings.activeProfile; if (confirm(`Are you sure you want to delete the profile "${profileNameToDelete}"?`)) { delete settings.profiles[profileNameToDelete]; settings.activeProfile = Object.keys(settings.profiles)[0]; populateProfileDropdown(); loadProfile(settings.activeProfile); $("#cs-status").text(`Deleted profile "${profileNameToDelete}".`); $("#cs-error").text("").hide(); persistSettings(); } }); $("#cs-reset").off('click.cs').on("click.cs", async () => { await manualReset(); }); $("#cs-mapping-add").off('click.cs').on("click.cs", () => { const profile = getActiveProfile(settings); if (profile) { if (!Array.isArray(profile.mappings)) profile.mappings = []; profile.mappings.push({ name: "", folder: "" }); renderMappings(profile); } }); $("#cs-mappings-tbody").off('click.cs', '.map-remove').on('click.cs', '.map-remove', function () { const profile = getActiveProfile(settings); if (profile) { const idx = parseInt($(this).closest('tr').attr('data-idx'), 10); if (!isNaN(idx)) { profile.mappings.splice(idx, 1); renderMappings(profile); } } }); $(document).off('click.cs', '#cs-regex-test-button').on('click.cs', '#cs-regex-test-button', testRegexPattern); }
    tryWireUI();
    async function manualReset() { const profile = getActiveProfile(settings); const costumeArg = profile?.defaultCostume?.trim() ? `\\${profile.defaultCostume.trim()}` : '\\'; const command = `/costume ${costumeArg}`; debugLog(settings, "Attempting manual reset with command:", command); try { await executeSlashCommandsOnChatInput(command); lastIssuedCostume = costumeArg; $("#cs-status").text(`Reset -> ${costumeArg}`); setTimeout(() => $("#cs-status").text("Ready"), 1500); } catch (err) { console.error(`[CostumeSwitch] Manual reset failed for "${costumeArg}".`, err); } }
    function getMappedCostume(name) { const profile = getActiveProfile(settings); if (!name || !profile) return null; for (const m of (profile.mappings || [])) { if (m?.name?.toLowerCase() === name.toLowerCase()) { return m.folder ? m.folder.trim() : null; } } return null; }
    async function issueCostumeForName(name, opts = {}) { const profile = getActiveProfile(settings); if (!name || !profile) return; const now = Date.now(); name = normalizeCostumeName(name); const isLock = opts.isLock || false; if (!isLock) { if (settings.focusLock) { debugLog(settings, "Focus is locked to", settings.focusLock, "- skipping switch to", name); return; } const currentName = normalizeCostumeName(lastIssuedCostume || profile.defaultCostume || (ctx?.characters?.[ctx.characterId]?.name) || ''); if (currentName && currentName.toLowerCase() === name.toLowerCase()) { debugLog(settings, "already using costume for", name, "- skipping switch."); return; } if (now - lastSwitchTimestamp < (profile.globalCooldownMs || PROFILE_DEFAULTS.globalCooldownMs)) { debugLog(settings, "global cooldown active, skipping switch to", name); return; } } const matchKind = opts.matchKind || null; let argFolder = getMappedCostume(name) || name; const lastSuccess = lastTriggerTimes.get(argFolder) || 0; if (!isLock && now - lastSuccess < (profile.perTriggerCooldownMs || PROFILE_DEFAULTS.perTriggerCooldownMs)) { debugLog(settings, "per-trigger cooldown active, skipping", argFolder); return; } const lastFailed = failedTriggerTimes.get(argFolder) || 0; if (now - lastFailed < (profile.failedTriggerCooldownMs || PROFILE_DEFAULTS.failedTriggerCooldownMs)) { debugLog(settings, "failed-trigger cooldown active, skipping", argFolder); return; } const command = `/costume \\${argFolder}`; debugLog(settings, "executing command:", command, "kind:", matchKind, "isLock:", isLock); try { await executeSlashCommandsOnChatInput(command); lastTriggerTimes.set(argFolder, now); lastIssuedCostume = argFolder; lastSwitchTimestamp = now; $("#cs-status").text(`Switched -> ${argFolder}`); setTimeout(() => $("#cs-status").text("Ready"), 1000); } catch (err) { failedTriggerTimes.set(argFolder, now); console.error(`[CostumeSwitch] Failed to execute /costume command for "${argFolder}".`, err); } }
    const streamEventName = event_types?.STREAM_TOKEN_RECEIVED || event_types?.SMOOTH_STREAM_TOKEN_RECEIVED || 'stream_token_received';
    _genStartHandler = (messageId) => { const bufKey = messageId != null ? `m${messageId}` : 'live'; debugLog(settings, `Generation started for ${bufKey}, resetting state.`); perMessageStates.set(bufKey, { lastAcceptedName: null, lastAcceptedTs: 0, vetoed: false }); perMessageBuffers.delete(bufKey); };
    _streamHandler = (...args) => { try { if (!settings.enabled || settings.focusLock) return; const profile = getActiveProfile(settings); if (!profile) return; let tokenText = "", messageId = null; if (typeof args[0] === 'number') { messageId = args[0]; tokenText = String(args[1] ?? ""); } else if (typeof args[0] === 'object') { tokenText = String(args[0].token ?? args[0].text ?? ""); messageId = args[0].messageId ?? args[1] ?? null; } else { tokenText = String(args.join(' ') || ""); } if (!tokenText) return; const bufKey = messageId != null ? `m${messageId}` : 'live'; if (!perMessageStates.has(bufKey)) { _genStartHandler(messageId); } const state = perMessageStates.get(bufKey); if (state.vetoed) return; const prev = perMessageBuffers.get(bufKey) || ""; const normalizedToken = normalizeStreamText(tokenText); const combined = (prev + normalizedToken).slice(-(profile.maxBufferChars || PROFILE_DEFAULTS.maxBufferChars)); perMessageBuffers.set(bufKey, combined); ensureBufferLimit(); const threshold = Number(profile.tokenProcessThreshold || PROFILE_DEFAULTS.tokenProcessThreshold); const lastChar = normalizedToken.slice(-1); const isBoundary = /[\s\.\,\!\?\:\;\)\u2014\]]$/.test(lastChar); if (!isBoundary && combined.length < (state.nextThreshold || threshold)) { return; } state.nextThreshold = combined.length + threshold; perMessageStates.set(bufKey, state); if (vetoRegex && vetoRegex.test(combined)) { debugLog(settings, "Veto phrase matched. Halting detection for this message."); state.vetoed = true; perMessageStates.set(bufKey, state); return; } const quoteRanges = getQuoteRanges(combined); const regexes = { speakerRegex, attributionRegex, directActionRegex, possessiveRegex, vocativeRegex, nameRegex }; const bestMatch = findBestMatch(combined, regexes, profile, quoteRanges); if (bestMatch) { const { name: matchedName, matchKind } = bestMatch; const now = Date.now(); const suppressMs = Number(profile.repeatSuppressMs || PROFILE_DEFAULTS.repeatSuppressMs); if (state.lastAcceptedName?.toLowerCase() === matchedName.toLowerCase() && (now - state.lastAcceptedTs < suppressMs)) { debugLog(settings, 'Suppressing repeat match for same name (flicker guard)', { matchedName }); return; } state.lastAcceptedName = matchedName; state.lastAcceptedTs = now; perMessageStates.set(bufKey, state); issueCostumeForName(matchedName, { matchKind, bufKey }); } } catch (err) { console.error("CostumeSwitch stream handler error:", err); } };
    _genEndHandler = (messageId) => { if (messageId != null) { perMessageBuffers.delete(`m${messageId}`); perMessageStates.delete(`m${messageId}`); } };
    _msgRecvHandler = (messageId) => { if (messageId != null) { perMessageBuffers.delete(`m${messageId}`); perMessageStates.delete(`m${messageId}`); } };
    _chatChangedHandler = () => { perMessageBuffers.clear(); perMessageStates.clear(); lastIssuedCostume = null; lastTriggerTimes.clear(); failedTriggerTimes.clear(); };
    function unload() { try { if (eventSource) { eventSource.off?.(streamEventName, _streamHandler); eventSource.off?.(event_types.GENERATION_STARTED, _genStartHandler); eventSource.off?.(event_types.GENERATION_ENDED, _genEndHandler); eventSource.off?.(event_types.MESSAGE_RECEIVED, _msgRecvHandler); eventSource.off?.(event_types.CHAT_CHANGED, _chatChangedHandler); } } catch (e) {} perMessageBuffers.clear(); perMessageStates.clear(); lastIssuedCostume = null; lastTriggerTimes.clear(); failedTriggerTimes.clear(); }
    registerSlashCommand("scene", (args) => { const debugMode = (args[0] || '').trim().toLowerCase() === 'debug'; const ctx = getContext(); const lastMessage = ctx.chat.slice().reverse().find(msg => !msg.is_user && msg.mes); if (!lastMessage) { toastr.warning("Could not find the last AI message to analyze."); return; } const tempProfile = saveCurrentProfileData(); const tempRegexes = {}; try { const lowerIgnored = (tempProfile.ignorePatterns || []).map(p => String(p).trim().toLowerCase()); const effectivePatterns = (tempProfile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase())); tempRegexes.nameRegex = buildNameRegex(effectivePatterns); tempRegexes.speakerRegex = buildSpeakerRegex(effectivePatterns); tempRegexes.attributionRegex = buildUnifiedAttributionRegex(effectivePatterns, tempProfile.attributionVerbs); tempRegexes.directActionRegex = buildDirectActionRegex(effectivePatterns, tempProfile.actionVerbs); tempRegexes.possessiveRegex = buildPossessiveRegex(effectivePatterns); tempRegexes.vocativeRegex = buildVocativeRegex(effectivePatterns); } catch (e) { toastr.error(`Failed to build patterns for analysis: ${e.message}`); return; } const scores = calculateCharacterFocusScores(lastMessage.mes, tempProfile, tempRegexes); const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]); if (sortedScores.length === 0) { toastr.info("No primary characters were detected in the last message."); return; } if (debugMode) { let debugString = "<strong>Scene Debug Scores:</strong><br>"; sortedScores.forEach(([name, score]) => { debugString += `${name}: ${score}<br>`; }); toastr.info(debugString, "Scene Analysis Debug", {timeOut: 15000}); return; } const topScore = sortedScores[0][1]; const primaryCharacters = sortedScores.filter(([name, score]) => score >= topScore * 0.4).map(([name, score]) => name); const resultString = primaryCharacters.join(', '); $("#send_textarea").val(resultString).focus(); toastr.success(`Detected primary characters: ${resultString}`, "Scene Analysis Complete"); }, ["debug"], "Analyzes the last AI message to determine the primary characters. Type '/scene debug' to see scores.", true );
    try { unload(); } catch (e) {}
    try { eventSource.on(streamEventName, _streamHandler); eventSource.on(event_types.GENERATION_STARTED, _genStartHandler); eventSource.on(event_types.GENERATION_ENDED, _genEndHandler); eventSource.on(event_types.MESSAGE_RECEIVED, _msgRecvHandler); eventSource.on(event_types.CHAT_CHANGED, _chatChangedHandler); } catch (e) { console.error("CostumeSwitch: failed to attach event handlers:", e); }
    try { window[`__${extensionName}_unload`] = unload; } catch (e) {}
    console.log("SillyTavern-CostumeSwitch v1.2.4 loaded successfully.");
});
function getSettingsObj() { const ctx = typeof getContext === 'function' ? getContext() : (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null); let storeSource; if (ctx && ctx.extensionSettings) { storeSource = ctx.extensionSettings; } else if (typeof extension_settings !== 'undefined') { storeSource = extension_settings; } else { throw new Error("Can't find SillyTavern extension settings storage."); } if (!storeSource[extensionName] || !storeSource[extensionName].profiles) { const oldSettings = storeSource[extensionName] || {}; const newSettings = structuredClone(DEFAULTS); Object.keys(PROFILE_DEFAULTS).forEach(key => { if (oldSettings.hasOwnProperty(key)) { newSettings.profiles.Default[key] = oldSettings[key]; } }); if (oldSettings.hasOwnProperty('enabled')) newSettings.enabled = oldSettings.enabled; storeSource[extensionName] = newSettings; } storeSource[extensionName] = Object.assign({}, structuredClone(DEFAULTS), storeSource[extensionName]); for (const profileName in storeSource[extensionName].profiles) { storeSource[extensionName].profiles[profileName] = Object.assign({}, structuredClone(PROFILE_DEFAULTS), storeSource[extensionName].profiles[profileName]); } return { store: storeSource, save: ctx?.saveSettingsDebounced || saveSettingsDebounced, ctx }; }
