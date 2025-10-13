import { getActiveProfile } from './settings.js';
import { state } from './state.js';
import { PROFILE_DEFAULTS, PRONOUNS } from './constants.js';

// This will hold the compiled regexes for the active profile
export let compiledRegexes = {};

// --- UTILITY FUNCTIONS ---
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function parsePatternEntry(raw) { 
    const t = String(raw || '').trim(); 
    if (!t) return null; 
    const m = t.match(/^\/((?:\\.|[^\/])+)\/([gimsuy]*)$/); 
    return m ? { body: m[1], flags: m[2] || '', raw: t } : { body: escapeRegex(t), flags: '', raw: t };
}
function computeFlagsFromEntries(entries, requireI = true) { 
    const f = new Set(requireI ? ['i'] : []);
    for (const e of entries) { if (!e) continue; for (const c of (e.flags || '')) f.add(c); } 
    return Array.from(f).filter(c => 'gimsuy'.includes(c)).join(''); 
}
export function normalizeStreamText(s, opts = {}) {
    if (!s) return "";
    let str = String(s)
        .replace(/[\uFEFF\u200B\u200C\u200D]/g, "") // Zero-width characters
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // Smart quotes to standard
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/\u00A0/g, " "); // Non-breaking space

    if (opts.isCostumeName) {
        str = str.trim();
        if (str.startsWith("/")) str = str.slice(1).trim();
        const first = str.split(/[\/\s]+/).filter(Boolean)[0] || str;
        return String(first).replace(/[-_](?:sama|san)$/i, "").trim();
    } else {
        return str.replace(/(\*\*|__|~~|`{1,3})/g, ""); // Strip markdown
    }
}

// --- REGEX BUILDERS ---
function buildGenericRegex(patternList) {
    const entries = (patternList || []).map(parsePatternEntry).filter(Boolean);
    if (!entries.length) return null;
    const body = `(?:${entries.map(e => `(?:${e.body})`).join('|')})`;
    const flags = computeFlagsFromEntries(entries, true);
    try { return new RegExp(body, flags); } 
    catch (e) { throw new Error(`Generic pattern compile failed: ${e.message}`); }
}
function buildSpeakerRegex(p) { const e = (p || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const b = `(?:^|\\n)\\s*(${e.map(x=>`(?:${x.body})`).join('|')})\\s*[:;,]\\s*`, f = computeFlagsFromEntries(e); try { return new RegExp(b, f) } catch { return null } }
function buildVocativeRegex(p) { const e = (p || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const b = `(?:["“'\\s])(${e.map(x=>`(?:${x.body})`).join('|')})[,.!?]`, f = computeFlagsFromEntries(e); try { return new RegExp(b, f) } catch { return null } }
function buildAttributionRegex(p, v) { const e = (p || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const n = e.map(x => `(?:${x.body})`).join("|"), b = `(["“”][^"“”]{0,400}["“”])\\s*,?\\s*(${n})\\s+${(v||[]).map(escapeRegex).join("|")}`, f = computeFlagsFromEntries(e); try { return new RegExp(b, f) } catch { return null } }
function buildActionRegex(p, v) { const e = (p || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const n = e.map(x => `(?:${x.body})`).join("|"), b = `\\b(${n})\\b(?:\\s+[a-zA-Z'’]+){0,4}?\\s+${(v||[]).map(escapeRegex).join("|")}\\b`, f = computeFlagsFromEntries(e); try { return new RegExp(b, f) } catch { return null } }
function buildPossessiveRegex(p) { const e = (p || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const b = `\\b(${e.map(x=>`(?:${x.body})`).join('|')})[’\`']s\\b`, f = computeFlagsFromEntries(e); try { return new RegExp(b, f) } catch { return null } }
function buildPronounRegex(v) { const b = `\\b(${PRONOUNS.join("|")})\\b(?:\\s+[a-zA-Z'’]+){0,4}?\\s+(${(v||[]).map(escapeRegex).join("|")})\\b`, f = 'gi'; try { return new RegExp(b, f) } catch { return null } }
function buildNameRegex(p) { const e = (p || []).map(parsePatternEntry).filter(Boolean); if (!e.length) return null; const b = `\\b(${e.map(x=>`(?:${x.body})`).join('|')})\\b`, f = computeFlagsFromEntries(e); try { return new RegExp(b, f) } catch { return null } }

/**
 * Recompiles all regexes based on the current active profile settings.
 */
export function recompileRegexes() {
    try {
        const profile = getActiveProfile();
        if (!profile) return;
        const lowerIgnored = (profile.ignorePatterns || []).map(p => String(p).trim().toLowerCase());
        const effectivePatterns = (profile.patterns || []).filter(p => !lowerIgnored.includes(String(p).trim().toLowerCase()));
        
        compiledRegexes = {
            speakerRegex: buildSpeakerRegex(effectivePatterns),
            attributionRegex: buildAttributionRegex(effectivePatterns, profile.attributionVerbs),
            actionRegex: buildActionRegex(effectivePatterns, profile.actionVerbs),
            vocativeRegex: buildVocativeRegex(effectivePatterns),
            possessiveRegex: buildPossessiveRegex(effectivePatterns),
            pronounRegex: buildPronounRegex(profile.actionVerbs),
            nameRegex: buildNameRegex(effectivePatterns),
            vetoRegex: buildGenericRegex(profile.vetoPatterns),
        };
        $('#cs-error').text("").hide();
    } catch (e) {
        $('#cs-error').text(`Pattern compile error: ${String(e)}`).show();
    }
}

// --- DETECTION LOGIC ---
function getQuoteRanges(s) { const q = /"|\u201C|\u201D/g, p = []; let m; while((m=q.exec(s))!==null) p.push(m.index); const r=[]; for(let i=0;i+1<p.length;i+=2) r.push([p[i],p[i+1]]); return r; }
function isIndexInsideQuotes(ranges, idx) { for(const [a,b] of ranges) if(idx>a&&idx<b) return true; return false; }

function findMatches(text, regex, quoteRanges, { searchInsideQuotes = false, groupIndex = 1 } = {}) {
    if (!text || !regex) return [];
    const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
    const re = new RegExp(regex.source, flags);
    const results = [];
    let match;
    while ((match = re.exec(text)) !== null) {
        const index = match.index || 0;
        if (searchInsideQuotes || !isIndexInsideQuotes(quoteRanges, index)) {
            const name = match[groupIndex]?.trim();
            if (name) results.push({ name, index, match: match[0] });
        }
        if (re.lastIndex === match.index) re.lastIndex++;
    }
    return results;
}

function findAllMatches(text) {
    const profile = getActiveProfile();
    const quoteRanges = getQuoteRanges(text);
    const all = [];
    const priorities = { speaker: 5, attribution: 4, action: 3, pronoun: 3, vocative: 2, possessive: 1, name: 0 };
    
    if (compiledRegexes.speakerRegex) findMatches(text, compiledRegexes.speakerRegex, quoteRanges, { groupIndex: 1 }).forEach(m => all.push({ ...m, kind: "speaker", priority: priorities.speaker }));
    if (profile.detectAttribution && compiledRegexes.attributionRegex) findMatches(text, compiledRegexes.attributionRegex, quoteRanges, { groupIndex: 2 }).forEach(m => all.push({ ...m, kind: "attribution", priority: priorities.attribution }));
    if (profile.detectAction && compiledRegexes.actionRegex) findMatches(text, compiledRegexes.actionRegex, quoteRanges).forEach(m => all.push({ ...m, kind: "action", priority: priorities.action }));
    if (profile.detectVocative && compiledRegexes.vocativeRegex) findMatches(text, compiledRegexes.vocativeRegex, quoteRanges, { searchInsideQuotes: true }).forEach(m => all.push({ ...m, kind: "vocative", priority: priorities.vocative }));
    if (profile.detectPossessive && compiledRegexes.possessiveRegex) findMatches(text, compiledRegexes.possessiveRegex, quoteRanges).forEach(m => all.push({ ...m, kind: "possessive", priority: priorities.possessive }));
    if (profile.detectGeneral && compiledRegexes.nameRegex) findMatches(text, compiledRegexes.nameRegex, quoteRanges).forEach(m => all.push({ ...m, kind: "name", priority: priorities.name }));
    
    // Pronoun detection
    if (profile.detectPronoun && compiledRegexes.pronounRegex && state.pronounSubject) {
        findMatches(text, compiledRegexes.pronounRegex, quoteRanges).forEach(m => {
            all.push({ name: state.pronounSubject, index: m.index, kind: 'pronoun', priority: priorities.pronoun, isPronoun: true });
        });
    }
    
    return all;
}

export function findBestMatch(text) {
    if (!text) return null;
    const profile = getActiveProfile();
    const allMatches = findAllMatches(text);
    if (allMatches.length === 0) return null;

    const bias = Number(profile.detectionBias || 0);
    const scoredMatches = allMatches.map(match => {
        const isActive = match.priority >= 3; // speaker, attribution, action, pronoun
        let score = match.index + (isActive ? bias : 0);

        // Scene Roster Bonus
        if (profile.enableSceneRoster && state.activeRoster.has(match.name)) {
            score += 50; // Add a significant bonus for being in the scene
        }
        
        return { ...match, score };
    });

    scoredMatches.sort((a, b) => b.score - a.score);
    return scoredMatches[0];
}
