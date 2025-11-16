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
    const rescued = matches.find(entry => entry.rawName === "Ailce");
    assert.ok(rescued, "expected fuzzy fallback match");
    assert.equal(rescued.name, "Alice");
    assert.equal(rescued.matchKind, "action");
    assert.equal(rescued.nameResolution?.method, "fuzzy");
    assert.equal(rescued.nameResolution?.canonical, "Alice");
    assert.equal(matches.fuzzyResolution.used, true);
});

test("collectDetections rescues short names that only differ by one character", () => {
    const profile = {
        patternSlots: [
            { name: "Miku" },
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

    const sample = "Miki reached for her staff.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { action: 1 },
        unicodeWordPattern: "[\\p{L}\\p{M}]",
    });

    const rescued = matches.find(entry => entry.rawName === "Miki");
    assert.ok(rescued, "expected near-miss fallback for short name");
    assert.equal(rescued.name, "Miku");
    assert.equal(rescued.nameResolution?.method, "fuzzy");
    assert.equal(rescued.nameResolution?.canonical, "Miku");
});

test("collectDetections rescues action cues when general detection disabled", () => {
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
        detectGeneral: false,
        fuzzyTolerance: "auto",
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Ailce reached for her staff.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { action: 3 },
        unicodeWordPattern: "[\\p{L}\\p{M}]",
    });
    const fallback = matches.find(entry => entry.matchKind === "action");
    assert.ok(fallback, "expected action fallback match");
    assert.equal(fallback.name, "Alice");
    assert.equal(fallback.rawName, "Ailce");
    assert.equal(fallback.nameResolution?.method, "fuzzy");
    assert.equal(matches.fuzzyResolution.used, true);
});

test("collectDetections ignores lowercase connectors for fuzzy fallback tokens", () => {
    const profile = {
        patternSlots: [
            { name: "Anders" },
            { name: "Butler" },
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
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Andres waited and but and looked ahead.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
    });
    const fallbackMatches = matches.filter(entry => entry.matchKind === "fuzzy-fallback");
    assert.ok(fallbackMatches.some(entry => entry.rawName === "Andres"), "expected near-miss fallback");
    const connectorMatches = fallbackMatches.filter(entry => {
        const lowered = entry.rawName?.toLowerCase();
        return lowered === "and" || lowered === "but";
    });
    assert.equal(connectorMatches.length, 0, "should ignore lowercase connectors");
});

test("collectDetections can opt into lowercase fallback scanning when requested", () => {
    const profile = {
        patternSlots: [
            { name: "Anders" },
            { name: "Butler" },
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
        scanLowercaseFallbackTokens: true,
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Andres waited and but and looked ahead.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
    });
    const fallbackMatches = matches.filter(entry => entry.matchKind === "fuzzy-fallback");
    const connectorMatches = fallbackMatches.filter(entry => entry.rawName?.toLowerCase() === "and");
    assert.ok(connectorMatches.length >= 1, "expected lowercase connector when opt-in enabled");
});

test("collectDetections ignores capitalized words with low character overlap", () => {
    const profile = {
        patternSlots: [
            { name: "Yoshinon" },
            { name: "Nia" },
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
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Now, at her eye level, the conversation paused.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
    });

    const fallbackMatches = matches.filter(entry => entry.matchKind === "fuzzy-fallback");
    const nowMatch = fallbackMatches.find(entry => entry.rawName === "Now");
    assert.equal(nowMatch, undefined, "capitalized adverbs should not fuzzy-match characters");
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
