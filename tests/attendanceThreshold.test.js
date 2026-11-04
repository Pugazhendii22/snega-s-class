import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAttendanceThreshold, validateAttendanceThresholdSettings } from '../src/lib/attendanceThreshold.js';

const completeSettings = {
  termStartISO: '2026-01-01',
  termEndISO: '2026-12-31',
  trackingStartISO: '2026-01-02',
  workingWeekdays: [1, 2, 3, 4, 5],
  sessionPolicy: 'ANY_PRESENT',
  leavePolicy: 'COUNT_NOT_PRESENT',
  calendarConfirmed: true,
};
const students = [
  { id: 'student-a', rollNo: '01', displayName: 'Synthetic A' },
  { id: 'student-b', rollNo: '02', displayName: 'Synthetic B' },
];

function roll(dateISO, rollType, statuses) {
  return { id: `${dateISO}_${rollType}`, dateISO, rollType, statuses };
}

test('requires complete explicit term, coverage, weekday, session, leave, and calendar settings', () => {
  assert.deepEqual(validateAttendanceThresholdSettings({}), [
    'Enter a valid term start date.',
    'Enter a valid term end date.',
    'Enter the first date from which attendance records are complete.',
    'Select one or more ordinary working weekdays.',
    'Choose how the morning and evening rolls count as one day.',
    'Choose how approved leave affects the percentage.',
    'Confirm that the selected term calendar has been checked against the college schedule.',
  ]);
  assert.deepEqual(validateAttendanceThresholdSettings({
    ...completeSettings,
    trackingStartISO: '2027-01-01',
    workingWeekdays: [1, 1],
  }), [
    'The tracking start date must be within the term dates.',
    'Select one or more ordinary working weekdays.',
  ]);
  assert.ok(validateAttendanceThresholdSettings({ ...completeSettings, termEndISO: '2037-01-01' })
    .includes('A single percentage period cannot exceed 10 years; split longer records into separate periods.'));
});

