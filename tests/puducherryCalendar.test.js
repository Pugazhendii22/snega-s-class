import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePuducherryCalendar, PUDUCHERRY_2026_DEFAULTS, PUDUCHERRY_CALENDAR_SOURCE } from '../src/lib/puducherryCalendar.js';

test('2026 Puducherry defaults include official holiday corrections and compensatory working days', () => {
  const byDate = new Map(PUDUCHERRY_2026_DEFAULTS.map((event) => [event.dateISO, event]));
  assert.equal(byDate.size, PUDUCHERRY_2026_DEFAULTS.length, 'default dates must be unique');
  assert.equal(byDate.get('2026-03-21')?.label.startsWith('Ramzan'), true);
  assert.equal(byDate.has('2026-03-20'), false, 'use the official Ramzan corrigendum');
  assert.equal(byDate.get('2026-11-09')?.label, 'Deepavali');
  assert.equal(byDate.get('2026-11-21')?.kind, 'WORKING');
  assert.equal(byDate.get('2026-01-31')?.kind, 'WORKING');
  assert.equal(byDate.get('2026-07-04')?.kind, 'WORKING');
  assert.match(PUDUCHERRY_CALENDAR_SOURCE.primaryUrl, /py\.gov\.in/);
});

test('teacher calendar data overrides official defaults and can add dates without leaking extra fields', () => {
  const events = mergePuducherryCalendar(2026, [
    { dateISO: '2026-11-09', kind: 'WORKING', label: 'College working day', teacherId: 'private-id' },
    { dateISO: '2026-12-24', kind: 'HOLIDAY', label: 'College holiday', teacherId: 'private-id' },
    { dateISO: '2027-01-01', kind: 'HOLIDAY', label: 'Other year' },
  ]);
  const deepavali = events.find((event) => event.dateISO === '2026-11-09');
  assert.equal(deepavali.kind, 'WORKING');
  assert.equal(deepavali.label, 'College working day');
  assert.equal(deepavali.isOverride, true);
  assert.equal(deepavali.defaultKind, 'HOLIDAY');
  assert.equal(Object.hasOwn(deepavali, 'teacherId'), false);
  assert.equal(events.find((event) => event.dateISO === '2026-12-24')?.source, 'Teacher-added date');
  assert.equal(events.some((event) => event.dateISO === '2027-01-01'), false);
});
