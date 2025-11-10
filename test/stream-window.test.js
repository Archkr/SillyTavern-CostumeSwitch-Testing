import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

import { renderActiveCharacters } from "../src/ui/render/activeCharacters.js";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = {};
globalThis.__extensionSettingsStore = extensionSettingsStore;

const { getWinner, extensionName, adjustWindowForTrim, handleStream, remapMessageKey, state, collectScenePanelState } = await import("../index.js");

const {
    applySceneRosterUpdate,
    replaceLiveTesterOutputs,
    clearLiveTesterOutputs,
    resetSceneState,
} = await import("../src/core/state.js");

extensionSettingsStore[extensionName] = {
    enabled: true,
    profiles: { Default: {} },
    activeProfile: "Default",
    scorePresets: {},
    activeScorePreset: "",
    focusLock: { character: null },
};

test("getWinner respects minimum index when roster bias is present", () => {
    const rosterSet = new Set(["kotori"]);
    const matches = [
        { name: "Kotori", matchKind: "vocative", matchIndex: 10, priority: 2 },
        { name: "Shido", matchKind: "action", matchIndex: 120, priority: 3 },
    ];

    const withoutFilter = getWinner(matches, 0, 200, {
        rosterSet,
        rosterBonus: 150,
        distancePenaltyWeight: 0,
    });
    assert.equal(withoutFilter?.name, "Kotori");

    const filtered = getWinner(matches, 0, 200, {
        rosterSet,
        rosterBonus: 150,
        distancePenaltyWeight: 0,
        minIndex: 10,
    });
    assert.equal(filtered?.name, "Shido");
});

test("adjustWindowForTrim tracks buffer offset and preserves prior indices", () => {
    const msgState = { processedLength: 0, lastAcceptedIndex: 42, bufferOffset: 0 };
    adjustWindowForTrim(msgState, 60, 120);
    assert.equal(msgState.bufferOffset, 60);
    assert.equal(msgState.processedLength, 180);
    assert.equal(msgState.lastAcceptedIndex, 42);
});

test("adjustWindowForTrim never shrinks processed length", () => {
    const msgState = { processedLength: 400, lastAcceptedIndex: 10, bufferOffset: 50 };
    adjustWindowForTrim(msgState, 30, 80);
    assert.equal(msgState.bufferOffset, 80);
    assert.equal(msgState.processedLength, 400);
});

test("adjustWindowForTrim grows processed length with new characters", () => {
    const msgState = { processedLength: 100, lastAcceptedIndex: -1, bufferOffset: 0 };
    adjustWindowForTrim(msgState, 0, 150);
    assert.equal(msgState.bufferOffset, 0);
    assert.equal(msgState.processedLength, 150);
});

test("handleStream logs focus lock status when locked", () => {
    const original$ = globalThis.$;
    const stubElement = {
        find: () => stubElement,
        toggleClass: () => stubElement,
        stop: () => stubElement,
        fadeIn: () => stubElement,
        fadeOut: (duration, callback) => {
            if (typeof callback === "function") {
                callback();
            }
            return stubElement;
        },
        removeClass: () => stubElement,
        text: () => stubElement,
        html: () => stubElement,
        prop: () => stubElement,
    };
    globalThis.$ = () => stubElement;

    const settings = extensionSettingsStore[extensionName];
    const previousFocusLock = settings.focusLock.character;
    const previousDebug = settings.profiles.Default.debug;

    settings.enabled = true;
    settings.focusLock.character = "Kotori";
    settings.profiles.Default.debug = true;
    state.focusLockNotice = { at: 0, character: null, displayName: null, message: null, event: null };

    const logs = [];
    const originalDebug = console.debug;
    console.debug = (...args) => { logs.push(args.join(" ")); };

    let noticeSnapshot = null;
    try {
        handleStream(0, "Hello");
        noticeSnapshot = { ...state.focusLockNotice };
    } finally {
        console.debug = originalDebug;
        settings.focusLock.character = previousFocusLock;
        settings.profiles.Default.debug = previousDebug;
        if (state.statusTimer) {
            clearTimeout(state.statusTimer);
            state.statusTimer = null;
        }
        state.focusLockNotice = { at: 0, character: null, displayName: null, message: null, event: null };
        if (typeof original$ === "undefined") {
            delete globalThis.$;
        } else {
            globalThis.$ = original$;
        }
    }

    assert.ok(logs.some(entry => entry.includes("Focus lock active;")));
    assert.ok(noticeSnapshot);
    assert.equal(noticeSnapshot.character, "kotori");
    assert.equal(noticeSnapshot.event.reason, "focus-lock");
    assert.equal(noticeSnapshot.event.matchKind, "focus-lock");
});

