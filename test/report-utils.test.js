import test from 'node:test';
import assert from 'node:assert/strict';

import {
    mergeDetectionsForReport,
    summarizeDetections,
    summarizeSkipReasonsForReport,
} from '../src/report-utils.js';

test('mergeDetectionsForReport combines matches, score details, and events', () => {
    const report = {
        matches: [
            { name: 'Kotori', matchKind: 'vocative', matchIndex: 10, priority: 2 },
        ],
        scoreDetails: [
            { name: 'Yuzuru', matchKind: 'attribution', charIndex: 1560, priority: 4, totalScore: 320, priorityScore: 400 },
        ],
        events: [
            { type: 'switch', name: 'Kaguya', matchKind: 'attribution', charIndex: 1680 },
        ],
    };

    const merged = mergeDetectionsForReport(report);
    const names = merged.map(item => item.name);

    assert.deepEqual(
        new Set(names),
        new Set(['Kotori', 'Yuzuru', 'Kaguya']),
        'expected merged detections to include vocative, score detail, and event-derived names',
    );
});

test('summarizeDetections tallies counts and priority ranges', () => {
    const merged = [
        { name: 'Kotori', matchKind: 'vocative', matchIndex: 10, priority: 2 },
        { name: 'Kotori', matchKind: 'action', matchIndex: 150, priority: 3 },
        { name: 'Reine', matchKind: 'attribution', matchIndex: 200, priority: 4 },
    ];

    const summary = summarizeDetections(merged);
    const kotoriSummary = summary.find(item => item.name === 'Kotori');
    const reineSummary = summary.find(item => item.name === 'Reine');

    assert.ok(kotoriSummary, 'expected Kotori to be summarized');
    assert.equal(kotoriSummary.total, 2);
    assert.equal(kotoriSummary.highestPriority, 3);
    assert.deepEqual(kotoriSummary.kinds, { action: 1, vocative: 1 });
    assert.ok(reineSummary);
    assert.equal(reineSummary.total, 1);
    assert.equal(reineSummary.highestPriority, 4);
});

test('summarizeSkipReasonsForReport aggregates skip codes', () => {
    const events = [
        { type: 'switch', name: 'Kotori', matchKind: 'action' },
        { type: 'skipped', name: 'Kotori', matchKind: 'action', reason: 'repeat-suppression' },
        { type: 'skipped', name: 'Shido', matchKind: 'action', reason: 'repeat-suppression' },
        { type: 'skipped', name: 'Reine', matchKind: 'attribution', reason: 'global-cooldown' },
        { type: 'skipped', name: 'Shido', matchKind: 'action', reason: 'repeat-suppression' },
        { type: 'skipped', name: 'Kotori', matchKind: 'action', reason: 'per-trigger-cooldown' },
    ];

    const summary = summarizeSkipReasonsForReport(events);
    assert.deepEqual(
        summary,
        [
            { code: 'repeat-suppression', count: 3 },
            { code: 'global-cooldown', count: 1 },
            { code: 'per-trigger-cooldown', count: 1 },
        ],
    );
});
