import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = {};
globalThis.__extensionSettingsStore = extensionSettingsStore;

const { getWinner, extensionName, adjustWindowForTrim, handleStream, state } = await import("../index.js");

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
