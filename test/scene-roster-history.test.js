import test from "node:test";
import assert from "node:assert/strict";

import { __testables as rosterTestables } from "../src/ui/render/sceneRoster.js";

const { mergeRosterData } = rosterTestables;

test("mergeRosterData infers turns remaining from history counts within the TTL window", () => {
    const now = Date.now();
    const history = {
        ttlWindow: 5,
        messages: [
            { key: "m1", roster: ["Kotori"], turnsByMember: [["kotori", 0]] },
            { key: "m2", roster: ["Kotori"] },
            { key: "m3", roster: ["Kotori"] },
            { key: "m4", roster: [] },
            { key: "m5", roster: ["Kotori"] },
            { key: "m6", roster: [] },
            { key: "m7", roster: [] },
        ],
    };

    const membership = {
        members: [
            {
                name: "Kotori",
                normalized: "kotori",
                joinedAt: now - 1000,
                lastSeenAt: now,
                active: true,
                turnsRemaining: null,
            },
        ],
        history,
    };

    const scene = {
        roster: [
            {
                name: "Kotori",
                normalized: "kotori",
                joinedAt: now - 1000,
                lastSeenAt: now,
                active: true,
            },
        ],
        history,
    };

    const entries = mergeRosterData(scene, membership, null, now);
    const kotori = entries.find((entry) => entry.normalized === "kotori");
    assert.ok(kotori, "expected Kotori to appear in merged roster");
    assert.equal(kotori.turnsRemaining, 3, "turns remaining should reflect only the last five messages");
});

test("mergeRosterData prefers per-member turn values from history when available", () => {
    const now = Date.now();
    const history = {
        ttlWindow: 5,
        messages: [
            { key: "m1", roster: ["Kotori"], turnsByMember: [["kotori", 2]] },
            { key: "m2", roster: ["Kotori"], turnsByMember: [["kotori", 4]] },
        ],
    };

    const membership = {
        members: [
            {
                name: "Kotori",
                normalized: "kotori",
                joinedAt: now - 2000,
                lastSeenAt: now - 1000,
                active: true,
                turnsRemaining: null,
            },
        ],
        history,
    };

    const scene = {
        roster: [
            {
                name: "Kotori",
                normalized: "kotori",
                joinedAt: now - 2000,
                lastSeenAt: now - 1000,
                active: true,
            },
        ],
        history,
    };

    const entries = mergeRosterData(scene, membership, null, now);
    const kotori = entries.find((entry) => entry.normalized === "kotori");
    assert.ok(kotori, "expected Kotori to appear in merged roster");
    assert.equal(kotori.turnsRemaining, 4, "per-member turn history should override count-based fallback");
});
