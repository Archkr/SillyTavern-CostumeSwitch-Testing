import {
    QUOTE_OPENERS,
    QUOTE_CLOSERS,
    WORD_CHAR_REGEX,
    PRIORITY_FIELD_MAP,
    PROFILE_DEFAULTS,
} from "./constants.js";
import { state } from "./state.js";
import { getActiveProfile } from "./settings.js";
import { buildLowercaseSet, normalizeCostumeName, resolveNumericSetting } from "./utils.js";

function getQuoteRanges(s) {
    if (!s) return [];
    const stack = [];
    const ranges = [];

    const isLikelyApostrophe = (index) => {
        if (index < 0 || index >= s.length) return false;
        const prev = index > 0 ? s[index - 1] : '';
        const next = index + 1 < s.length ? s[index + 1] : '';
        return WORD_CHAR_REGEX.test(prev) && WORD_CHAR_REGEX.test(next);
    };

    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];
        const openerInfo = QUOTE_OPENERS.get(ch);
        if (openerInfo) {
            if (openerInfo.symmetric) {
                if (openerInfo.apostropheSensitive && isLikelyApostrophe(i)) {
                    continue;
                }
                const top = stack[stack.length - 1];
                if (top && top.open === ch && top.symmetric) {
                    stack.pop();
                    ranges.push([top.index, i]);
                } else {
                    stack.push({ open: ch, close: openerInfo.close, index: i, symmetric: true, apostropheSensitive: openerInfo.apostropheSensitive });
                }
                continue;
            }
            stack.push({ open: ch, close: openerInfo.close, index: i, symmetric: false });
            continue;
        }

        const closeCandidates = QUOTE_CLOSERS.get(ch);
        if (closeCandidates && stack.length) {
            for (let j = stack.length - 1; j >= 0; j -= 1) {
                const candidate = stack[j];
                if (!candidate.symmetric && candidate.close === ch && closeCandidates.includes(candidate.open)) {
                    stack.splice(j, 1);
                    ranges.push([candidate.index, i]);
                    break;
                }
            }
            continue;
        }

        const top = stack[stack.length - 1];
        if (top && top.symmetric && ch === top.close) {
            stack.pop();
            ranges.push([top.index, i]);
        }
    }

    return ranges.sort((a, b) => a[0] - b[0]);
}

function isIndexInsideQuotes(idx, quoteRanges) {
    for (const [start, end] of quoteRanges) {
        if (idx > start && idx < end) return true;
    }
    return false;
}

function findMatches(text, regex, quoteRanges, searchInsideQuotes = false) {
    if (!text || !regex) return [];
    const results = [];
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let match;
    while ((match = re.exec(text)) !== null) {
        if (searchInsideQuotes || !isIndexInsideQuotes(match.index, quoteRanges)) {
            results.push({ match: match[0], groups: match.slice(1), index: match.index });
        }
    }
    return results;
}

function getPriorityWeights(profile) {
    const weights = {};
    for (const [key, field] of Object.entries(PRIORITY_FIELD_MAP)) {
        weights[key] = resolveNumericSetting(profile?.[field], PROFILE_DEFAULTS[field]);
    }
    return weights;
}

