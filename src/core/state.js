function createSceneSnapshot() {
    return {
        key: null,
        messageId: null,
        roster: [],
        lastEvent: null,
        updatedAt: 0,
    };
}

function normalizeKey(value) {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim().toLowerCase();
}

function cloneEvent(event) {
    if (!event || typeof event !== "object") {
        return null;
    }
    const copy = {
        ...event,
    };
    if (event.outfit && typeof event.outfit === "object") {
        copy.outfit = { ...event.outfit };
    }
    return copy;
}

function normalizeDisplayNameMap(displayNames) {
    if (!displayNames) {
        return new Map();
    }
    if (displayNames instanceof Map) {
        return new Map(displayNames);
    }
    if (Array.isArray(displayNames)) {
        const pairs = displayNames.filter((entry) => Array.isArray(entry) && entry.length >= 2);
        return new Map(pairs.map(([key, value]) => [normalizeKey(key), value]));
    }
    if (typeof displayNames === "object") {
        return new Map(Object.entries(displayNames).map(([key, value]) => [normalizeKey(key), value]));
    }
    return new Map();
}

function normalizeEvent(event, fallbackTimestamp) {
    if (!event || typeof event !== "object") {
        return null;
    }
    const normalized = normalizeKey(event.name);
    const hasDetails = normalized || typeof event.matchKind === "string" || Number.isFinite(event.charIndex);
    if (!hasDetails) {
        return null;
    }
    return {
        name: typeof event.name === "string" ? event.name : normalized || null,
        normalized: normalized || null,
        matchKind: typeof event.matchKind === "string" ? event.matchKind : null,
        charIndex: Number.isFinite(event.charIndex) ? event.charIndex : null,
        timestamp: Number.isFinite(event.timestamp) ? event.timestamp : fallbackTimestamp,
    };
}

let currentScene = createSceneSnapshot();
const rosterMembers = new Map();
let rosterUpdatedAt = 0;
const liveTesterOutputs = new Map();
let liveTesterUpdatedAt = 0;

function resolveDisplayName(normalized, displayNames) {
    if (displayNames.has(normalized)) {
        return displayNames.get(normalized);
    }
    const existing = rosterMembers.get(normalized);
    if (existing?.name) {
        return existing.name;
    }
    return normalized;
}

function cloneRosterEntry(entry) {
    return {
        name: entry.name,
        normalized: entry.normalized,
        joinedAt: entry.joinedAt,
        lastSeenAt: entry.lastSeenAt,
        turnsRemaining: Number.isFinite(entry.turnsRemaining) ? entry.turnsRemaining : null,
    };
}

function cloneRosterMember(member) {
    return {
        name: member.name,
        normalized: member.normalized,
        joinedAt: member.joinedAt,
        lastSeenAt: member.lastSeenAt,
        lastLeftAt: member.lastLeftAt,
        active: member.active,
        turnsRemaining: Number.isFinite(member.turnsRemaining) ? member.turnsRemaining : null,
    };
}

function cloneTesterOutput(entry) {
    return {
        name: entry.name,
        normalized: entry.normalized,
        events: entry.events.map(cloneEvent),
        summary: { ...entry.summary },
        lastEvent: entry.lastEvent ? cloneEvent(entry.lastEvent) : null,
        activeInRoster: entry.activeInRoster,
        updatedAt: entry.updatedAt,
    };
}

export function resetSceneState() {
    currentScene = createSceneSnapshot();
    rosterMembers.clear();
    rosterUpdatedAt = Date.now();
    return getCurrentSceneSnapshot();
}

export function getCurrentSceneSnapshot() {
    return {
        key: currentScene.key,
        messageId: currentScene.messageId,
        roster: currentScene.roster.map(cloneRosterEntry),
        lastEvent: currentScene.lastEvent ? { ...currentScene.lastEvent } : null,
        updatedAt: currentScene.updatedAt,
    };
}

