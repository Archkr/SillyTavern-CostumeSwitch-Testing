import assert from "node:assert/strict";
import test from "node:test";

import {
    normalizePatternSlot,
    preparePatternSlotsForSave,
    prepareMappingsForSave,
    normalizeMappingEntry,
    reconcilePatternSlotReferences,
} from "../profile-utils.js";

test("reconcilePatternSlotReferences reuses existing slot objects and updates fields", () => {
    const existingSlot = normalizePatternSlot({ name: "Alice", aliases: ["Al"] });
    Object.defineProperty(existingSlot, "__slotId", {
        value: "slot-1",
        enumerable: false,
        configurable: true,
        writable: true,
    });

    const existingSlots = [existingSlot];
    const prepared = preparePatternSlotsForSave(existingSlots, new Set());
    assert.equal(prepared.length, 1);

    const nextSlot = normalizePatternSlot({ name: "Alice", aliases: ["Al", "Aly"] });
    Object.defineProperty(nextSlot, "__slotId", {
        value: "slot-1",
        enumerable: false,
        configurable: true,
        writable: true,
    });

    const reconciled = reconcilePatternSlotReferences(existingSlots, [nextSlot]);
    assert.equal(reconciled[0], existingSlot, "existing reference should be reused");
    assert.deepEqual(reconciled[0].aliases, ["Al", "Aly"]);
    assert.notEqual(reconciled[0].aliases, nextSlot.aliases, "aliases should be cloned");

    const updatedPrepared = preparePatternSlotsForSave(reconciled, new Set());
    assert.deepEqual(updatedPrepared[0].aliases, ["Al", "Aly"]);
});

test("reconcilePatternSlotReferences returns new objects for unseen slots", () => {
    const existingSlot = normalizePatternSlot({ name: "Alice", aliases: ["Al"] });
    Object.defineProperty(existingSlot, "__slotId", {
        value: "slot-1",
        enumerable: false,
        configurable: true,
        writable: true,
    });

    const newSlot = normalizePatternSlot({ name: "Bob", aliases: ["Bobby"] });
    Object.defineProperty(newSlot, "__slotId", {
        value: "slot-2",
        enumerable: false,
        configurable: true,
        writable: true,
    });

    const reconciled = reconcilePatternSlotReferences([existingSlot], [newSlot]);
    assert.notEqual(reconciled[0], existingSlot, "new slot should not reuse unrelated reference");
    assert.equal(reconciled[0], newSlot, "new slot should be returned as provided");
});

test("prepareMappingsForSave keeps outfit variants intact through save/load cycles", () => {
    const mapping = normalizeMappingEntry({
        name: "Nova",
        defaultFolder: "nova/base",
        outfits: [
            {
                folder: "nova/stealth",
                triggers: ["shadow", "/cloak/"],
                matchKinds: ["Speaker", "action"],
                awareness: { requires: ["Lena"], excludes: ["Drake"] },
                priority: "5",
            },
        ],
    });

    const saved = prepareMappingsForSave([mapping]);
    assert.equal(saved.length, 1);
    assert.deepEqual(saved[0].outfits[0], {
        folder: "nova/stealth",
        triggers: ["shadow", "/cloak/"],
        matchKinds: ["speaker", "action"],
        awareness: { requires: ["Lena"], excludes: ["Drake"] },
        priority: 5,
    });
});

test("prepareMappingsForSave rescues string outfit entries", () => {
    const saved = prepareMappingsForSave([
        {
            name: "Rin",
            defaultFolder: "rin/base",
            outfits: ["rin/alt"],
        },
    ]);

    assert.equal(saved[0].outfits.length, 1);
    assert.deepEqual(saved[0].outfits[0], { folder: "rin/alt", triggers: [], priority: 0 });
});

test("prepareMappingsForSave preserves regex-based outfit variations", () => {
    const saved = prepareMappingsForSave([
        {
            name: "Kaia",
            defaultFolder: "kaia/base",
            outfits: [
                {
                    folder: "kaia/winter",
                    triggers: [/snow/i, "blizzard"],
                    matchKinds: ["Action"],
                    awareness: { requiresAny: ["Lena"], excludes: [/Drake/i] },
                    priority: 3,
                },
            ],
        },
    ]);

    assert.equal(saved[0].outfits.length, 1);
    assert.deepEqual(saved[0].outfits[0], {
        folder: "kaia/winter",
        triggers: ["/snow/i", "blizzard"],
        matchKinds: ["action"],
        awareness: { requiresAny: ["Lena"], excludes: ["/Drake/i"] },
        priority: 3,
    });
});

test("prepareMappingsForSave keeps outfit labels and awareness requirements", () => {
    const saved = prepareMappingsForSave([
        {
            name: "Tess",
            defaultFolder: "tess/base",
            outfits: [
                {
                    folder: "tess/formal",
                    label: "Gala",
                    triggers: ["banquet"],
                    matchKinds: ["speaker", "vocative"],
                    awareness: { requires: ["Nova"], requiresAny: ["Rin"], excludes: ["Drake"] },
                    priority: 2,
                },
            ],
        },
    ]);

    assert.deepEqual(saved[0].outfits[0], {
        folder: "tess/formal",
        label: "Gala",
        triggers: ["banquet"],
        matchKinds: ["speaker", "vocative"],
        awareness: { requires: ["Nova"], requiresAny: ["Rin"], excludes: ["Drake"] },
        priority: 2,
    });
});
