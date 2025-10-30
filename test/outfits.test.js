import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = {};
globalThis.__extensionSettingsStore = extensionSettingsStore;

const {
    resolveOutfitForMatch,
    evaluateSwitchDecision,
    rebuildMappingLookup,
    extensionName,
} = await import("../index.js");

import { normalizeProfile } from "../profile-utils.js";

const PROFILE_BASE = {
    enableOutfits: true,
    sceneRosterTTL: 3,
    globalCooldownMs: 0,
    perTriggerCooldownMs: 0,
    failedTriggerCooldownMs: 0,
    mappings: [],
};

function setupProfile(overrides = {}) {
    const profile = normalizeProfile({
        ...PROFILE_BASE,
        ...overrides,
    }, PROFILE_BASE);
    extensionSettingsStore[extensionName] = {
        enabled: true,
        profiles: { Default: profile },
        activeProfile: "Default",
        scorePresets: {},
        activeScorePreset: "", 
        focusLock: { character: null },
    };
    rebuildMappingLookup(profile);
    return profile;
}

test("resolveOutfitForMatch selects variant by trigger match", () => {
    const profile = setupProfile({
        mappings: [
            {
                name: "Alice",
                defaultFolder: "alice/base",
                outfits: [
                    { folder: "alice/battle", triggers: ["sword"] },
                    { folder: "alice/formal", triggers: ["gown"] },
                ],
            },
        ],
    });

    const result = resolveOutfitForMatch("Alice", {
        profile,
        context: { text: "Alice raises her sword before the duel." },
    });

    assert.equal(result.folder, "alice/battle");
    assert.equal(result.reason, "trigger-match");
    assert.equal(result.trigger.pattern, "sword");
});

test("resolveOutfitForMatch honors matchKinds filters", () => {
    const profile = setupProfile({
        mappings: [
            {
                name: "Alex",
                defaultFolder: "alex/base",
                outfits: [
                    { folder: "alex/dialogue", matchKinds: ["speaker", "vocative"] },
                    { folder: "alex/action", matchKinds: ["action"] },
                ],
            },
        ],
    });

    const speaker = resolveOutfitForMatch("Alex", {
        profile,
        context: { matchKind: "speaker" },
    });
    assert.equal(speaker.folder, "alex/dialogue");

    const action = resolveOutfitForMatch("Alex", {
        profile,
        context: { matchKind: "action" },
    });
    assert.equal(action.folder, "alex/action");

    const fallback = resolveOutfitForMatch("Alex", {
        profile,
        context: { matchKind: "pronoun" },
    });
    assert.equal(fallback.folder, "alex/base");
    assert.equal(fallback.reason, "default-folder");
});

test("resolveOutfitForMatch respects awareness requirements", () => {
    const profile = setupProfile({
        mappings: [
            {
                name: "Bob",
                defaultFolder: "bob/base",
                outfits: [
                    { folder: "bob/solo", triggers: [], awareness: { excludes: ["Alice"] } },
                    { folder: "bob/team", triggers: [], awareness: { requires: ["Alice"] } },
                ],
            },
        ],
    });

    const roster = new Set(["alice"]);
    const result = resolveOutfitForMatch("Bob", {
        profile,
        context: { roster },
    });

    assert.equal(result.folder, "bob/team");
    const fallback = resolveOutfitForMatch("Bob", {
        profile,
        context: { roster: new Set(["charlie"]) },
    });

    assert.equal(fallback.folder, "bob/solo");
});

test("evaluateSwitchDecision caches outfit selections", () => {
    const profile = setupProfile({
        perTriggerCooldownMs: 0,
        mappings: [
            {
                name: "Cara",
                defaultFolder: "cara/base",
                outfits: [
                    { folder: "cara/action", triggers: ["blade"] },
                ],
            },
        ],
    });

    const runtime = {
        lastIssuedCostume: null,
        lastIssuedFolder: null,
        lastSwitchTimestamp: 0,
        lastTriggerTimes: new Map(),
        failedTriggerTimes: new Map(),
        characterOutfits: new Map(),
    };

    const first = evaluateSwitchDecision("Cara", {
        matchKind: "action",
        context: { text: "Cara draws her blade." },
    }, runtime, 1000);

    assert.ok(first.shouldSwitch, "first decision should switch");
    assert.equal(first.folder, "cara/action");
    runtime.lastIssuedCostume = first.name;
    runtime.lastIssuedFolder = first.folder;
    runtime.lastSwitchTimestamp = first.now;
    runtime.lastTriggerTimes.set(first.folder, first.now);
    runtime.characterOutfits.set(first.name.toLowerCase(), { folder: first.folder, updatedAt: first.now });

    const second = evaluateSwitchDecision("Cara", {
        matchKind: "action",
        context: { text: "Cara keeps her blade ready." },
    }, runtime, 200);

    assert.equal(second.shouldSwitch, false);
    assert.equal(second.reason, "outfit-unchanged");
});

test("per-trigger cooldown still applies with outfits", () => {
    const profile = setupProfile({
        perTriggerCooldownMs: 1000,
        mappings: [
            {
                name: "Dana",
                defaultFolder: "dana/base",
                outfits: [
                    { folder: "dana/combat", triggers: ["axe"] },
                ],
            },
        ],
    });

    const runtime = {
        lastIssuedCostume: null,
        lastIssuedFolder: null,
        lastSwitchTimestamp: 0,
        lastTriggerTimes: new Map(),
        failedTriggerTimes: new Map(),
        characterOutfits: new Map(),
    };

    const first = evaluateSwitchDecision("Dana", {
        matchKind: "action",
        context: { text: "Dana hefts her axe." },
    }, runtime, 1000);

    assert.ok(first.shouldSwitch, first.reason);
    runtime.lastIssuedCostume = first.name;
    runtime.lastIssuedFolder = first.folder;
    runtime.lastSwitchTimestamp = first.now;
    runtime.lastTriggerTimes.set(first.folder, first.now);
    runtime.characterOutfits.set(first.name.toLowerCase(), { folder: first.folder, updatedAt: first.now });

    runtime.characterOutfits.clear();
    runtime.lastIssuedFolder = null;

    const second = evaluateSwitchDecision("Dana", {
        matchKind: "action",
        context: { text: "Dana twirls her axe." },
    }, runtime, 1400);

    assert.equal(second.shouldSwitch, false);
    assert.equal(second.reason, "per-trigger-cooldown");
});

test("evaluateSwitchDecision switches characters sharing the same outfit folder", () => {
    setupProfile({
        mappings: [
            { name: "Hero", defaultFolder: "shared/outfit", outfits: [] },
            { name: "Rival", defaultFolder: "shared/outfit", outfits: [] },
        ],
    });

    const runtime = {
        lastIssuedCostume: "Hero",
        lastIssuedFolder: "shared/outfit",
        lastSwitchTimestamp: 0,
        lastTriggerTimes: new Map([["shared/outfit", 1000]]),
        failedTriggerTimes: new Map(),
        characterOutfits: new Map([["hero", { folder: "shared/outfit", updatedAt: 1000 }]]),
    };

    const decision = evaluateSwitchDecision("Rival", { matchKind: "action" }, runtime, 2000);

    assert.equal(decision.shouldSwitch, true, decision.reason);
    assert.equal(decision.name, "Rival");
    assert.equal(decision.folder, "shared/outfit");
});
