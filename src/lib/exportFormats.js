const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent',
  leave: 'On leave',
};

function csvCell(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution if a name/roll begins with a formula marker.
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildAttendanceCsv(snapshot) {
  const rows = [[
    'Class', 'Section', 'Year / term', 'Date', 'Session', 'Roll number',
    'Student name', 'Roster status', 'Attendance', 'Roll saved at (UTC)',
  ]];

  for (const roll of snapshot.attendance ?? []) {
    for (const student of snapshot.students ?? []) {
      const rawStatus = roll.statuses?.[student.id];
      const status = Object.hasOwn(STATUS_LABELS, rawStatus) ? STATUS_LABELS[rawStatus] : 'Unmarked';
      rows.push([
        snapshot.class?.name,
        snapshot.class?.section,
        snapshot.class?.yearLabel,
        roll.dateISO,
        roll.rollType,
        student.rollNo,
        student.displayName,
        student.active === false ? 'Inactive' : 'Active',
        status,
        roll.updatedAt,
      ]);
    }
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function buildJsonBackup(snapshot, exportedAt = new Date()) {
  const exportedAtIso = exportedAt instanceof Date ? exportedAt.toISOString() : new Date(exportedAt).toISOString();
  const backup = {
    format: 'namma-class-firestore-backup',
    schemaVersion: 2,
    exportedAt: exportedAtIso,
    timeZone: 'Asia/Kolkata',
    class: {
      id: snapshot.class?.id ?? '',
      name: snapshot.class?.name ?? '',
      section: snapshot.class?.section ?? '',
      yearLabel: snapshot.class?.yearLabel ?? '',
      active: snapshot.class?.active !== false,
      createdAt: snapshot.class?.createdAt ?? null,
    },
    students: (snapshot.students ?? []).map((student) => ({
      id: student.id,
      rollNo: student.rollNo,
      displayName: student.displayName,
      active: student.active !== false,
      createdAt: student.createdAt ?? null,
    })),
    attendance: (snapshot.attendance ?? []).map((roll) => ({
      id: roll.id,
      dateISO: roll.dateISO,
      rollType: roll.rollType,
      statuses: { ...(roll.statuses ?? {}) },
      updatedAt: roll.updatedAt ?? null,
    })),
    calendarOverrides: (snapshot.calendar ?? []).map((event) => ({
      id: event.id,
      dateISO: event.dateISO,
      kind: event.kind,
      label: event.label,
      updatedAt: event.updatedAt ?? null,
    })),
    attendanceThreshold: snapshot.attendanceThreshold ? {
      termStartISO: snapshot.attendanceThreshold.termStartISO,
      termEndISO: snapshot.attendanceThreshold.termEndISO,
      trackingStartISO: snapshot.attendanceThreshold.trackingStartISO,
      workingWeekdays: Array.isArray(snapshot.attendanceThreshold.workingWeekdays)
        ? [...snapshot.attendanceThreshold.workingWeekdays]
        : [],
      sessionPolicy: snapshot.attendanceThreshold.sessionPolicy,
      leavePolicy: snapshot.attendanceThreshold.leavePolicy,
      calendarConfirmed: snapshot.attendanceThreshold.calendarConfirmed === true,
      updatedAt: snapshot.attendanceThreshold.updatedAt ?? null,
    } : null,
  };
  return JSON.stringify(backup, null, 2);
}

export function exportFilenameSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-IN')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'class';
}
