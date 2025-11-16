import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const {
    compileProfileRegexes,
    collectDetections,
} = await import("../src/detector-core.js");

const {
    resolveOutfitForMatch,
    rebuildMappingLookup,
    extensionName,
} = await import("../index.js");

import { normalizeProfile } from "../profile-utils.js";

const extensionSettingsStore = {};
globalThis.__extensionSettingsStore = extensionSettingsStore;

test("collectDetections normalizes accented candidates when fuzzy tolerance active", () => {
    const profile = {
        patternSlots: [
            { name: "Fátima", aliases: ["Fatima"] },
            { name: "Renée", aliases: ["Renee"] },
        ],
        ignorePatterns: [],
        attributionVerbs: [],
        actionVerbs: [],
        pronounVocabulary: ["she"],
        detectAttribution: false,
        detectAction: false,
        detectVocative: false,
        detectPossessive: false,
        detectPronoun: false,
        detectGeneral: true,
        fuzzyTolerance: "auto",
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}\\p{N}_]",
        defaultPronouns: ["she"],
    });

    const sample = "Fatima and Renee shared notes.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
    });

    const normalized = matches
        .filter(entry => entry.matchKind === "name")
        .map(entry => ({ name: entry.name, raw: entry.rawName, resolution: entry.nameResolution }));

    assert.equal(normalized.length, 2);
    const fatima = normalized.find(entry => entry.name === "Fátima");
    assert.ok(fatima, "expected Fátima canonical name");
    assert.equal(fatima.raw, "Fatima");
    assert.equal(fatima.resolution?.canonical, "Fátima");
    assert.equal(fatima.resolution?.changed, true);

    const renee = normalized.find(entry => entry.name === "Renée");
    assert.ok(renee, "expected Renée canonical name");
    assert.equal(renee.raw, "Renee");
    assert.equal(renee.resolution?.canonical, "Renée");
    assert.equal(renee.resolution?.changed, true);
    assert.ok(matches.fuzzyResolution.aliasCount >= 2);
    assert.equal(matches.fuzzyResolution.mode, "auto");
});

test("collectDetections rescues near-miss tokens when fuzzy tolerance active", () => {
    const profile = {
        patternSlots: [
            { name: "Alice" },
            { name: "Kotori" },
        ],
        ignorePatterns: [],
        attributionVerbs: [],
        actionVerbs: ["reached"],
        pronounVocabulary: ["she"],
        detectAttribution: false,
        detectAction: true,
        detectVocative: false,
        detectPossessive: false,
        detectPronoun: false,
        detectGeneral: true,
        fuzzyTolerance: "auto",
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Ailce reached for her staff.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { action: 1, name: 1 },
        unicodeWordPattern: "[\\p{L}\\p{M}]",
    });
    const rescued = matches.find(entry => entry.matchKind === "fuzzy-fallback");
    assert.ok(rescued, "expected fuzzy fallback match");
    assert.equal(rescued.name, "Alice");
    assert.equal(rescued.rawName, "Ailce");
    assert.equal(rescued.nameResolution?.method, "fuzzy");
    assert.equal(rescued.nameResolution?.canonical, "Alice");
    assert.equal(matches.fuzzyResolution.used, true);
});

test("resolveOutfitForMatch reuses fuzzy resolution for mapping lookup", () => {
    const profileDraft = {
        enableOutfits: true,
        fuzzyTolerance: "auto",
        translateFuzzyNames: false,
        mappings: [
            {
                name: "Chloé",
                defaultFolder: "chloe/base",
                fuzzyTolerance: "auto",
                outfits: [],
            },
        ],
    };

    const profile = normalizeProfile(profileDraft, profileDraft);
    extensionSettingsStore[extensionName] = {
        enabled: true,
        profiles: { Default: profile },
        activeProfile: "Default",
        scorePresets: {},
        activeScorePreset: "",
        focusLock: { character: null },
    };
    rebuildMappingLookup(profile);

    const result = resolveOutfitForMatch("Chloe", { profile, rawName: "Chloe" });
    assert.equal(result.folder, "chloe/base");
    assert.equal(result.normalizedName, "Chloé");
    assert.equal(result.rawName, "Chloe");
    assert.equal(result.canonicalName, "Chloé");
    assert.equal(result.nameResolution?.canonical, "Chloé");
});
