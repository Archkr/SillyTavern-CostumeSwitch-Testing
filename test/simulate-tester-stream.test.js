import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = globalThis.__extensionSettingsStore || (globalThis.__extensionSettingsStore = {});

const { simulateTesterStream, state, extensionName } = await import("../index.js");
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
    patterns: ["Kotori", "Shido"],
    ignorePatterns: [],
    vetoPatterns: [],
    defaultCostume: "",
    debug: false,
    globalCooldownMs: 120000,
    perTriggerCooldownMs: 0,
    failedTriggerCooldownMs: 0,
    maxBufferChars: 24,
    repeatSuppressMs: 0,
    tokenProcessThreshold: 0,
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
    enableSceneRoster: true,
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
    };
    const compiled = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\\\p{L}\\\\p{M}\\\\p{N}_]",
        defaultPronouns: profile.pronounVocabulary,
    });
    state.compiledRegexes = compiled.regexes;
    return profile;
}

function createMessageState(profile) {
    return {
        lastAcceptedName: null,
        lastAcceptedTs: 0,
        vetoed: false,
        lastSubject: null,
        lastSubjectNormalized: null,
        pendingSubject: null,
        pendingSubjectNormalized: null,
        sceneRoster: new Set(),
        rosterTTL: profile.sceneRosterTTL,
        outfitRoster: new Map(),
        outfitTTL: profile.sceneRosterTTL,
        processedLength: 0,
        lastAcceptedIndex: -1,
        bufferOffset: 0,
    };
}

test("simulateTesterStream advances indices without redundant skips", () => {
    const profile = setupProfile();
    const bufKey = "tester";
    const msgState = createMessageState(profile);
    state.perMessageStates = new Map([[bufKey, msgState]]);
    state.perMessageBuffers = new Map([[bufKey, ""]]);

    const text = "Kotori leads the charge, Kotori steadies herself, and Shido watches closely.";
    const result = simulateTesterStream(text, profile, bufKey);

    const events = result.events.filter(event => event.type !== "veto");
    assert.ok(events.length >= 3, "expected at least three detection events");

    const indices = events.map(event => event.charIndex);
    const sorted = [...indices].sort((a, b) => a - b);
    assert.deepEqual(indices, sorted, "match indices should be monotonic");

    const skipped = events.filter(event => event.type === "skipped");
    const uniqueSkipIndices = new Set(skipped.map(event => event.charIndex));
    assert.equal(uniqueSkipIndices.size, skipped.length, "skip events should not repeat the same index");
});

test("pronoun detections are ignored until the subject is confirmed in the new message", () => {
    const profile = setupProfile({ detectPronoun: true, detectAction: true });
    const bufKey = "tester-pronoun";
    const msgState = createMessageState(profile);
    msgState.pendingSubject = "Kotori";
    msgState.pendingSubjectNormalized = msgState.pendingSubject.toLowerCase();
    state.perMessageStates = new Map([[bufKey, msgState]]);
    state.perMessageBuffers = new Map([[bufKey, ""]]);

    const text = "She moved quickly across the stage.";
    const result = simulateTesterStream(text, profile, bufKey);

    const switchEvents = result.events.filter(event => event.type === "switch");
    assert.equal(switchEvents.length, 0, "should not switch on an unconfirmed pronoun subject");
    assert.equal(msgState.lastSubject, null, "subject should remain unset until confirmed by a non-pronoun match");
});
