import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

await register(new URL("./module-mock-loader.js", import.meta.url));

const extensionSettingsStore = globalThis.__extensionSettingsStore || (globalThis.__extensionSettingsStore = {});

const { restoreSceneOutcomeForMessage, state, extensionName } = await import("../index.js");
const {
    applySceneRosterUpdate,
    resetSceneState,
    clearLiveTesterOutputs,
    listRosterMembers,
} = await import("../src/core/state.js");

const baseSettings = {
    enabled: true,
    profiles: {},
    activeProfile: "Test",
    scorePresets: {},
    activeScorePreset: "",
    focusLock: { character: null },
};

test("restoreSceneOutcomeForMessage repopulates recent decision events from stored outcomes", () => {
    extensionSettingsStore[extensionName] = {
        ...baseSettings,
        session: {},
    };

    state.perMessageBuffers = new Map();
    state.perMessageStates = new Map();
    state.messageStats = new Map();
    state.recentDecisionEvents = [{ type: "switch", messageKey: "tester:old", name: "Kotori" }];

    const storedEvents = [
        { type: "switch", name: "Kotori", normalized: "kotori", timestamp: 1234, messageKey: "m42" },
        { type: "skipped", name: "Shido", normalized: "shido", timestamp: 1250, messageKey: "m42", reason: "cooldown" },
    ];

    const message = {
        mesId: 42,
        is_user: false,
        mes: "Kotori waves. Shido hesitates.",
        swipe_id: 0,
        extra: {
            cs_scene_outcomes: {
                0: {
                    version: 1,
                    messageKey: "m42",
                    messageId: 42,
                    roster: ["kotori"],
                    displayNames: [["kotori", "Kotori"]],
                    events: storedEvents,
                    stats: [],
                    buffer: "Kotori waves. Shido hesitates.",
                    text: "Kotori waves. Shido hesitates.",
                    updatedAt: 1700,
                    lastEvent: storedEvents[1],
                },
            },
        },
    };

    const restored = restoreSceneOutcomeForMessage(message);
    assert.equal(restored, true, "stored outcomes should be restored for assistant messages");

    assert.equal(state.recentDecisionEvents.length, storedEvents.length,
        "restored log should match the stored event count");
    assert.ok(state.recentDecisionEvents.every(event => event.messageKey === "m42"),
        "restored events should be keyed to the original message");

    const session = extensionSettingsStore[extensionName].session;
    assert.ok(Array.isArray(session.recentDecisionEvents),
        "session cache should receive restored decision events");
    assert.equal(session.recentDecisionEvents.length, storedEvents.length,
        "session decision log should mirror the restored events");
    assert.ok(session.recentDecisionEvents.every(event => event.messageKey === "m42"),
        "session log events should retain the original message key");
});

test("restoreSceneOutcomeForMessage preserves active roster when stored roster empty", () => {
    extensionSettingsStore[extensionName] = {
        ...baseSettings,
        session: {},
    };

    state.perMessageBuffers = new Map();
    state.perMessageStates = new Map();
    state.messageStats = new Map();

    resetSceneState();
    clearLiveTesterOutputs();

    const seedTimestamp = Date.now();

    applySceneRosterUpdate({
        key: "m1",
        messageId: 1,
        roster: [
            { name: "Kotori", normalized: "kotori", joinedAt: seedTimestamp - 1000, lastSeenAt: seedTimestamp },
            { name: "Shido", normalized: "shido", joinedAt: seedTimestamp - 2000, lastSeenAt: seedTimestamp },
        ],
        updatedAt: seedTimestamp,
    });

    const initialMembers = listRosterMembers();
    assert.equal(initialMembers.every(entry => entry.active), true,
        "seeded roster members should start active");

    const message = {
        mesId: 99,
        is_user: false,
        mes: "Kotori smiles.",
        swipe_id: 0,
        extra: {
            cs_scene_outcomes: {
                0: {
                    version: 1,
                    messageKey: "m99",
                    messageId: 99,
                    roster: [],
                    displayNames: [],
                    events: [],
                    stats: [],
                    buffer: "Kotori smiles.",
                    text: "Kotori smiles.",
                    updatedAt: seedTimestamp + 500,
                    lastEvent: null,
                },
            },
        },
    };

    const restored = restoreSceneOutcomeForMessage(message);
    assert.equal(restored, true, "stored outcome should restore even with an empty roster");

    const refreshedMembers = listRosterMembers();
    const kotori = refreshedMembers.find(entry => entry.normalized === "kotori");
    const shido = refreshedMembers.find(entry => entry.normalized === "shido");

    assert.equal(kotori?.active, true, "refresh should not deactivate existing roster members");
    assert.equal(shido?.active, true, "refresh should not deactivate secondary roster members");
});
