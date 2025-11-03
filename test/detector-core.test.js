import test from 'node:test';
import assert from 'node:assert/strict';

import {
    compileProfileRegexes,
    collectDetections,
} from '../src/detector-core.js';
import {
    DEFAULT_ACTION_VERBS_PRESENT,
    DEFAULT_ACTION_VERBS_THIRD_PERSON,
    DEFAULT_ACTION_VERBS_PAST,
    DEFAULT_ACTION_VERBS_PAST_PARTICIPLE,
    DEFAULT_ACTION_VERBS_PRESENT_PARTICIPLE,
    DEFAULT_ATTRIBUTION_VERBS_PRESENT,
    DEFAULT_ATTRIBUTION_VERBS_THIRD_PERSON,
    DEFAULT_ATTRIBUTION_VERBS_PAST,
    DEFAULT_ATTRIBUTION_VERBS_PAST_PARTICIPLE,
    DEFAULT_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE,
} from '../verbs.js';

const buildVerbList = (...lists) => Array.from(new Set(lists.flat().filter(Boolean)));

const DEFAULT_ACTION_VERB_FORMS = buildVerbList(
    DEFAULT_ACTION_VERBS_PRESENT,
    DEFAULT_ACTION_VERBS_THIRD_PERSON,
    DEFAULT_ACTION_VERBS_PAST,
    DEFAULT_ACTION_VERBS_PAST_PARTICIPLE,
    DEFAULT_ACTION_VERBS_PRESENT_PARTICIPLE,
);

const DEFAULT_ATTRIBUTION_VERB_FORMS = buildVerbList(
    DEFAULT_ATTRIBUTION_VERBS_PRESENT,
    DEFAULT_ATTRIBUTION_VERBS_THIRD_PERSON,
    DEFAULT_ATTRIBUTION_VERBS_PAST,
    DEFAULT_ATTRIBUTION_VERBS_PAST_PARTICIPLE,
    DEFAULT_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE,
);

test('collectDetections identifies action matches for narrative cues', () => {
    const profile = {
        patterns: ['Kotori', 'Reine', 'Shido', 'Tohka', 'Yuzuru', 'Kaguya'],
        ignorePatterns: [],
        attributionVerbs: DEFAULT_ATTRIBUTION_VERB_FORMS,
        actionVerbs: DEFAULT_ACTION_VERB_FORMS,
        pronounVocabulary: ['he', 'she', 'they'],
        detectAttribution: true,
        detectAction: true,
        detectVocative: true,
        detectPossessive: true,
        detectPronoun: true,
        detectGeneral: false,
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: '[\\p{L}\\p{M}\\p{N}_]',
        defaultPronouns: ['he', 'she', 'they'],
    });

    const sample = `"Umu! Shido is right to be concerned!" Tohka stepped forward, planting her hands on her hips. ` +
        `"Assertion. Yuzuru's combat abilities are optimized for zero-gravity maneuvering," Yuzuru added.`;

    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: {
            speaker: 5,
            attribution: 4,
            action: 3,
            pronoun: 2,
            vocative: 2,
            possessive: 1,
            name: 0,
        },
    });

    const actionMatches = matches.filter(match => match.matchKind === 'action').map(match => match.name);
    const attributionMatches = matches.filter(match => match.matchKind === 'attribution').map(match => match.name);

    assert.ok(actionMatches.includes('Tohka'), 'expected Tohka action detection');
    assert.ok(attributionMatches.includes('Yuzuru'), 'expected Yuzuru attribution detection');
});

test("collectDetections tolerates punctuation and honorifics near verbs", () => {
    const profile = {
        patterns: ["Kotori", "Li", "Anne"],
        ignorePatterns: [],
        attributionVerbs: [...DEFAULT_ATTRIBUTION_VERB_FORMS, "said"],
        actionVerbs: DEFAULT_ACTION_VERB_FORMS,
        pronounVocabulary: ["he", "she", "they"],
        detectAttribution: true,
        detectAction: true,
        detectVocative: false,
        detectPossessive: false,
        detectPronoun: false,
        detectGeneral: false,
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}\\p{N}_]",
        defaultPronouns: ["he", "she", "they"],
    });

    const sample = "\"Focus,\" Kotori-san, said the commander. "
        + "Li Wei — moved toward the hangar while Anne-Marie … moved toward the exit.";

    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: {
            speaker: 5,
            attribution: 4,
            action: 3,
        },
    });

    const attributionMatches = matches.filter(match => match.matchKind === "attribution").map(match => match.name);
    const actionMatches = matches.filter(match => match.matchKind === "action").map(match => match.name);

    assert.ok(attributionMatches.includes("Kotori"), "expected Kotori attribution detection with honorific punctuation");
    assert.ok(actionMatches.includes("Li"), "expected Li action detection for compound name with dash");
    assert.ok(actionMatches.includes("Anne"), "expected Anne action detection for hyphenated surname and ellipsis");
});
