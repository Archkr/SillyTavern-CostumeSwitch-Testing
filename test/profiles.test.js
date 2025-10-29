import test from 'node:test';
import assert from 'node:assert/strict';

import { loadProfiles, normalizeProfile } from '../profile-utils.js';

const PROFILE_DEFAULTS = {
    mappings: [],
    enableOutfits: false,
};

test('loadProfiles wraps legacy mapping entries with default folder', () => {
    const legacyProfiles = {
        Legacy: {
            mappings: [
                { name: 'Alice', folder: 'alice-main' },
            ],
        },
    };

    const loaded = loadProfiles(legacyProfiles, PROFILE_DEFAULTS);

    assert.ok(loaded.Legacy, 'profile should exist after load');
    assert.equal(loaded.Legacy.enableOutfits, false, 'legacy profile should adopt default enableOutfits flag');
    assert.equal(loaded.Legacy.mappings.length, 1, 'legacy mapping should be preserved');

    const mapping = loaded.Legacy.mappings[0];
    assert.equal(mapping.name, 'Alice');
    assert.equal(mapping.defaultFolder, 'alice-main');
    assert.equal(mapping.folder, 'alice-main', 'folder alias should match defaultFolder for compatibility');
    assert.deepEqual(mapping.outfits, [], 'legacy mappings should expose an empty outfits array');

    const serialized = JSON.parse(JSON.stringify(loaded.Legacy));
    const rehydrated = normalizeProfile(serialized, PROFILE_DEFAULTS);
    assert.deepEqual(rehydrated.mappings, loaded.Legacy.mappings, 'legacy mapping should round-trip through serialization');
});

test('loadProfiles preserves enableOutfits flag and outfit arrays', () => {
    const modernProfiles = {
        Modern: {
            enableOutfits: true,
            mappings: [
                {
                    name: 'Bob',
                    defaultFolder: 'bob/base',
                    outfits: ['bob/casual', { slot: 'formal', folder: 'bob/formal' }],
                },
            ],
        },
    };

    const loaded = loadProfiles(modernProfiles, PROFILE_DEFAULTS);

    assert.ok(loaded.Modern, 'profile should exist after load');
    assert.equal(loaded.Modern.enableOutfits, true, 'enableOutfits flag should persist');
    assert.equal(loaded.Modern.mappings.length, 1, 'mapping entry should be retained');

    const mapping = loaded.Modern.mappings[0];
    assert.equal(mapping.defaultFolder, 'bob/base');
    assert.equal(mapping.folder, 'bob/base');
    assert.deepEqual(mapping.outfits, ['bob/casual', { slot: 'formal', folder: 'bob/formal' }]);
    assert.notStrictEqual(mapping.outfits[1], modernProfiles.Modern.mappings[0].outfits[1], 'outfits should be cloned');

    const serialized = JSON.parse(JSON.stringify(loaded.Modern));
    const rehydrated = normalizeProfile(serialized, PROFILE_DEFAULTS);
    assert.deepEqual(rehydrated.mappings, loaded.Modern.mappings, 'modern mapping should round-trip through serialization');
    assert.equal(rehydrated.enableOutfits, true, 'modern profile should preserve enableOutfits flag');
});