export function findAllMatches(combined) {
    const allMatches = [];
    const profile = getActiveProfile();
    const { compiledRegexes } = state;
    if (!profile || !combined) return allMatches;

    const quoteRanges = getQuoteRanges(combined);
    const priorities = getPriorityWeights(profile);

    if (compiledRegexes.speakerRegex) {
        findMatches(combined, compiledRegexes.speakerRegex, quoteRanges).forEach(m => {
            const name = m.groups?.[0]?.trim();
            if (name) allMatches.push({ name, matchKind: "speaker", matchIndex: m.index, priority: priorities.speaker });
        });
    }
    if (profile.detectAttribution && compiledRegexes.attributionRegex) {
        findMatches(combined, compiledRegexes.attributionRegex, quoteRanges).forEach(m => {
            const name = m.groups?.find(g => g)?.trim();
            if (name) allMatches.push({ name, matchKind: "attribution", matchIndex: m.index, priority: priorities.attribution });
        });
    }
    if (profile.detectAction && compiledRegexes.actionRegex) {
        findMatches(combined, compiledRegexes.actionRegex, quoteRanges).forEach(m => {
            const name = m.groups?.find(g => g)?.trim();
            if (name) allMatches.push({ name, matchKind: "action", matchIndex: m.index, priority: priorities.action });
        });
    }
    if (profile.detectPronoun && state.perMessageStates.size > 0) {
        const msgState = Array.from(state.perMessageStates.values()).pop();
        if (msgState && msgState.lastSubject && compiledRegexes.pronounRegex) {
            findMatches(combined, compiledRegexes.pronounRegex, quoteRanges).forEach(m => {
                allMatches.push({ name: msgState.lastSubject, matchKind: "pronoun", matchIndex: m.index, priority: priorities.pronoun });
            });
        }
    }
    if (profile.detectVocative && compiledRegexes.vocativeRegex) {
        findMatches(combined, compiledRegexes.vocativeRegex, quoteRanges, true).forEach(m => {
            const name = m.groups?.[0]?.trim();
            if (name) allMatches.push({ name, matchKind: "vocative", matchIndex: m.index, priority: priorities.vocative });
        });
    }
    if (profile.detectPossessive && compiledRegexes.possessiveRegex) {
        findMatches(combined, compiledRegexes.possessiveRegex, quoteRanges).forEach(m => {
            const name = m.groups?.[0]?.trim();
            if (name) allMatches.push({ name, matchKind: "possessive", matchIndex: m.index, priority: priorities.possessive });
        });
    }
    if (profile.detectGeneral && compiledRegexes.nameRegex) {
        findMatches(combined, compiledRegexes.nameRegex, quoteRanges).forEach(m => {
            const name = String(m.groups?.[0] || m.match).replace(/-(?:sama|san)$/i, "").trim();
            if (name) allMatches.push({ name, matchKind: "name", matchIndex: m.index, priority: priorities.name });
        });
    }
    return allMatches;
}

export function getWinner(matches, bias = 0, textLength = 0, options = {}) {
    const rosterSet = options?.rosterSet instanceof Set ? options.rosterSet : null;
    const rosterBonus = Number.isFinite(options?.rosterBonus) ? options.rosterBonus : 150;
    const rosterPriorityDropoff = Number.isFinite(options?.rosterPriorityDropoff)
        ? options.rosterPriorityDropoff
        : 0.5;
    const distancePenaltyWeight = Number.isFinite(options?.distancePenaltyWeight)
        ? options.distancePenaltyWeight
        : 1;
    const priorityMultiplier = Number.isFinite(options?.priorityMultiplier)
        ? options.priorityMultiplier
        : 100;
    const scoredMatches = matches.map(match => {
        const isActive = match.priority >= 3;
        const distanceFromEnd = Number.isFinite(textLength)
            ? Math.max(0, textLength - match.matchIndex)
            : 0;
        const baseScore = match.priority * priorityMultiplier - distancePenaltyWeight * distanceFromEnd;
        let score = baseScore + (isActive ? bias : 0);
        if (rosterSet) {
            const normalized = String(match.name || '').toLowerCase();
            if (normalized && rosterSet.has(normalized)) {
                let bonus = rosterBonus;
                if (match.priority >= 3 && rosterPriorityDropoff > 0) {
                    const dropoffMultiplier = 1 - rosterPriorityDropoff * (match.priority - 2);
                    bonus *= Math.max(0, dropoffMultiplier);
                }
                score += bonus;
            }
        }
        return { ...match, score };
    });
    scoredMatches.sort((a, b) => b.score - a.score);
    return scoredMatches[0];
}

