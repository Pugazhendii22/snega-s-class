import { mergePuducherryCalendar } from './puducherryCalendar.js';

export const ATTENDANCE_SESSION_POLICIES = [
  { value: 'MORNING_ONLY', label: 'Morning roll only' },
  { value: 'EVENING_ONLY', label: 'Evening roll only' },
  { value: 'ANY_PRESENT', label: 'Present if either roll is present (both rolls required)' },
  { value: 'BOTH_PRESENT', label: 'Present only if both rolls are present' },
];

export const ATTENDANCE_LEAVE_POLICIES = [
  { value: 'COUNT_NOT_PRESENT', label: 'Count an all-leave day as not present' },
  { value: 'EXCLUDE_FULL_DAY', label: 'Exclude a day only when all required rolls say leave' },
];

export const ATTENDANCE_WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

const VALID_SESSION_POLICIES = new Set(ATTENDANCE_SESSION_POLICIES.map((item) => item.value));
const VALID_LEAVE_POLICIES = new Set(ATTENDANCE_LEAVE_POLICIES.map((item) => item.value));
const VALID_STATUSES = new Set(['present', 'absent', 'leave']);
const MAX_TERM_SPAN_DAYS = 3653;
const REQUIRED_SESSIONS = {
  MORNING_ONLY: ['MORNING'],
  EVENING_ONLY: ['EVENING'],
  ANY_PRESENT: ['MORNING', 'EVENING'],
  BOTH_PRESENT: ['MORNING', 'EVENING'],
};

export function isRealISODate(dateISO) {
  if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateISO;
}

export function validateAttendanceThresholdSettings(settings) {
  const errors = [];
  const termStartISO = settings?.termStartISO;
  const termEndISO = settings?.termEndISO;
  const trackingStartISO = settings?.trackingStartISO;

  if (!isRealISODate(termStartISO)) errors.push('Enter a valid term start date.');
  if (!isRealISODate(termEndISO)) errors.push('Enter a valid term end date.');
  if (isRealISODate(termStartISO) && isRealISODate(termEndISO) && termStartISO > termEndISO) {
    errors.push('The term end date must be on or after the term start date.');
  }
  if (isRealISODate(termStartISO) && isRealISODate(termEndISO) && termStartISO <= termEndISO
    && (new Date(`${termEndISO}T00:00:00.000Z`) - new Date(`${termStartISO}T00:00:00.000Z`)) / 86400000 > MAX_TERM_SPAN_DAYS) {
    errors.push('A single percentage period cannot exceed 10 years; split longer records into separate periods.');
  }
  if (!isRealISODate(trackingStartISO)) errors.push('Enter the first date from which attendance records are complete.');
  if (isRealISODate(termStartISO) && isRealISODate(termEndISO) && isRealISODate(trackingStartISO)
    && (trackingStartISO < termStartISO || trackingStartISO > termEndISO)) {
    errors.push('The tracking start date must be within the term dates.');
  }
  const weekdays = settings?.workingWeekdays;
  if (!Array.isArray(weekdays) || weekdays.length < 1 || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    || new Set(weekdays).size !== weekdays.length) {
    errors.push('Select one or more ordinary working weekdays.');
  }
  if (!VALID_SESSION_POLICIES.has(settings?.sessionPolicy)) errors.push('Choose how the morning and evening rolls count as one day.');
  if (!VALID_LEAVE_POLICIES.has(settings?.leavePolicy)) errors.push('Choose how approved leave affects the percentage.');
  if (settings?.calendarConfirmed !== true) errors.push('Confirm that the selected term calendar has been checked against the college schedule.');
  return errors;
}