export function applySceneRosterUpdate({
    key = currentScene.key,
    messageId = currentScene.messageId,
    roster = [],
    displayNames = null,
    lastMatch = null,
    updatedAt = Date.now(),
    turnsRemaining = null,
} = {}) {
    const normalizedDisplayNames = normalizeDisplayNameMap(displayNames);
    const activeSet = new Set();
    const rosterEntries = [];
    const sanitizedTurns = Number.isFinite(turnsRemaining) ? Math.max(0, Math.floor(turnsRemaining)) : null;

    const values = Array.isArray(roster) ? roster : [];
    values.forEach((value) => {
        const normalized = normalizeKey(value);
        if (!normalized || activeSet.has(normalized)) {
            return;
        }
        activeSet.add(normalized);
        const name = resolveDisplayName(normalized, normalizedDisplayNames);
        const existing = rosterMembers.get(normalized);
        const joinedAt = existing?.joinedAt ?? updatedAt;
        rosterEntries.push({
            name,
            normalized,
            joinedAt,
            lastSeenAt: updatedAt,
            turnsRemaining: sanitizedTurns,
        });
    });

    for (const [normalized, member] of rosterMembers.entries()) {
        if (!activeSet.has(normalized) && member.active) {
            rosterMembers.set(normalized, {
                ...member,
                active: false,
                lastLeftAt: updatedAt,
                turnsRemaining: null,
            });
        }
    }

    rosterEntries.forEach((entry) => {
        rosterMembers.set(entry.normalized, {
            name: entry.name,
            normalized: entry.normalized,
            joinedAt: rosterMembers.get(entry.normalized)?.joinedAt ?? entry.joinedAt,
            lastSeenAt: entry.lastSeenAt,
            lastLeftAt: null,
            active: true,
            turnsRemaining: entry.turnsRemaining,
        });
    });

    rosterUpdatedAt = updatedAt;

    const normalizedEvent = normalizeEvent(lastMatch, updatedAt);

    currentScene = {
        key: key || null,
        messageId: Number.isFinite(messageId) ? messageId : null,
        roster: rosterEntries.map(cloneRosterEntry),
        lastEvent: normalizedEvent ? { ...normalizedEvent } : null,
        updatedAt,
    };

    return getCurrentSceneSnapshot();
}

export function getRosterMembershipSnapshot() {
    return {
        updatedAt: rosterUpdatedAt,
        members: Array.from(rosterMembers.values()).map(cloneRosterMember),
    };
}

export function listRosterMembers() {
    return Array.from(rosterMembers.values()).map(cloneRosterMember);
}

export function setRosterMember(name, data = {}) {
    const normalized = normalizeKey(name || data.name);
    if (!normalized) {
        return null;
    }
    const now = Date.now();
    const existing = rosterMembers.get(normalized);
    const turnsRemaining = Number.isFinite(data.turnsRemaining)
        ? Math.max(0, Math.floor(data.turnsRemaining))
        : Number.isFinite(existing?.turnsRemaining)
            ? existing.turnsRemaining
            : null;
    const entry = {
        name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : existing?.name || normalized,
        normalized,
        joinedAt: Number.isFinite(data.joinedAt) ? data.joinedAt : existing?.joinedAt ?? now,
        lastSeenAt: Number.isFinite(data.lastSeenAt) ? data.lastSeenAt : existing?.lastSeenAt ?? now,
        lastLeftAt: Number.isFinite(data.lastLeftAt) ? data.lastLeftAt : existing?.lastLeftAt ?? null,
        active: typeof data.active === "boolean" ? data.active : existing?.active ?? true,
        turnsRemaining,
    };
    if (!entry.active && entry.lastLeftAt == null) {
        entry.lastLeftAt = entry.lastSeenAt;
        entry.turnsRemaining = null;
    }
    rosterMembers.set(normalized, entry);
    rosterUpdatedAt = now;
    return cloneRosterMember(entry);
}

export function removeRosterMember(name) {
    const normalized = normalizeKey(name);
    if (!normalized) {
        return false;
    }
    const removed = rosterMembers.delete(normalized);
    if (removed) {
        rosterUpdatedAt = Date.now();
    }
    return removed;
}