export function findBestMatch(combined, precomputedMatches = null) {
    const profile = getActiveProfile();
    const allMatches = Array.isArray(precomputedMatches) ? precomputedMatches : findAllMatches(combined);
    if (allMatches.length === 0) return null;

    let rosterSet = null;
    if (profile.enableSceneRoster) {
        const msgState = Array.from(state.perMessageStates.values()).pop();
        if (msgState && msgState.sceneRoster.size > 0) {
            rosterSet = msgState.sceneRoster;
        }
    }

    const scoringOptions = {
        rosterSet,
        rosterBonus: resolveNumericSetting(profile?.rosterBonus, PROFILE_DEFAULTS.rosterBonus),
        rosterPriorityDropoff: resolveNumericSetting(profile?.rosterPriorityDropoff, PROFILE_DEFAULTS.rosterPriorityDropoff),
        distancePenaltyWeight: resolveNumericSetting(profile?.distancePenaltyWeight, PROFILE_DEFAULTS.distancePenaltyWeight),
        priorityMultiplier: 100,
    };

    return getWinner(allMatches, profile.detectionBias, combined.length, scoringOptions);
}

export function rankSceneCharacters(matches, options = {}) {
    if (!Array.isArray(matches) || matches.length === 0) {
        return [];
    }

    const rosterSet = buildLowercaseSet(options?.rosterSet);
    const summary = new Map();

    matches.forEach((match, idx) => {
        if (!match || !match.name) return;
        const normalized = normalizeCostumeName(match.name);
        if (!normalized) return;

        const displayName = String(match.name).trim() || normalized;
        const key = normalized.toLowerCase();
        let entry = summary.get(key);
        if (!entry) {
            entry = {
                name: displayName,
                normalized,
                count: 0,
                bestPriority: -Infinity,
                earliest: Number.POSITIVE_INFINITY,
                latest: Number.NEGATIVE_INFINITY,
                inSceneRoster: rosterSet ? rosterSet.has(key) : false,
                firstMatchKind: null,
            };
            summary.set(key, entry);
        }

        entry.count += 1;
        entry.bestPriority = Math.max(entry.bestPriority, Number(match.priority) || 0);
        entry.earliest = Math.min(entry.earliest, Number.isFinite(match.matchIndex) ? match.matchIndex : idx);
        entry.latest = Math.max(entry.latest, Number.isFinite(match.matchIndex) ? match.matchIndex : idx);
        if (!entry.firstMatchKind) {
            entry.firstMatchKind = match.matchKind;
        }
    });

    const profile = options.profile || getActiveProfile();
    const detectionBias = Number(profile?.detectionBias) || 0;
    const rosterBonus = resolveNumericSetting(options?.rosterBonus, PROFILE_DEFAULTS.rosterBonus);
    const rosterPriorityDropoff = resolveNumericSetting(options?.rosterPriorityDropoff, PROFILE_DEFAULTS.rosterPriorityDropoff);
    const distancePenaltyWeight = resolveNumericSetting(options?.distancePenaltyWeight, PROFILE_DEFAULTS.distancePenaltyWeight);
    const textLength = Number.isFinite(options?.textLength) ? options.textLength : 0;
    const priorityMultiplier = Number.isFinite(options?.priorityMultiplier) ? options.priorityMultiplier : 100;

    const ranked = Array.from(summary.values()).map(entry => {
        const distanceFromEnd = Math.max(0, textLength - (Number.isFinite(entry.latest) ? entry.latest : 0));
        let score = entry.bestPriority * priorityMultiplier + entry.count * 10 - distancePenaltyWeight * distanceFromEnd;
        if (entry.bestPriority >= 3) {
            score += detectionBias;
        }
        if (entry.inSceneRoster) {
            let bonus = rosterBonus;
            if (entry.bestPriority >= 3 && rosterPriorityDropoff > 0) {
                const dropoffMultiplier = 1 - rosterPriorityDropoff * (entry.bestPriority - 2);
                bonus *= Math.max(0, dropoffMultiplier);
            }
            score += bonus;
        }

        return {
            name: entry.name,
            normalized: entry.normalized,
            count: entry.count,
            bestPriority: entry.bestPriority,
            earliest: Number.isFinite(entry.earliest) ? entry.earliest : null,
            latest: Number.isFinite(entry.latest) ? entry.latest : null,
            inSceneRoster: Boolean(entry.inSceneRoster),
            firstMatchKind: entry.firstMatchKind || null,
            score,
        };
    });

    ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.count !== a.count) return b.count - a.count;
        if (b.bestPriority !== a.bestPriority) return b.bestPriority - a.bestPriority;
        const aEarliest = Number.isFinite(a.earliest) ? a.earliest : Number.MAX_SAFE_INTEGER;
        const bEarliest = Number.isFinite(b.earliest) ? b.earliest : Number.MAX_SAFE_INTEGER;
        if (aEarliest !== bEarliest) return aEarliest - bEarliest;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return ranked;
}