test("handleStream records veto phrase and recent events", () => {
    const original$ = globalThis.$;
    const statusMessages = [];
    const stubElement = {
        find: () => stubElement,
        toggleClass: () => stubElement,
        stop: () => stubElement,
        fadeIn: () => stubElement,
        fadeOut: (duration, callback) => {
            if (typeof callback === "function") {
                callback();
            }
            return stubElement;
        },
        removeClass: () => stubElement,
        text: (value) => {
            if (typeof value === "string") {
                statusMessages.push(value);
            }
            return stubElement;
        },
        html: (value) => {
            if (typeof value === "string") {
                statusMessages.push(value);
            }
            return stubElement;
        },
        prop: () => stubElement,
    };
    globalThis.$ = () => stubElement;

    const settings = extensionSettingsStore[extensionName];
    settings.enabled = true;
    settings.profiles.Default = settings.profiles.Default || {};
    settings.focusLock.character = null;

    state.recentDecisionEvents = [];
    state.lastVetoMatch = null;
    state.compiledRegexes = { vetoRegex: /OOC:/i, effectivePatterns: ["Kotori"] };
    state.currentGenerationKey = "live";
    state.perMessageStates = new Map([["live", {
        lastAcceptedName: null,
        lastAcceptedTs: 0,
        vetoed: false,
        lastSubject: null,
        lastSubjectNormalized: null,
        pendingSubject: null,
        pendingSubjectNormalized: null,
        sceneRoster: new Set(),
        outfitRoster: new Map(),
        rosterTTL: 5,
        outfitTTL: 5,
        processedLength: 0,
        lastAcceptedIndex: -1,
        bufferOffset: 0,
    }]]);
    state.perMessageBuffers = new Map([["live", ""]]);

    try {
        handleStream("OOC:");
    } finally {
        if (typeof original$ === "undefined") {
            delete globalThis.$;
        } else {
            globalThis.$ = original$;
        }
    }

    assert.equal(state.perMessageStates.get("live").vetoed, true, "message state should be marked vetoed");
    assert.ok(state.lastVetoMatch);
    assert.equal(state.lastVetoMatch.phrase, "OOC:");
    assert.ok(statusMessages.some(message => message.includes("Veto phrase")));
    const vetoEvents = state.recentDecisionEvents.filter(event => event.type === "veto");
    assert.equal(vetoEvents.length > 0, true, "expected veto event to be recorded");
    assert.equal(vetoEvents[vetoEvents.length - 1].match, "OOC:");
});

