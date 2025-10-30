import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = {};
globalThis.__extensionSettingsStore = extensionSettingsStore;

const { getWinner, extensionName, adjustWindowForTrim } = await import("../index.js");

extensionSettingsStore[extensionName] = {
    enabled: true,
    profiles: { Default: {} },
    activeProfile: "Default",
    scorePresets: {},
    activeScorePreset: "",
    focusLock: { character: null },
};

test("getWinner respects minimum index when roster bias is present", () => {
    const rosterSet = new Set(["kotori"]);
    const matches = [
        { name: "Kotori", matchKind: "vocative", matchIndex: 10, priority: 2 },
        { name: "Shido", matchKind: "action", matchIndex: 120, priority: 3 },
    ];

    const withoutFilter = getWinner(matches, 0, 200, {
        rosterSet,
        rosterBonus: 150,
        distancePenaltyWeight: 0,
    });
    assert.equal(withoutFilter?.name, "Kotori");

    const filtered = getWinner(matches, 0, 200, {
        rosterSet,
        rosterBonus: 150,
        distancePenaltyWeight: 0,
        minIndex: 10,
    });
    assert.equal(filtered?.name, "Shido");
});

test("adjustWindowForTrim re-bases processed state when the buffer trims", () => {
    const msgState = { processedLength: 6000, lastAcceptedIndex: 5800 };
    adjustWindowForTrim(msgState, 120, 6000);
    assert.equal(msgState.processedLength, 5880);
    assert.equal(msgState.lastAcceptedIndex, 5680);
});

test("adjustWindowForTrim clears stale indices when trimming surpasses them", () => {
    const msgState = { processedLength: 50, lastAcceptedIndex: 20 };
    adjustWindowForTrim(msgState, 100, 3000);
    assert.equal(msgState.processedLength, 0);
    assert.equal(msgState.lastAcceptedIndex, -1);
});

test("adjustWindowForTrim clamps processed length to the combined window", () => {
    const msgState = { processedLength: 200, lastAcceptedIndex: 10 };
    adjustWindowForTrim(msgState, 0, 150);
    assert.equal(msgState.processedLength, 150);
    assert.equal(msgState.lastAcceptedIndex, 10);
});
