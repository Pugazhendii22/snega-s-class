import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAttendanceCsv, buildJsonBackup, exportFilenameSlug } from '../src/lib/exportFormats.js';

const syntheticSnapshot = {
  class: { id: 'class-a', name: 'Synthetic Class', section: 'A', yearLabel: 'Year II', teacherId: 'uid-private' },
  students: [
    { id: 'student-01', rollNo: '-01', displayName: '=HYPERLINK("https://example.invalid")', active: true, parentPhone: 'never-export' },
    { id: 'student-02', rollNo: '02', displayName: 'Synthetic, Student "Two"', active: true },
  ],
  attendance: [
    { id: '2026-11-04_MORNING', dateISO: '2026-11-04', rollType: 'MORNING', statuses: { 'student-01': 'absent' }, updatedAt: '2026-11-04T04:00:00.000Z', takenBy: 'uid-private' },
  ],
  calendar: [
    { id: '2026-12-24', dateISO: '2026-12-24', kind: 'HOLIDAY', label: 'College break', updatedAt: '2026-11-04T04:00:00.000Z', teacherId: 'uid-private', sourceUrl: 'private-source' },
  ],
};

test('attendance CSV is Excel-friendly, quoted, formula-safe, and contains no parent contacts', () => {
  const csv = buildAttendanceCsv(syntheticSnapshot);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Date","Session","Roll number","Student name"/);
  assert.ok(csv.includes('"\'-01"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.invalid"")"'));
  assert.ok(csv.includes('"Synthetic, Student ""Two"""'));
  assert.ok(csv.includes('"Absent"'));
  assert.ok(csv.includes('"Unmarked"'));
  assert.ok(!csv.includes('never-export'));
});

test('JSON backup is versioned and whitelists class, roster, attendance, and calendar override fields', () => {
  const backup = JSON.parse(buildJsonBackup(syntheticSnapshot, new Date('2026-11-04T05:00:00.000Z')));
  assert.equal(backup.format, 'namma-class-firestore-backup');
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.exportedAt, '2026-11-04T05:00:00.000Z');
  assert.equal(backup.students[0].displayName, '=HYPERLINK("https://example.invalid")');
  assert.equal(backup.attendance[0].statuses['student-01'], 'absent');
  assert.deepEqual(backup.calendarOverrides[0], {
    id: '2026-12-24', dateISO: '2026-12-24', kind: 'HOLIDAY', label: 'College break', updatedAt: '2026-11-04T04:00:00.000Z',
  });
  assert.ok(!JSON.stringify(backup).includes('sourceUrl'));
  assert.ok(!JSON.stringify(backup).includes('parentPhone'));
  assert.ok(!JSON.stringify(backup).includes('never-export'));
  assert.ok(!JSON.stringify(backup).includes('takenBy'));
  assert.ok(!JSON.stringify(backup).includes('teacherId'));
});

test('export filenames are safe and non-empty', () => {
  assert.equal(exportFilenameSlug('B.A. English / Section A'), 'b-a-english-section-a');
  assert.equal(exportFilenameSlug('தமிழ்'), 'class');
});