export function clearRosterMembership() {
    rosterMembers.clear();
    rosterUpdatedAt = Date.now();
    return rosterUpdatedAt;
}

export function replaceLiveTesterOutputs(events = [], {
    roster = [],
    displayNames = null,
    timestamp = Date.now(),
} = {}) {
    liveTesterOutputs.clear();
    const normalizedDisplayNames = normalizeDisplayNameMap(displayNames);
    const activeRoster = new Set();
    const rosterValues = Array.isArray(roster) ? roster : [];
    rosterValues.forEach((value) => {
        const normalized = normalizeKey(value);
        if (normalized) {
            activeRoster.add(normalized);
            if (!normalizedDisplayNames.has(normalized)) {
                normalizedDisplayNames.set(normalized, value);
            }
        }
    });

    const aggregator = new Map();
    events.forEach((event) => {
        if (!event || typeof event !== "object") {
            return;
        }
        const normalized = normalizeKey(event.name);
        if (!normalized) {
            return;
        }
        const bucket = aggregator.get(normalized) || {
            name: normalizedDisplayNames.get(normalized) || event.name || normalized,
            normalized,
            events: [],
            summary: { switches: 0, skips: 0, vetoes: 0 },
            lastEvent: null,
        };
        bucket.events.push(event);
        bucket.lastEvent = event;
        if (event.type === "switch") {
            bucket.summary.switches += 1;
        } else if (event.type === "skipped") {
            bucket.summary.skips += 1;
        } else if (event.type === "veto") {
            bucket.summary.vetoes += 1;
        }
        aggregator.set(normalized, bucket);
    });

    for (const [normalized, bucket] of aggregator.entries()) {
        const name = normalizedDisplayNames.get(normalized) || bucket.name || normalized;
        liveTesterOutputs.set(normalized, {
            name,
            normalized,
            events: bucket.events.map(cloneEvent),
            summary: { ...bucket.summary },
            lastEvent: bucket.lastEvent ? cloneEvent(bucket.lastEvent) : null,
            activeInRoster: activeRoster.has(normalized),
            updatedAt: timestamp,
        });
        activeRoster.delete(normalized);
    }

    for (const normalized of activeRoster.values()) {
        const name = normalizedDisplayNames.get(normalized) || normalized;
        liveTesterOutputs.set(normalized, {
            name,
            normalized,
            events: [],
            summary: { switches: 0, skips: 0, vetoes: 0 },
            lastEvent: null,
            activeInRoster: true,
            updatedAt: timestamp,
        });
    }

    liveTesterUpdatedAt = timestamp;
    return getLiveTesterOutputsSnapshot();
}

export function getLiveTesterOutputsSnapshot() {
    return {
        updatedAt: liveTesterUpdatedAt,
        entries: Array.from(liveTesterOutputs.values()).map(cloneTesterOutput),
    };
}

export function getLiveTesterOutput(name) {
    const normalized = normalizeKey(name);
    if (!normalized) {
        return null;
    }
    const entry = liveTesterOutputs.get(normalized);
    return entry ? cloneTesterOutput(entry) : null;
}

export function clearLiveTesterOutputs() {
    liveTesterOutputs.clear();
    liveTesterUpdatedAt = Date.now();
    return liveTesterUpdatedAt;
}

export function listLiveTesterOutputs() {
    return Array.from(liveTesterOutputs.values()).map(cloneTesterOutput);
}

export function getLiveTesterOutputsMap() {
    return new Map(Array.from(liveTesterOutputs.entries()).map(([key, value]) => [key, cloneTesterOutput(value)]));
}

export function getRosterMember(name) {
    const normalized = normalizeKey(name);
    if (!normalized) {
        return null;
    }
    const entry = rosterMembers.get(normalized);
    return entry ? cloneRosterMember(entry) : null;
}

export function getRosterMembersMap() {
    return new Map(Array.from(rosterMembers.entries()).map(([key, value]) => [key, cloneRosterMember(value)]));
}