function dateRange(startISO, endISO) {
  const dates = [];
  const start = new Date(`${startISO}T00:00:00.000Z`);
  const end = new Date(`${endISO}T00:00:00.000Z`);
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

function getCalendarEventMap(startISO, endISO, calendarOverrides) {
  const map = new Map();
  const startYear = Number(startISO.slice(0, 4));
  const endYear = Number(endISO.slice(0, 4));
  for (let year = startYear; year <= endYear; year += 1) {
    for (const event of mergePuducherryCalendar(year, calendarOverrides)) map.set(event.dateISO, event);
  }
  return map;
}

function workingDatesFor(settings, calendarOverrides, throughDateISO) {
  const throughISO = settings.termEndISO < throughDateISO ? settings.termEndISO : throughDateISO;
  if (throughISO < settings.trackingStartISO) return { throughISO, dates: [] };
  const events = getCalendarEventMap(settings.trackingStartISO, throughISO, calendarOverrides);
  const weekdays = new Set(settings.workingWeekdays);
  const dates = dateRange(settings.trackingStartISO, throughISO).filter((dateISO) => {
    const event = events.get(dateISO);
    if (event?.kind === 'HOLIDAY') return false;
    if (event?.kind === 'WORKING') return true;
    return weekdays.has(new Date(`${dateISO}T00:00:00.000Z`).getUTCDay());
  });
  return { throughISO, dates };
}

function attendanceKey(dateISO, rollType) {
  return `${dateISO}_${rollType}`;
}

function dayIsPresent(sessionStatuses, sessionPolicy) {
  if (sessionPolicy === 'MORNING_ONLY' || sessionPolicy === 'EVENING_ONLY') return sessionStatuses[0] === 'present';
  if (sessionPolicy === 'ANY_PRESENT') return sessionStatuses.includes('present');
  return sessionStatuses.every((status) => status === 'present');
}

/**
 * Calculates one attendance unit per scheduled college date. It deliberately
 * withholds every percentage if any required roll or student status is missing.
 */
export function calculateAttendanceThreshold({
  settings,
  attendanceRecords = [],
  students = [],
  calendarOverrides = [],
  todayISO,
  threshold = 75,
}) {
  const errors = validateAttendanceThresholdSettings(settings);
  if (errors.length) return { status: 'not-configured', errors };
  if (!isRealISODate(todayISO)) return { status: 'invalid-date', errors: ['The current local date is invalid.'] };
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
    return { status: 'invalid-threshold', errors: ['The percentage threshold must be between 0 and 100.'] };
  }
  if (!Array.isArray(students) || students.length === 0) return { status: 'no-students', errors: [] };

  const { throughISO, dates } = workingDatesFor(settings, calendarOverrides, todayISO);
  if (dates.length === 0) {
    return {
      status: 'no-working-days',
      fromISO: settings.trackingStartISO,
      throughISO,
      workingDayCount: 0,
      errors: [],
    };
  }

  const recordsByKey = new Map();
  for (const record of attendanceRecords) {
    if (isRealISODate(record?.dateISO) && ['MORNING', 'EVENING'].includes(record?.rollType)) {
      recordsByKey.set(attendanceKey(record.dateISO, record.rollType), record);
    }
  }

  const requiredSessions = REQUIRED_SESSIONS[settings.sessionPolicy];
  const missingRolls = [];
  const missingStatuses = [];
  const dailyStatusRecords = [];

  for (const dateISO of dates) {
    const rolls = {};
    for (const rollType of requiredSessions) {
      const record = recordsByKey.get(attendanceKey(dateISO, rollType));
      if (!record) {
        missingRolls.push({ dateISO, rollType });
        continue;
      }
      rolls[rollType] = record;
      const missingForRoll = students.reduce((count, student) => {
        const status = record.statuses?.[student.id];
        return count + (VALID_STATUSES.has(status) ? 0 : 1);
      }, 0);
      if (missingForRoll > 0) missingStatuses.push({ dateISO, rollType, count: missingForRoll });
    }
    dailyStatusRecords.push({ dateISO, rolls });
  }

  if (missingRolls.length || missingStatuses.length) {
    return {
      status: 'incomplete',
      fromISO: settings.trackingStartISO,
      throughISO,
      workingDayCount: dates.length,
      missingRollCount: missingRolls.length,
      missingStatusCount: missingStatuses.reduce((sum, item) => sum + item.count, 0),
      missingRolls: missingRolls.slice(0, 8),
      missingStatuses: missingStatuses.slice(0, 8),
      errors: [],
    };
  }

  const rows = students.map((student) => {
    let presentDays = 0;
    let countedDays = 0;
    let excludedLeaveDays = 0;
    for (const day of dailyStatusRecords) {
      const sessionStatuses = requiredSessions.map((rollType) => day.rolls[rollType].statuses[student.id]);
      if (settings.leavePolicy === 'EXCLUDE_FULL_DAY' && sessionStatuses.every((status) => status === 'leave')) {
        excludedLeaveDays += 1;
        continue;
      }
      countedDays += 1;
      if (dayIsPresent(sessionStatuses, settings.sessionPolicy)) presentDays += 1;
    }
    const exactPercentage = countedDays > 0 ? (presentDays / countedDays) * 100 : null;
    const percentage = exactPercentage === null ? null : Math.round(exactPercentage * 100) / 100;
    return {
      id: student.id,
      rollNo: student.rollNo,
      displayName: student.displayName,
      presentDays,
      countedDays,
      excludedLeaveDays,
      percentage,
      belowThreshold: exactPercentage !== null && exactPercentage < threshold,
    };
  }).sort((a, b) => {
    if (a.percentage === null) return b.percentage === null ? 0 : 1;
    if (b.percentage === null) return -1;
    return a.percentage - b.percentage || String(a.rollNo).localeCompare(String(b.rollNo), 'en', { numeric: true, sensitivity: 'base' });
  });

  return {
    status: 'ready',
    fromISO: settings.trackingStartISO,
    throughISO,
    workingDayCount: dates.length,
    requiredSessions,
    threshold,
    rows,
    belowThresholdCount: rows.filter((row) => row.belowThreshold).length,
    errors: [],
  };
}
