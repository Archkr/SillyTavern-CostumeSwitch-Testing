import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = globalThis.__extensionSettingsStore || (globalThis.__extensionSettingsStore = {});

if (typeof globalThis.$ === "undefined") {
    globalThis.$ = () => ({
        find: () => ({ html: () => {}, text: () => {} }),
        toggleClass: () => {},
        html: () => {},
        stop: () => ({ fadeIn: () => {} }),
        fadeIn: () => {},
        fadeOut: (_duration, cb) => {
            if (typeof cb === "function") {
                cb();
            }
        },
        text: () => {},
        removeClass: () => ({ fadeIn: () => {} }),
        length: 1,
    });
}

const { state, extensionName, __testables, handleStream } = await import("../index.js");
const { compileProfileRegexes } = await import("../src/detector-core.js");

const baseSettings = {
    enabled: true,
    profiles: {},
    activeProfile: "Test",
    scorePresets: {},
    activeScorePreset: "",
    focusLock: { character: null },
};

const baseProfile = {
    patterns: ["Kotori"],
    ignorePatterns: [],
    vetoPatterns: [],
    defaultCostume: "",
    debug: false,
    globalCooldownMs: 120000,
    perTriggerCooldownMs: 0,
    failedTriggerCooldownMs: 0,
    maxBufferChars: 24,
    repeatSuppressMs: 0,
    mappings: [],
    enableOutfits: false,
    detectAttribution: false,
    detectAction: false,
    detectVocative: false,
    detectPossessive: false,
    detectPronoun: false,
    detectGeneral: true,
    pronounVocabulary: ["he", "she", "they"],
    attributionVerbs: ["said"],
    actionVerbs: ["moved"],
    detectionBias: 0,
    enableSceneRoster: false,
    sceneRosterTTL: 5,
    prioritySpeakerWeight: 5,
    priorityAttributionWeight: 4,
    priorityActionWeight: 3,
    priorityPronounWeight: 2,
    priorityVocativeWeight: 2,
    priorityPossessiveWeight: 1,
    priorityNameWeight: 0,
    rosterBonus: 150,
    rosterPriorityDropoff: 0.5,
    distancePenaltyWeight: 1,
};

function setupProfile(overrides = {}) {
    const profile = { ...baseProfile, ...overrides };
    extensionSettingsStore[extensionName] = {
        ...baseSettings,
        profiles: { Test: profile },
        session: {},
    };
    state.streamingDetectionLastKey = null;
    state.streamingDetectionLastLength = null;
    const compiled = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}\\p{N}_]",
        defaultPronouns: profile.pronounVocabulary,
    });
    state.compiledRegexes = { ...compiled.regexes, effectivePatterns: compiled.effectivePatterns };
    return profile;
}

test("stream processing writes token bursts immediately when no queue is active", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    handleStream("xx");
    handleStream("yy");

    assert.equal(state.perMessageBuffers.get("m1"), "xxyy");
    assert.equal(state.pendingStreamBuffers.size, 0);

    __testables.flushStreamQueue();

    assert.equal(state.perMessageBuffers.get("m1"), "xxyy");
    assert.equal(state.pendingStreamBuffers.size, 0);
});

test("handleStream processes token text when snapshot text is empty", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    globalThis.__mockContext = {
        chat: [
            { mesId: 1, mes: "", is_user: false },
        ],
    };

    try {
        handleStream("Kotori");
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        delete globalThis.__mockContext;
    }

    assert.equal(state.perMessageBuffers.get("m1"), "Kotori");
});

test("handleStream resolves a stream key from chat when tokens lack metadata", () => {
    setupProfile();
    state.currentGenerationKey = null;
    state.currentGenerationRole = null;
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    globalThis.__mockContext = {
        chat: [
            { mesId: 3, mes: "", message_key: "m3", is_user: false },
        ],
    };

    try {
        handleStream("Ko");
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        delete globalThis.__mockContext;
    }

    assert.equal(state.currentGenerationKey, "m3");
    assert.equal(state.perMessageBuffers.get("m3"), "Ko");
});

test("handleStream adopts a streaming processor message id when token metadata is missing", () => {
    setupProfile();
    state.currentGenerationKey = null;
    state.currentGenerationRole = null;
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    globalThis.__mockContext = {
        chat: [
            { mes: "", is_user: false },
        ],
        streamingProcessor: {
            messageId: 0,
        },
    };

    try {
        handleStream("Kotori");
        __testables.flushStreamQueue();
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        delete globalThis.__mockContext;
    }

    assert.equal(state.currentGenerationKey, "m0");
    assert.ok(state.perMessageStates.has("m0"));
});

test("handleStream prefers chat message metadata ids over streaming processor indices", () => {
    setupProfile();
    state.currentGenerationKey = null;
    state.currentGenerationRole = null;
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    globalThis.__mockContext = {
        chat: [
            { mes: "", is_user: false, extra: { message_id: 142 } },
        ],
        streamingProcessor: {
            messageId: 0,
        },
    };

    try {
        handleStream("Kotori");
        __testables.flushStreamQueue();
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        delete globalThis.__mockContext;
    }

    assert.equal(state.currentGenerationKey, "m142");
    assert.ok(state.perMessageStates.has("m142"));
});