export function scoreMatchesDetailed(matches, textLength, options = {}) {
    if (!Array.isArray(matches) || matches.length === 0) {
        return [];
    }

    const profile = options.profile || getActiveProfile();
    const detectionBias = Number(profile?.detectionBias) || 0;
    const priorityMultiplier = Number.isFinite(options?.priorityMultiplier) ? options.priorityMultiplier : 100;
    const rosterBonus = resolveNumericSetting(options?.rosterBonus, PROFILE_DEFAULTS.rosterBonus);
    const rosterPriorityDropoff = resolveNumericSetting(options?.rosterPriorityDropoff, PROFILE_DEFAULTS.rosterPriorityDropoff);
    const distancePenaltyWeight = resolveNumericSetting(options?.distancePenaltyWeight, PROFILE_DEFAULTS.distancePenaltyWeight);
    const rosterSet = buildLowercaseSet(options?.rosterSet);

    const scored = matches.map((match, idx) => {
        const priority = Number(match?.priority) || 0;
        const matchIndex = Number.isFinite(match?.matchIndex) ? match.matchIndex : idx;
        const distanceFromEnd = Number.isFinite(textLength) ? Math.max(0, textLength - matchIndex) : 0;
        const priorityScore = priority * priorityMultiplier;
        const biasBonus = priority >= 3 ? detectionBias : 0;
        let rosterBonusApplied = 0;
        let inRoster = false;
        if (rosterSet) {
            const normalized = String(match?.name || '').toLowerCase();
            if (normalized && rosterSet.has(normalized)) {
                inRoster = true;
                let bonus = rosterBonus;
                if (priority >= 3 && rosterPriorityDropoff > 0) {
                    const dropoffMultiplier = 1 - rosterPriorityDropoff * (priority - 2);
                    bonus *= Math.max(0, dropoffMultiplier);
                }
                rosterBonusApplied = bonus;
            }
        }
        const distancePenalty = distancePenaltyWeight * distanceFromEnd;
        const totalScore = priorityScore + biasBonus + rosterBonusApplied - distancePenalty;
        return {
            name: match?.name || '(unknown)',
            matchKind: match?.matchKind || 'unknown',
            priority,
            priorityScore,
            biasBonus,
            rosterBonus: rosterBonusApplied,
            distancePenalty,
            totalScore,
            matchIndex,
            charIndex: matchIndex,
            inRoster,
        };
    });

    scored.sort((a, b) => {
        const scoreDiff = b.totalScore - a.totalScore;
        if (scoreDiff !== 0) return scoreDiff;
        return a.matchIndex - b.matchIndex;
    });

    return scored;
}

export function summarizeMatches(matches) {
    const stats = new Map();
    matches.forEach((match) => {
        const normalizedName = normalizeCostumeName(match.name);
        if (!normalizedName) return;
        stats.set(normalizedName, (stats.get(normalizedName) || 0) + 1);
    });
    return stats;
}
