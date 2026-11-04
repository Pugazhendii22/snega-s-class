import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRollStudentEntries, groupAttendanceHistory, summarizeSavedRoll } from '../src/lib/attendanceHistory.js';

test('history groups rolls by day and sorts newest first with morning before evening', () => {
  const grouped = groupAttendanceHistory([
    { dateISO: '2026-11-03', rollType: 'EVENING', statuses: {} },
    { dateISO: '2026-11-04', rollType: 'EVENING', statuses: {} },
    { dateISO: '2026-11-04', rollType: 'MORNING', statuses: {} },
    { dateISO: '', rollType: 'MORNING', statuses: {} },
  ]);
  assert.deepEqual(grouped.map((day) => day.dateISO), ['2026-11-04', '2026-11-03']);
  assert.deepEqual(grouped[0].rolls.map((roll) => roll.rollType), ['MORNING', 'EVENING']);
});

test('history summaries count saved statuses without assuming the current roster size', () => {
  assert.deepEqual(summarizeSavedRoll({ statuses: { a: 'present', b: 'absent', c: 'leave', d: 'unexpected' } }), {
    present: 1, absent: 1, leave: 1, unmarked: 1, total: 4,
  });
  assert.deepEqual(summarizeSavedRoll({ statuses: {} }), {
    present: 0, absent: 0, leave: 0, unmarked: 0, total: 0,
  });
});

test('student-level history resolves the roster, sorts by roll number, and hides unknown IDs', () => {
  const entries = buildRollStudentEntries(
    { statuses: { student10: 'absent', oldStudent: 'present', student2: 'leave' } },
    [
      { id: 'student10', rollNo: '10', displayName: 'Meena' },
      { id: 'student2', rollNo: '2', displayName: 'Anu' },
    ],
  );
  assert.deepEqual(entries, [
    { label: '2 · Anu', status: 'leave' },
    { label: '10 · Meena', status: 'absent' },
    { label: 'Roster entry not found', status: 'present' },
  ]);
});
