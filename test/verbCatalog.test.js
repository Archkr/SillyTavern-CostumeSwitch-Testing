import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

import {
    DEFAULT_ACTION_VERBS_THIRD_PERSON,
    DEFAULT_ATTRIBUTION_VERBS_THIRD_PERSON,
    EXTENDED_ACTION_VERBS_THIRD_PERSON,
    EXTENDED_ATTRIBUTION_VERBS_THIRD_PERSON,
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