test("collectScenePanelState analytics updatedAt reflects latest scene activity", () => {
    resetSceneState();
    clearLiveTesterOutputs();

    state.recentDecisionEvents = [];
    state.topSceneRanking = new Map();
    state.topSceneRankingUpdatedAt = new Map();
    state.messageStats = new Map();
    state.perMessageBuffers = new Map();
    state.perMessageStates = new Map();
    state.latestTopRanking = { bufKey: null, ranking: [], fullRanking: [], updatedAt: 0 };
    state.currentGenerationKey = null;

    const messageKey = "m1";
    const rankingTimestamp = 4200;
    const testerTimestamp = 4800;
    const eventTimestamp = 5100;
    const rankingEntry = {
        name: "Kotori",
        normalized: "kotori",
        count: 3,
        bestPriority: 1,
        inSceneRoster: true,
        score: 100,
    };

    state.topSceneRanking.set(messageKey, [rankingEntry]);
    state.topSceneRankingUpdatedAt.set(messageKey, rankingTimestamp);
    state.latestTopRanking = {
        bufKey: messageKey,
        ranking: [rankingEntry],
        fullRanking: [rankingEntry],
        updatedAt: rankingTimestamp,
    };
    state.messageStats.set(messageKey, new Map([["kotori", 3]]));
    state.perMessageBuffers.set(messageKey, "Kotori waves.");
    state.recentDecisionEvents = [{ type: "switch", messageKey, timestamp: eventTimestamp }];

    applySceneRosterUpdate({ key: messageKey, roster: ["Kotori"], updatedAt: rankingTimestamp - 500 });
    replaceLiveTesterOutputs([], { roster: ["Kotori"], timestamp: testerTimestamp });

    const panelState = collectScenePanelState();
    assert.equal(panelState.analytics.updatedAt, eventTimestamp);

    state.recentDecisionEvents = [];
    const panelWithoutEvents = collectScenePanelState();
    assert.equal(panelWithoutEvents.analytics.updatedAt, testerTimestamp);
});

test("collectScenePanelState defers stream switch until new data is available", () => {
    resetSceneState();
    clearLiveTesterOutputs();

    state.recentDecisionEvents = [{ type: "switch", messageKey: "m1", timestamp: 1000 }];
    state.topSceneRanking = new Map();
    state.topSceneRankingUpdatedAt = new Map();
    state.messageStats = new Map([["m1", new Map([["kotori", 2]])]]);
    state.perMessageBuffers = new Map([
        ["m1", "Kotori waves."],
        ["live", ""],
    ]);
    state.perMessageStates = new Map();
    state.latestTopRanking = { bufKey: "m1", ranking: [], fullRanking: [], updatedAt: 1000 };
    state.currentGenerationKey = "live";

    const initialPanelState = collectScenePanelState();
    assert.equal(initialPanelState.analytics.messageKey, "m1");
    assert.equal(initialPanelState.analytics.buffer, "Kotori waves.");
    assert.equal(initialPanelState.isStreaming, false);

    state.perMessageBuffers.set("live", "Kotori smiles.");
    state.recentDecisionEvents.push({ type: "switch", messageKey: "live", timestamp: 2000 });

    const streamingPanelState = collectScenePanelState();
    assert.equal(streamingPanelState.analytics.messageKey, "live");
    assert.equal(streamingPanelState.analytics.buffer, "Kotori smiles.");
    assert.equal(streamingPanelState.isStreaming, true);
});

test("remapMessageKey retargets recent decision events for rendered messages", () => {
    const settings = extensionSettingsStore[extensionName];
    settings.session = settings.session || {};

    const sharedEvent = { type: "switch", messageKey: "live", name: "Kotori" };
    state.recentDecisionEvents = [
        sharedEvent,
        { type: "switch", messageKey: "m7", name: "Origami" },
    ];
    state.lastTesterReport = { events: [sharedEvent] };
    settings.session.recentDecisionEvents = [sharedEvent];

    remapMessageKey("live", "m101");

    assert.equal(state.recentDecisionEvents[0].messageKey, "m101");
    assert.equal(state.lastTesterReport.events[0].messageKey, "m101");
    assert.equal(settings.session.recentDecisionEvents[0].messageKey, "m101");
});