test('counts each college date once and uses the selected any-session day rule', () => {
  const result = calculateAttendanceThreshold({
    settings: { ...completeSettings, trackingStartISO: '2026-01-02' },
    todayISO: '2026-01-05',
    students,
    attendanceRecords: [
      roll('2026-01-02', 'MORNING', { 'student-a': 'absent', 'student-b': 'present' }),
      roll('2026-01-02', 'EVENING', { 'student-a': 'present', 'student-b': 'present' }),
      roll('2026-01-05', 'MORNING', { 'student-a': 'absent', 'student-b': 'present' }),
      roll('2026-01-05', 'EVENING', { 'student-a': 'absent', 'student-b': 'absent' }),
    ],
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.workingDayCount, 2);
  assert.deepEqual(result.rows.map(({ id, presentDays, countedDays, percentage, belowThreshold }) => ({ id, presentDays, countedDays, percentage, belowThreshold })), [
    { id: 'student-a', presentDays: 1, countedDays: 2, percentage: 50, belowThreshold: true },
    { id: 'student-b', presentDays: 2, countedDays: 2, percentage: 100, belowThreshold: false },
  ]);
});

test('the both-rolls-present rule treats a mixed day as not present', () => {
  const result = calculateAttendanceThreshold({
    settings: { ...completeSettings, trackingStartISO: '2026-01-02', sessionPolicy: 'BOTH_PRESENT' },
    todayISO: '2026-01-02',
    students: [students[0]],
    attendanceRecords: [
      roll('2026-01-02', 'MORNING', { 'student-a': 'present' }),
      roll('2026-01-02', 'EVENING', { 'student-a': 'absent' }),
    ],
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.rows[0].percentage, 0);
});

test('withholds every percentage if an expected roll or student status is missing', () => {
  const missingRoll = calculateAttendanceThreshold({
    settings: { ...completeSettings, trackingStartISO: '2026-01-02' },
    todayISO: '2026-01-02',
    students,
    attendanceRecords: [roll('2026-01-02', 'MORNING', { 'student-a': 'present', 'student-b': 'present' })],
  });
  assert.equal(missingRoll.status, 'incomplete');
  assert.equal(missingRoll.missingRollCount, 1);
  assert.equal(missingRoll.missingStatusCount, 0);

  const missingStudent = calculateAttendanceThreshold({
    settings: { ...completeSettings, trackingStartISO: '2026-01-02', sessionPolicy: 'MORNING_ONLY' },
    todayISO: '2026-01-02',
    students,
    attendanceRecords: [roll('2026-01-02', 'MORNING', { 'student-a': 'present' })],
  });
  assert.equal(missingStudent.status, 'incomplete');
  assert.equal(missingStudent.missingRollCount, 0);
  assert.equal(missingStudent.missingStatusCount, 1);
});

test('uses Puducherry holiday defaults and teacher exceptions when building working dates', () => {
  const result = calculateAttendanceThreshold({
    settings: { ...completeSettings, termStartISO: '2026-01-01', termEndISO: '2026-01-03', trackingStartISO: '2026-01-01' },
    todayISO: '2026-01-03',
    students: [students[0]],
    calendarOverrides: [
      { dateISO: '2026-01-02', kind: 'HOLIDAY', label: 'Synthetic college holiday' },
      { dateISO: '2026-01-03', kind: 'WORKING', label: 'Synthetic Saturday working day' },
    ],
    attendanceRecords: [
      roll('2026-01-03', 'MORNING', { 'student-a': 'present' }),
      roll('2026-01-03', 'EVENING', { 'student-a': 'present' }),
    ],
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.workingDayCount, 1);
  assert.equal(result.rows[0].percentage, 100);
});

test('requires complete rolls before counting a teacher-added weekend working day', () => {
  const result = calculateAttendanceThreshold({
    settings: { ...completeSettings, termStartISO: '2026-01-03', termEndISO: '2026-01-03', trackingStartISO: '2026-01-03' },
    todayISO: '2026-01-03',
    students: [students[0]],
    calendarOverrides: [{ dateISO: '2026-01-03', kind: 'WORKING', label: 'Synthetic Saturday work' }],
  });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.missingRollCount, 2);
});

test('compares the unrounded ratio against the 75% threshold', () => {
  const start = new Date('2027-01-01T00:00:00.000Z');
  const records = [];
  for (let index = 0; index < 2000; index += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const dateISO = date.toISOString().slice(0, 10);
    records.push(roll(dateISO, 'MORNING', { 'student-a': index < 1499 ? 'present' : 'absent' }));
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1999);
  const result = calculateAttendanceThreshold({
    settings: {
      ...completeSettings,
      termStartISO: '2027-01-01',
      termEndISO: end.toISOString().slice(0, 10),
      trackingStartISO: '2027-01-01',
      workingWeekdays: [0, 1, 2, 3, 4, 5, 6],
      sessionPolicy: 'MORNING_ONLY',
    },
    todayISO: end.toISOString().slice(0, 10),
    students: [students[0]],
    attendanceRecords: records,
  });
  assert.equal(result.status, 'ready');
  assert.equal(result.rows[0].percentage, 74.95);
  assert.equal(result.rows[0].belowThreshold, true);
});

test('applies the configured full-day leave treatment', () => {
  const records = [
    roll('2026-01-02', 'MORNING', { 'student-a': 'leave' }),
    roll('2026-01-02', 'EVENING', { 'student-a': 'leave' }),
  ];
  const excluded = calculateAttendanceThreshold({
    settings: { ...completeSettings, trackingStartISO: '2026-01-02', leavePolicy: 'EXCLUDE_FULL_DAY' },
    todayISO: '2026-01-02',
    students: [students[0]],
    attendanceRecords: records,
  });
  assert.equal(excluded.status, 'ready');
  assert.equal(excluded.rows[0].percentage, null);
  assert.equal(excluded.rows[0].excludedLeaveDays, 1);

  const counted = calculateAttendanceThreshold({
    settings: { ...completeSettings, trackingStartISO: '2026-01-02', leavePolicy: 'COUNT_NOT_PRESENT' },
    todayISO: '2026-01-02',
    students: [students[0]],
    attendanceRecords: records,
  });
  assert.equal(counted.rows[0].percentage, 0);
});
