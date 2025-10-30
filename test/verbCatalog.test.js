import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

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
    EXTENDED_ACTION_VERBS_PRESENT,
    EXTENDED_ACTION_VERBS_THIRD_PERSON,
    EXTENDED_ACTION_VERBS_PAST,
    EXTENDED_ACTION_VERBS_PAST_PARTICIPLE,
    EXTENDED_ACTION_VERBS_PRESENT_PARTICIPLE,
    EXTENDED_ATTRIBUTION_VERBS_PRESENT,
    EXTENDED_ATTRIBUTION_VERBS_THIRD_PERSON,
    EXTENDED_ATTRIBUTION_VERBS_PAST,
    EXTENDED_ATTRIBUTION_VERBS_PAST_PARTICIPLE,
    EXTENDED_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE,
    VERB_CATALOG,
} from "../verbs.js";

const { getVerbInflections } = await import("../index.js");

test("third-person slices expose legacy and extended verbs", () => {
    assert.ok(DEFAULT_ATTRIBUTION_VERBS_THIRD_PERSON.includes("acknowledges"));
    assert.ok(EXTENDED_ATTRIBUTION_VERBS_THIRD_PERSON.includes("says"));
    assert.ok(DEFAULT_ACTION_VERBS_THIRD_PERSON.includes("runs"));
    assert.ok(EXTENDED_ACTION_VERBS_THIRD_PERSON.includes("accelerates"));
});

test("getVerbInflections exposes configurable tense slices", () => {
    const attribution = getVerbInflections("attribution", "default");
    assert.ok(attribution.thirdPerson.includes("acknowledges"));
    const extendedAction = getVerbInflections("action", "extended");
    assert.ok(extendedAction.base.includes("accelerate"));
    assert.ok(extendedAction.thirdPerson.includes("accelerates"));
});

test("tense-specific verb lists align with catalog forms", () => {
    const validations = [
        { name: "DEFAULT_ATTRIBUTION_VERBS_PRESENT", list: DEFAULT_ATTRIBUTION_VERBS_PRESENT, category: "attribution", edition: "default", form: "base" },
        { name: "DEFAULT_ATTRIBUTION_VERBS_THIRD_PERSON", list: DEFAULT_ATTRIBUTION_VERBS_THIRD_PERSON, category: "attribution", edition: "default", form: "thirdPerson" },
        { name: "DEFAULT_ATTRIBUTION_VERBS_PAST", list: DEFAULT_ATTRIBUTION_VERBS_PAST, category: "attribution", edition: "default", form: "past" },
        { name: "DEFAULT_ATTRIBUTION_VERBS_PAST_PARTICIPLE", list: DEFAULT_ATTRIBUTION_VERBS_PAST_PARTICIPLE, category: "attribution", edition: "default", form: "pastParticiple" },
        { name: "DEFAULT_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE", list: DEFAULT_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE, category: "attribution", edition: "default", form: "presentParticiple" },
        { name: "EXTENDED_ATTRIBUTION_VERBS_PRESENT", list: EXTENDED_ATTRIBUTION_VERBS_PRESENT, category: "attribution", edition: "extended", form: "base" },
        { name: "EXTENDED_ATTRIBUTION_VERBS_THIRD_PERSON", list: EXTENDED_ATTRIBUTION_VERBS_THIRD_PERSON, category: "attribution", edition: "extended", form: "thirdPerson" },
        { name: "EXTENDED_ATTRIBUTION_VERBS_PAST", list: EXTENDED_ATTRIBUTION_VERBS_PAST, category: "attribution", edition: "extended", form: "past" },
        { name: "EXTENDED_ATTRIBUTION_VERBS_PAST_PARTICIPLE", list: EXTENDED_ATTRIBUTION_VERBS_PAST_PARTICIPLE, category: "attribution", edition: "extended", form: "pastParticiple" },
        { name: "EXTENDED_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE", list: EXTENDED_ATTRIBUTION_VERBS_PRESENT_PARTICIPLE, category: "attribution", edition: "extended", form: "presentParticiple" },
        { name: "DEFAULT_ACTION_VERBS_PRESENT", list: DEFAULT_ACTION_VERBS_PRESENT, category: "action", edition: "default", form: "base" },
        { name: "DEFAULT_ACTION_VERBS_THIRD_PERSON", list: DEFAULT_ACTION_VERBS_THIRD_PERSON, category: "action", edition: "default", form: "thirdPerson" },
        { name: "DEFAULT_ACTION_VERBS_PAST", list: DEFAULT_ACTION_VERBS_PAST, category: "action", edition: "default", form: "past" },
        { name: "DEFAULT_ACTION_VERBS_PAST_PARTICIPLE", list: DEFAULT_ACTION_VERBS_PAST_PARTICIPLE, category: "action", edition: "default", form: "pastParticiple" },
        { name: "DEFAULT_ACTION_VERBS_PRESENT_PARTICIPLE", list: DEFAULT_ACTION_VERBS_PRESENT_PARTICIPLE, category: "action", edition: "default", form: "presentParticiple" },
        { name: "EXTENDED_ACTION_VERBS_PRESENT", list: EXTENDED_ACTION_VERBS_PRESENT, category: "action", edition: "extended", form: "base" },
        { name: "EXTENDED_ACTION_VERBS_THIRD_PERSON", list: EXTENDED_ACTION_VERBS_THIRD_PERSON, category: "action", edition: "extended", form: "thirdPerson" },
        { name: "EXTENDED_ACTION_VERBS_PAST", list: EXTENDED_ACTION_VERBS_PAST, category: "action", edition: "extended", form: "past" },
        { name: "EXTENDED_ACTION_VERBS_PAST_PARTICIPLE", list: EXTENDED_ACTION_VERBS_PAST_PARTICIPLE, category: "action", edition: "extended", form: "pastParticiple" },
        { name: "EXTENDED_ACTION_VERBS_PRESENT_PARTICIPLE", list: EXTENDED_ACTION_VERBS_PRESENT_PARTICIPLE, category: "action", edition: "extended", form: "presentParticiple" },
    ];

    for (const { name, list, category, edition, form } of validations) {
        const expected = new Set(
            VERB_CATALOG
                .filter(entry => Boolean(entry?.categories?.[category]?.[edition]))
                .map(entry => entry?.forms?.[form])
                .filter(Boolean),
        );

        const uniqueList = new Set(list);
        assert.strictEqual(list.length, uniqueList.size, `${name} should not contain duplicate verbs`);

        const sortedList = Array.from(uniqueList).sort();
        const sortedExpected = Array.from(expected).sort();
        assert.deepStrictEqual(
            sortedList,
            sortedExpected,
            `${name} should only include ${form} forms for ${edition} ${category} verbs`,
        );
    }
});
