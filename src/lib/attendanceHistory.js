const SESSION_ORDER = { MORNING: 0, EVENING: 1 };
const VALID_STATUSES = new Set(['present', 'absent', 'leave']);

export function summarizeSavedRoll(record) {
  const summary = { present: 0, absent: 0, leave: 0, unmarked: 0, total: 0 };
  const statuses = record?.statuses && typeof record.statuses === 'object' ? Object.values(record.statuses) : [];
  for (const status of statuses) {
    if (VALID_STATUSES.has(status)) summary[status] += 1;
    else summary.unmarked += 1;
    summary.total += 1;
  }
  return summary;
}

export function buildRollStudentEntries(record, roster = []) {
  const studentsById = new Map(roster.map((student) => [String(student.id), student]));
  const statuses = record?.statuses && typeof record.statuses === 'object' ? Object.entries(record.statuses) : [];
  return statuses
    .map(([studentId, status], index) => {
      const student = studentsById.get(studentId);
      return {
        label: student ? `${student.rollNo} · ${student.displayName}` : 'Roster entry not found',
        status: VALID_STATUSES.has(status) ? status : 'unmarked',
        hasRosterEntry: Boolean(student),
        sortKey: student ? String(student.rollNo) : String(index),
      };
    })
    .sort((a, b) => Number(b.hasRosterEntry) - Number(a.hasRosterEntry)
      || a.sortKey.localeCompare(b.sortKey, 'en', { numeric: true, sensitivity: 'base' }))
    .map(({ label, status }) => ({ label, status }));
}

export function groupAttendanceHistory(records = []) {
  const groups = new Map();
  for (const record of records) {
    const dateISO = String(record?.dateISO ?? '');
    if (!dateISO) continue;
    if (!groups.has(dateISO)) groups.set(dateISO, []);
    groups.get(dateISO).push(record);
  }
  return [...groups.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([dateISO, rolls]) => ({
      dateISO,
      rolls: rolls.slice().sort((a, b) => (SESSION_ORDER[a.rollType] ?? 9) - (SESSION_ORDER[b.rollType] ?? 9)),
    }));
}
