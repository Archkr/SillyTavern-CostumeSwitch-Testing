import test from "node:test";
import assert from "node:assert/strict";

import { __testing } from "../src/systems/integration/sillytavern.js";

const { resolveEventIdentifiers } = __testing;

test("resolveEventIdentifiers matches regex-based candidates", () => {
    const eventTypes = {
        GENERATION_STOPPED: "generation_stopped",
        STREAM_TOKEN_EVENT: "stream_token_event",
    };
    const result = resolveEventIdentifiers(eventTypes, [
        { match: /(GENERATION|STREAM).*STOP/i },
    ]);
    assert.deepEqual(result, ["generation_stopped"], "should map matching keys to resolved event names");
});

test("resolveEventIdentifiers falls back to provided names when no matches", () => {
    const eventTypes = {};
    const result = resolveEventIdentifiers(eventTypes, [
        { match: /(GENERATION|STREAM).*STOP/i, fallback: ["GENERATION_STOPPED", "STREAM_STOPPED"] },
    ]);
    assert.deepEqual(result, ["GENERATION_STOPPED", "STREAM_STOPPED"], "should return fallback names when no mapping exists");
});

test("resolveEventIdentifiers still accepts explicit string candidates", () => {
    const eventTypes = {
        STREAM_TOKEN: "stream_token",
    };
    const result = resolveEventIdentifiers(eventTypes, ["STREAM_TOKEN", "GENERATION_TOKEN"]);
    assert.deepEqual(result.sort(), ["GENERATION_TOKEN", "stream_token"].sort(), "should include mapped and literal names");
});
