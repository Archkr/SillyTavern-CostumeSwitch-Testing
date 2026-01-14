import test from "node:test";
import assert from "node:assert/strict";

import { registerAutoSaveGuards } from "../src/ui/autoSaveGuards.js";

test("registerAutoSaveGuards flushes pending saves on navigation", () => {
    const calls = [];
    const mockTarget = {
        listeners: new Map(),
        addEventListener(type, handler) {
            this.listeners.set(type, handler);
        },
        removeEventListener(type, handler) {
            const current = this.listeners.get(type);
            if (current === handler) {
                this.listeners.delete(type);
            }
        },
    };

    const cleanup = registerAutoSaveGuards({
        flushFn: (args) => calls.push(args),
        target: mockTarget,
    });

    assert.equal(typeof cleanup, "function", "cleanup should be a function");
    assert.ok(mockTarget.listeners.has("beforeunload"), "beforeunload listener should be registered");
    assert.ok(mockTarget.listeners.has("visibilitychange"), "visibilitychange listener should be registered");

    const handler = mockTarget.listeners.get("beforeunload");
    handler?.();
    mockTarget.listeners.get("visibilitychange")?.();

    assert.equal(calls.length, 2, "flush should be invoked for both navigation events");
    assert.deepEqual(calls[0], {
        overrideMessage: null,
        showStatusMessage: false,
        force: true,
    }, "flush arguments should disable status messaging and force save");

    cleanup();
    assert.equal(mockTarget.listeners.size, 0, "cleanup should remove registered listeners");
});
