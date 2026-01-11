import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = globalThis.__extensionSettingsStore || (globalThis.__extensionSettingsStore = {});

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
    const compiled = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}\\p{N}_]",
        defaultPronouns: profile.pronounVocabulary,
    });
    state.compiledRegexes = { ...compiled.regexes, effectivePatterns: compiled.effectivePatterns };
    return profile;
}

test("stream processing batches token bursts before flushing", () => {
    setupProfile();
    state.currentGenerationKey = "m1";
    state.currentGenerationRole = "assistant";
    state.perMessageStates = new Map();
    state.perMessageBuffers = new Map();
    state.pendingStreamBuffers = new Map();
    state.pendingStreamRoles = new Map();

    handleStream("xx");
    handleStream("yy");

    assert.equal(state.perMessageBuffers.get("m1"), undefined);
    assert.equal(state.pendingStreamBuffers.get("m1"), "xxyy");

    __testables.flushStreamQueue();

    assert.equal(state.perMessageBuffers.get("m1"), "xxyy");
    assert.equal(state.pendingStreamBuffers.size, 0);
});