function createStubFragment() {
    return {
        nodeType: 11,
        children: [],
        appendChild(child) {
            if (!child) {
                return child;
            }
            if (child.parentNode && typeof child.parentNode.removeChild === "function") {
                child.parentNode.removeChild(child);
            }
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
    };
}

function createStubElement(tagName) {
    return {
        tagName: String(tagName || "").toUpperCase(),
        className: "",
        textContent: "",
        dataset: {},
        attributes: {},
        children: [],
        parentNode: null,
        appendChild(child) {
            if (!child) {
                return child;
            }
            if (child.nodeType === 11 && Array.isArray(child.children)) {
                const nodes = child.children.slice();
                child.children.length = 0;
                nodes.forEach((grandchild) => {
                    if (grandchild) {
                        this.appendChild(grandchild);
                    }
                });
                return child;
            }
            if (child.parentNode && typeof child.parentNode.removeChild === "function") {
                child.parentNode.removeChild(child);
            }
            child.parentNode = this;
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) {
                this.children.splice(index, 1);
                if (child) {
                    child.parentNode = null;
                }
            }
            return child;
        },
        get firstChild() {
            return this.children[0] || null;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
    };
}

function createStubDocument() {
    return {
        createElement(tagName) {
            return createStubElement(tagName);
        },
        createDocumentFragment() {
            return createStubFragment();
        },
    };
}

test("collectScenePanelState attaches recent events for active character rendering", () => {
    resetSceneState();
    clearLiveTesterOutputs();

    state.recentDecisionEvents = [];
    state.topSceneRanking = new Map();
    state.topSceneRankingUpdatedAt = new Map();
    state.messageStats = new Map();
    state.perMessageBuffers = new Map();
    state.perMessageStates = new Map();
    state.latestTopRanking = { bufKey: null, ranking: [], fullRanking: [], updatedAt: 0 };
    state.currentGenerationKey = null;

    const now = Date.now();
    const messageKey = "m501";
    const normalized = "kotori";
    const rankingEntry = {
        name: "Kotori",
        normalized,
        count: 5,
        score: 99,
        inSceneRoster: true,
    };

    state.currentGenerationKey = messageKey;
    state.perMessageBuffers.set(messageKey, "");
    state.messageStats.set(messageKey, new Map());
    state.topSceneRanking.set(messageKey, [rankingEntry]);
    state.topSceneRankingUpdatedAt.set(messageKey, now - 500);
    state.latestTopRanking = {
        bufKey: messageKey,
        ranking: [rankingEntry],
        fullRanking: [rankingEntry],
        updatedAt: now - 500,
    };

    const eventOne = {
        type: "switch",
        messageKey,
        normalized,
        matchKind: "name",
        charIndex: 0,
        timestamp: now - 3000,
    };
    const eventTwo = {
        type: "focus",
        messageKey,
        normalized,
        matchKind: "focus-lock",
        charIndex: 0,
        timestamp: now - 2000,
    };
    const eventThree = {
        type: "switch",
        messageKey,
        normalized,
        matchKind: "name",
        charIndex: 0,
        timestamp: now - 1000,
    };

    state.recentDecisionEvents = [eventOne, eventTwo, eventThree];

    const panelState = collectScenePanelState();

    assert.ok(Array.isArray(panelState.ranking));
    assert.equal(panelState.ranking.length, 1);
    assert.ok(Array.isArray(panelState.ranking[0].events));
    assert.equal(panelState.ranking[0].events.length, 2);
    assert.equal(panelState.ranking[0].events[0].timestamp, eventTwo.timestamp);
    assert.equal(panelState.ranking[0].events[1].timestamp, eventThree.timestamp);

    const previousDocument = globalThis.document;
    const stubDocument = createStubDocument();
    globalThis.document = stubDocument;

    try {
        const host = createStubElement("section");
        renderActiveCharacters({ el: host }, panelState);
        assert.equal(host.children.length > 0, true, "expected at least one rendered card");
        const card = host.children.find((child) => child.tagName === "ARTICLE");
        assert.ok(card, "expected ranking card element");
        const eventRow = card.children.find((child) => child.className === "cs-scene-active__event");
        assert.ok(eventRow, "expected event row to render for recent event");
        assert.ok(eventRow.textContent.includes("switch"), "expected event text to include event type");
    } finally {
        if (typeof previousDocument === "undefined") {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
});
