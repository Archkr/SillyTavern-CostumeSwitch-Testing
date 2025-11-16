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

test("collectDetections rescues standalone fuzzy tokens when general detection disabled", () => {
    const profile = {
        patternSlots: [
            { name: "Alice" },
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
        detectGeneral: false,
        fuzzyTolerance: "auto",
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Ailce waited near the hatch.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
        unicodeWordPattern: "[\\p{L}\\p{M}]",
    });

    const fallback = matches.find(entry => entry.matchKind === "fuzzy-fallback");
    assert.ok(fallback, "expected standalone fuzzy fallback match");
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

test("collectDetections suppresses lowercase connectors even when fallback scanning is enabled", () => {
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
    assert.ok(fallbackMatches.some(entry => entry.rawName === "Andres"), "expected near-miss fallback");
    const connectorMatches = fallbackMatches.filter(entry => entry.rawName?.toLowerCase() === "and");
    assert.equal(connectorMatches.length, 0, "should continue ignoring lowercase connectors");
});

test("collectDetections rescues lowercase speaker cues when fallback scanning is enabled", () => {
    const profile = {
        patternSlots: [
            { name: "Shido" },
        ],
        ignorePatterns: [],
        attributionVerbs: [],
        actionVerbs: [],
        pronounVocabulary: ["they"],
        detectAttribution: false,
        detectAction: false,
        detectVocative: false,
        detectPossessive: false,
        detectPronoun: false,
        detectGeneral: false,
        fuzzyTolerance: "auto",
        scanLowercaseFallbackTokens: true,
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}]",
        defaultPronouns: ["they"],
    });

    const sample = "> shdio waited at the doorway.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
        scanLowercaseFallbackTokens: true,
    });

    const fallbackMatches = matches.filter(entry => entry.matchKind === "fuzzy-fallback");
    const shidoFallback = fallbackMatches.find(entry => entry.rawName?.toLowerCase() === "shdio");
    assert.ok(shidoFallback, "expected lowercase speaker cue to survive fallback");
    assert.equal(shidoFallback.name, "Shido");
    assert.equal(shidoFallback.nameResolution?.method, "fuzzy");
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

test("collectDetections enforces fuzzy fallback score limits", () => {
    const profile = {
        patternSlots: [
            { name: "Kotori" },
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
        detectGeneral: false,
        fuzzyTolerance: {
            enabled: true,
            accentSensitive: true,
            lowConfidenceThreshold: 2,
            maxScore: 0.9,
        },
        fuzzyFallbackMaxScore: 0.5,
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}]",
        defaultPronouns: ["she"],
    });

    const sample = "Kufxk waited nearby. Kotoru turned away.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
        unicodeWordPattern: "[\\p{L}]",
        fuseOptions: { threshold: 0.9 },
    });

    const fallbackMatches = matches.filter(entry => entry.matchKind === "fuzzy-fallback");
    const lowScoreMatch = fallbackMatches.find(entry => entry.rawName === "Kotoru");
    assert.ok(lowScoreMatch, "expected near-match token to survive fallback");
    assert.equal(lowScoreMatch.name, "Kotori");
    assert.ok(lowScoreMatch.nameResolution?.score < 0.5, "expected fuzzy score recorded on resolution");

    const highScoreMatch = fallbackMatches.find(entry => entry.rawName === "Kufxk");
    assert.equal(highScoreMatch, undefined, "expected distant token to be rejected by score limit");
});

test("collectDetections throttles repeated fuzzy fallback candidates", () => {
    const profile = {
        patternSlots: [
            { name: "Alice" },
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
        detectGeneral: false,
        fuzzyTolerance: "auto",
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}]",
        defaultPronouns: ["she"],
    });

    const sample = "Ailce waved. Ailce waved again. Ailce waved a third time.";
    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: { name: 1 },
        unicodeWordPattern: "[\\p{L}\\p{M}]",
    });

    const fallbackMatches = matches.filter(entry => entry.matchKind === "fuzzy-fallback");
    assert.equal(fallbackMatches.length, 1, "expected only the first fuzzy fallback candidate to register");
    assert.equal(fallbackMatches[0]?.rawName, "Ailce");
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
