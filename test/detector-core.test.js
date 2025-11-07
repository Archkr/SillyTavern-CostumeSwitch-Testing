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

test("collectDetections supports descriptive inserts before verbs", () => {
    const profile = {
        patterns: ["Maya", "Jules"],
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

    const sample = "\"Hold position,\" Maya, the ever-watchful captain of the gate, quietly said before turning away. "
        + "Jules (still catching his breath), shoulders tense, with a wary stride and focused eyes hurried toward the barricade.";

    const matches = collectDetections(sample, profile, regexes, {
        priorityWeights: {
            speaker: 5,
            attribution: 4,
            action: 3,
        },
    });

    const attributionMatches = matches.filter(match => match.matchKind === "attribution").map(match => match.name);
    const actionMatches = matches.filter(match => match.matchKind === "action").map(match => match.name);

    assert.ok(attributionMatches.includes("Maya"), "expected Maya attribution detection with descriptive clause");
    assert.ok(actionMatches.includes("Jules"), "expected Jules action detection with parenthetical and long runup");
});

test("collectDetections links mid-sentence pronouns to the last subject", () => {
    const profile = {
        patterns: ["Kotori", "Reine", "Strike Team"],
        ignorePatterns: [],
        attributionVerbs: [],
        actionVerbs: DEFAULT_ACTION_VERB_FORMS,
        pronounVocabulary: ["he", "she", "they"],
        detectAttribution: false,
        detectAction: false,
        detectVocative: false,
        detectPossessive: false,
        detectPronoun: true,
        detectGeneral: false,
    };

    const { regexes } = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}\\p{N}_]",
        defaultPronouns: ["he", "she", "they"],
    });

    const fixtures = [
        {
            description: "conjunction lead-in",
            subject: "Kotori",
            text: "Kotori stepped beside the console, and he charged toward the hatch before the alarms stopped.",
            expectedMatches: 1,
        },
        {
            description: "punctuation lead-in",
            subject: "Reine",
            text: "Reine watched the monitors; she hurried to seal the conduit before the hull buckled.",
            expectedMatches: 1,
        },
        {
            description: "dash lead-in without spacing",
            subject: "Strike Team",
            text: "Strike Team assembled—they sprinted across the platform to reach the evac shuttle.",
            expectedMatches: 1,
        },
    ];

    for (const { description, subject, text, expectedMatches } of fixtures) {
        const matches = collectDetections(text, profile, regexes, {
            lastSubject: subject,
        });

        const pronounMatches = matches.filter(match => match.matchKind === "pronoun");

        assert.equal(
            pronounMatches.length,
            expectedMatches,
            `expected ${expectedMatches} pronoun match(es) for ${description}`,
        );
        assert.ok(
            pronounMatches.every(match => match.name === subject),
            `expected pronoun matches to reference ${subject} for ${description}`,
        );
    }
});

test("compileProfileRegexes signals when all patterns are filtered out", () => {
    const profile = {
        patterns: ["Kotori", "Reine"],
        ignorePatterns: ["kotori", "reine"],
        attributionVerbs: DEFAULT_ATTRIBUTION_VERB_FORMS,
        actionVerbs: DEFAULT_ACTION_VERB_FORMS,
        pronounVocabulary: ["he", "she", "they"],
        detectAttribution: true,
        detectAction: true,
        detectVocative: false,
        detectPossessive: false,
        detectPronoun: false,
        detectGeneral: false,
    };

    const compilation = compileProfileRegexes(profile, {
        unicodeWordPattern: "[\\p{L}\\p{M}\\p{N}_]",
        defaultPronouns: ["he", "she", "they"],
    });

    assert.equal(compilation.effectivePatterns.length, 0, "expected no effective patterns after filtering");
    assert.equal(compilation.regexes.speakerRegex, null, "expected speaker detector to be disabled");

    const sample = "Kotori turned toward the console while Reine watched silently.";
    const matches = collectDetections(sample, profile, compilation.regexes, {
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

    assert.equal(matches.length, 0, "expected no detections when all patterns are filtered out");
});
