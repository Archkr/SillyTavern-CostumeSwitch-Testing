import { DEFAULTS, MAX_TRACKED_MESSAGES } from "./constants.js";
import { getSettings } from "./settings.js";

export const state = {
    lastIssuedCostume: null,
    lastSwitchTimestamp: 0,
    lastTriggerTimes: new Map(),
    failedTriggerTimes: new Map(),
    perMessageBuffers: new Map(),
    perMessageStates: new Map(),
    messageStats: new Map(),
    eventHandlers: {},
    compiledRegexes: {},
    statusTimer: null,
    testerTimers: [],
    lastTesterReport: null,
    buildMeta: null,
    topSceneRanking: new Map(),
    latestTopRanking: { bufKey: null, ranking: [], fullRanking: [], updatedAt: 0 },
    currentGenerationKey: null,
    mappingLookup: new Map(),
    messageKeyQueue: [],
    activeScorePresetKey: null,
    coverageDiagnostics: null,
};

export function ensureMessageQueue() {
    if (!Array.isArray(state.messageKeyQueue)) {
        state.messageKeyQueue = [];
    }
    return state.messageKeyQueue;
}

export function trackMessageKey(key) {
    const normalized = normalizeMessageKey(key);
    if (!normalized) return;
    const queue = ensureMessageQueue();
    const existingIndex = queue.indexOf(normalized);
    if (existingIndex !== -1) {
        queue.splice(existingIndex, 1);
    }
    queue.push(normalized);
    if (queue.length > MAX_TRACKED_MESSAGES) {
        queue.splice(0, queue.length - MAX_TRACKED_MESSAGES);
    }
}

export function replaceTrackedMessageKey(oldKey, newKey) {
    const normalizedOld = normalizeMessageKey(oldKey);
    const normalizedNew = normalizeMessageKey(newKey);
    if (!normalizedNew) return;
    const queue = ensureMessageQueue();
    if (normalizedOld) {
        const index = queue.indexOf(normalizedOld);
        if (index !== -1) {
            queue[index] = normalizedNew;
            return;
        }
    }
    if (!queue.includes(normalizedNew)) {
        queue.push(normalizedNew);
        if (queue.length > MAX_TRACKED_MESSAGES) {
            queue.splice(0, queue.length - MAX_TRACKED_MESSAGES);
        }
    }
}

export function ensureSessionData() {
    const settings = getSettings();
    if (!settings) return null;
    if (typeof settings.session !== 'object' || settings.session === null) {
        settings.session = {};
    }
    return settings.session;
}

export function updateSessionTopCharacters(bufKey, ranking) {
    const session = ensureSessionData();
    if (!session) return;

    const topRanking = Array.isArray(ranking) ? ranking.slice(0, 4) : [];
    const names = topRanking.map(entry => entry.name);
    const normalizedNames = topRanking.map(entry => entry.normalized);
    const details = topRanking.map(entry => ({
        name: entry.name,
        normalized: entry.normalized,
        count: entry.count,
        bestPriority: entry.bestPriority,
        inSceneRoster: entry.inSceneRoster,
        score: Number.isFinite(entry.score) ? Math.round(entry.score) : 0,
    }));

    session.topCharacters = names;
    session.topCharactersNormalized = normalizedNames;
    session.topCharactersString = names.join(', ');
    session.topCharacterDetails = details;
    session.lastMessageKey = bufKey || null;
    session.lastUpdated = Date.now();

    state.latestTopRanking = {
        bufKey: bufKey || null,
        ranking: topRanking,
        fullRanking: Array.isArray(ranking) ? ranking : [],
        updatedAt: session.lastUpdated,
    };
}

export function clearSessionTopCharacters() {
    const session = ensureSessionData();
    if (!session) return;
    session.topCharacters = [];
    session.topCharactersNormalized = [];
    session.topCharactersString = '';
    session.topCharacterDetails = [];
    session.lastMessageKey = null;
    session.lastUpdated = Date.now();

    state.latestTopRanking = {
        bufKey: null,
        ranking: [],
        fullRanking: [],
        updatedAt: session.lastUpdated,
    };
}

export function clampTopCount(count = 4) {
    return Math.min(Math.max(Number(count) || 4, 1), 4);
}

export function getLastStatsMessageKey() {
    if (!(state.messageStats instanceof Map) || state.messageStats.size === 0) {
        return null;
    }
    const lastKey = Array.from(state.messageStats.keys()).pop();
    return normalizeMessageKey(lastKey);
}

export function getLastTopCharacters(count = 4) {
    const limit = clampTopCount(count);
    if (Array.isArray(state.latestTopRanking?.ranking) && state.latestTopRanking.ranking.length) {
        return state.latestTopRanking.ranking.slice(0, limit);
    }

    const lastMessageKey = getLastStatsMessageKey();
    if (lastMessageKey && state.topSceneRanking instanceof Map) {
        const rankingForKey = state.topSceneRanking.get(lastMessageKey);
        if (Array.isArray(rankingForKey) && rankingForKey.length) {
            return rankingForKey.slice(0, limit);
        }
    }

    if (state.topSceneRanking instanceof Map && state.topSceneRanking.size > 0) {
        const lastRanking = Array.from(state.topSceneRanking.values()).pop();
        if (Array.isArray(lastRanking) && lastRanking.length) {
            return lastRanking.slice(0, limit);
        }
    }
    return [];
}

export function normalizeMessageKey(value) {
    if (value == null) return null;
    const str = typeof value === 'string' ? value : String(value);
    const trimmed = str.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^m?(\d+)$/i);
    if (match) return `m${match[1]}`;
    return trimmed;
}