test("handleStream prefers the streaming processor buffer when available", () => {
    setupProfile();
    state.currentGenerationKey = null;
    state.currentGenerationRole = null;
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    globalThis.__mockContext = {
        chat: [
            { mesId: 7, mes: "", message_key: "m7", is_user: false },
        ],
        streamingProcessor: {
            messageId: 0,
            result: "Kotori",
        },
    };

    try {
        handleStream();
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        if (state.statusTimer) {
            clearTimeout(state.statusTimer);
            state.statusTimer = null;
        }
        delete globalThis.__mockContext;
    }

    assert.equal(state.currentGenerationKey, "m7");
    assert.equal(state.perMessageBuffers.get("m7"), "Kotori");
});

test("handleStream remaps a stale generation key to the active streaming message", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    globalThis.__mockContext = {
        chat: [
            { mesId: 1, mes: "Previous", message_key: "m1", is_user: false },
            { mesId: 7, mes: "", message_key: "m7", is_user: false },
        ],
        streamingProcessor: {
            messageId: 1,
            result: "Kotori",
        },
    };

    try {
        handleStream();
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        if (state.statusTimer) {
            clearTimeout(state.statusTimer);
            state.statusTimer = null;
        }
        delete globalThis.__mockContext;
    }

    assert.equal(state.currentGenerationKey, "m7");
    assert.equal(state.perMessageBuffers.get("m7"), "Kotori");
});

test("streaming detection updates stats before streaming ends", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.messageStats = new Map();
    state.messageMatches = new Map();
    state.streamingDetectionLastAt = 0;

    try {
        handleStream("Kotori");
        __testables.flushStreamingDetectionPass({ forceKey: "m1", forceRole: "assistant" });
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        if (state.streamingDetectionTimer) {
            clearTimeout(state.streamingDetectionTimer);
            state.streamingDetectionTimer = null;
        }
    }

    const stats = state.messageStats.get("m1");
    assert.ok(stats instanceof Map, "expected message stats to be populated during streaming");
    assert.ok(stats.size > 0, "expected streaming detection to add stats before generation completes");
});

test("streaming detection uses the latest non-empty buffer", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.messageStats = new Map();
    state.messageMatches = new Map();
    state.streamingDetectionLastAt = Date.now();

    try {
        handleStream("Ko");
        handleStream("tori");
        __testables.flushStreamingDetectionPass({ forceKey: "m1", forceRole: "assistant" });
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        if (state.streamingDetectionTimer) {
            clearTimeout(state.streamingDetectionTimer);
            state.streamingDetectionTimer = null;
        }
    }

    const buffer = state.perMessageBuffers.get("m1") || "";
    const matchCache = state.messageMatches.get("m1");
    assert.ok(buffer.length > 0, "expected the streaming buffer to be non-empty");
    assert.ok(matchCache, "expected a match cache to be created during streaming detection");
    assert.equal(matchCache.processedAbsolute, buffer.length - 1, "expected detection to process the latest buffer length");
});

test("streaming detection skips duplicate passes without new buffer content", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.messageStats = new Map();
    state.messageMatches = new Map();

    try {
        handleStream("Kotori");
        __testables.flushStreamingDetectionPass({ forceKey: "m1", forceRole: "assistant" });

        const msgState = state.perMessageStates.get("m1");
        const firstRuns = msgState?.detectionContext?.metrics?.incrementalRuns ?? 0;

        __testables.flushStreamingDetectionPass({ forceKey: "m1", forceRole: "assistant" });

        const secondRuns = msgState?.detectionContext?.metrics?.incrementalRuns ?? 0;
        assert.equal(secondRuns, firstRuns, "expected duplicate pass to skip reprocessing");
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        if (state.streamingDetectionTimer) {
            clearTimeout(state.streamingDetectionTimer);
            state.streamingDetectionTimer = null;
        }
    }
});

test("streaming detection runs again after the stream key changes", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.messageStats = new Map();
    state.messageMatches = new Map();

    try {
        handleStream("Kotori");
        __testables.flushStreamingDetectionPass({ forceKey: "m1", forceRole: "assistant" });

        const firstRuns = state.perMessageStates.get("m1")?.detectionContext?.metrics?.incrementalRuns ?? 0;

        state.currentGenerationKey = "m2";
        state.currentGenerationRole = "assistant";

        handleStream("Kotori");
        __testables.flushStreamingDetectionPass({ forceKey: "m2", forceRole: "assistant" });

        const secondRuns = state.perMessageStates.get("m2")?.detectionContext?.metrics?.incrementalRuns ?? 0;
        assert.ok(firstRuns > 0, "expected initial streaming detection to run");
        assert.ok(secondRuns > 0, "expected detection to run for the new stream key");
    } finally {
        if (state.pendingStreamTimer) {
            clearTimeout(state.pendingStreamTimer);
            state.pendingStreamTimer = null;
        }
        if (state.streamSnapshotTimer) {
            clearInterval(state.streamSnapshotTimer);
            state.streamSnapshotTimer = null;
        }
        if (state.streamingDetectionTimer) {
            clearTimeout(state.streamingDetectionTimer);
            state.streamingDetectionTimer = null;
        }
    }
});
