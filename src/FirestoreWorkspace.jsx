import React, { useEffect, useMemo, useState } from 'react';
import PwaInstallButton from './PwaInstallButton.jsx';
import {
  createTeacherClass,
  deleteClassCalendarOverride,
  importClassStudents,
  listAttendanceHistory,
  listClassCalendarOverrides,
  listClassStudents,
  listTeacherClasses,
  loadAttendance,
  loadClassAttendanceThreshold,
  loadClassExportSnapshot,
  saveAttendance,
  saveClassAttendanceThreshold,
  saveClassCalendarOverride,
} from './lib/firestoreRepository.js';
import { buildAttendanceCsv, buildJsonBackup, exportFilenameSlug } from './lib/exportFormats.js';
import { buildRollStudentEntries, groupAttendanceHistory, summarizeSavedRoll } from './lib/attendanceHistory.js';
import {
  ATTENDANCE_LEAVE_POLICIES,
  ATTENDANCE_SESSION_POLICIES,
  ATTENDANCE_WEEKDAYS,
  calculateAttendanceThreshold,
  validateAttendanceThresholdSettings,
} from './lib/attendanceThreshold.js';
import { mergePuducherryCalendar, PUDUCHERRY_CALENDAR_SOURCE } from './lib/puducherryCalendar.js';
import { renderParentMessage } from '../shared/messages.js';
import { parseRosterCsv } from './lib/rosterImport.js';

const ROLL_TYPES = ['MORNING', 'EVENING'];
const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'Present', short: 'P' },
  { value: 'absent', label: 'Absent', short: 'A' },
  { value: 'leave', label: 'On leave', short: 'L' },
];

function todayInChennai() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function emptyAttendanceThresholdForm() {
  return {
    termStartISO: '',
    termEndISO: '',
    trackingStartISO: '',
    workingWeekdays: [],
    sessionPolicy: '',
    leavePolicy: '',
    calendarConfirmed: false,
  };
}

function attendanceThresholdFormFrom(settings) {
  if (!settings) return emptyAttendanceThresholdForm();
  return {
    termStartISO: settings.termStartISO ?? '',
    termEndISO: settings.termEndISO ?? '',
    trackingStartISO: settings.trackingStartISO ?? '',
    workingWeekdays: Array.isArray(settings.workingWeekdays) ? [...settings.workingWeekdays].sort((a, b) => a - b) : [],
    sessionPolicy: settings.sessionPolicy ?? '',
    leavePolicy: settings.leavePolicy ?? '',
    calendarConfirmed: settings.calendarConfirmed === true,
  };
}

function sameAttendanceThresholdForm(left, right) {
  return JSON.stringify(attendanceThresholdFormFrom(left)) === JSON.stringify(attendanceThresholdFormFrom(right));
}

function displayDate(dateISO) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  }).format(new Date(`${dateISO}T12:00:00Z`));
}

function displayTime(timestampISO) {
  if (!timestampISO) return 'Time not recorded';
  return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    .format(new Date(timestampISO));
}

function downloadFile(filename, contents, contentType) {
  const blob = new Blob([contents], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function friendlyFirestoreError(error) {
  if (error?.code === 'permission-denied') {
    return 'Firestore denied this action. Confirm the latest reviewed rules are published and this teacher is approved for the class.';
  }
  if (error?.code === 'unavailable' || error?.code === 'network-request-failed') {
    return 'Firestore is temporarily unreachable. Your unsaved changes are still on this screen; try again when the connection is back.';
  }
  return error?.message || 'The Firestore operation could not be completed.';
}

function BrandMark() {
  return <div className="live-brand-mark" aria-hidden="true"><span /><span /><span /><span /></div>;
}

function LiveShell({ user, onSignOut, signOutDisabled = false, children, className = '' }) {
  return (
    <main className={`live-shell ${className}`}>
      <header className="live-topbar">
        <div className="live-brand"><BrandMark /><span><strong>namma</strong> class</span></div>
        <div className="live-topbar-right">
          <PwaInstallButton compact />
          <span className="live-cloud-badge"><i /> Approved teacher</span>
          <span className="live-user-email">{user.email || 'Teacher account'}</span>
          <button className="live-quiet-button" type="button" onClick={onSignOut} disabled={signOutDisabled}>Sign out</button>
        </div>
      </header>
      {children}
      <footer className="live-footer"><span>Teacher-only workspace</span><span>Messages are off · No parent contacts are stored</span></footer>
    </main>
  );
}

function Notice({ children, tone = 'info' }) {
  if (!children) return null;
  return <div className={`live-notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

function HistoryRollCard({ roll, students }) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeSavedRoll(roll);
  const studentEntries = expanded ? buildRollStudentEntries(roll, students) : [];
  const statusLabels = { present: 'Present', absent: 'Absent', leave: 'On leave', unmarked: 'Unmarked' };
  return (
    <article className="live-history-roll">
      <div className="live-history-roll-title"><strong>{roll.rollType === 'MORNING' ? 'Morning roll' : roll.rollType === 'EVENING' ? 'Evening roll' : roll.rollType}</strong><time>{displayTime(roll.updatedAt)}</time></div>
      <div className="live-history-counts"><span className="present">{summary.present} present</span><span className="absent">{summary.absent} absent</span><span className="leave">{summary.leave} on leave</span><span>{summary.total} saved status{summary.total === 1 ? '' : 'es'}</span></div>
      {summary.total > 0 && <button className="live-history-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? 'Hide' : 'View'} individual statuses <span>({summary.total})</span></button>}
      {expanded && <ul className="live-history-student-list">{studentEntries.map((entry, index) => <li key={`${roll.id}-${index}`}><span>{entry.label}</span><strong className={`live-history-student-status ${entry.status}`}>{statusLabels[entry.status]}</strong></li>)}</ul>}
    </article>
  );
}

function ParentMessageReview({ absentStudents, leaveCount, dateISO, rollType, onClose }) {
  const [selectedStudentId, setSelectedStudentId] = useState(absentStudents[0]?.id ?? '');
  const [language, setLanguage] = useState('en');
  const selectedStudent = absentStudents.find((student) => student.id === selectedStudentId) ?? absentStudents[0] ?? null;
  let draft = '';
  if (selectedStudent) {
    try {
      draft = renderParentMessage({
        studentLabel: selectedStudent.displayName,
        rollNo: selectedStudent.rollNo,
        rollType,
        dateISO,
        language,
      });
    } catch {
      draft = 'This draft could not be generated from the roster entry. Check the student name and roll number.';
    }
  }

  useEffect(() => {
    setSelectedStudentId(absentStudents[0]?.id ?? '');
  }, [absentStudents]);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="live-message-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="live-message-modal" role="dialog" aria-modal="true" aria-labelledby="live-message-title">
        <div className="live-message-heading">
          <div><span className="live-eyebrow">HUMAN REVIEW · NO SEND</span><h2 id="live-message-title">Review unsent parent drafts</h2><p>{rollType === 'MORNING' ? 'Morning' : 'Evening'} roll · {displayDate(dateISO)}</p></div>
          <button className="live-secondary-button" type="button" onClick={onClose} aria-label="Close message review">Close</button>
        </div>
        <div className="live-message-safety"><strong>Preview only.</strong> Nothing is sent, no parent contact details are stored, and only this saved roll is used. Students marked on leave are excluded.</div>
        {absentStudents.length === 0 ? (
          <div className="live-message-empty"><h3>No absence drafts for this saved roll</h3><p>{leaveCount ? `${leaveCount} student${leaveCount === 1 ? '' : 's'} marked on leave were excluded.` : 'No students were marked absent.'}</p></div>
        ) : (
          <div className="live-message-review-body">
            <div className="live-message-students" role="list" aria-label="Students marked absent">
              {absentStudents.map((student) => <div role="listitem" key={student.id}><button type="button" className={selectedStudent?.id === student.id ? 'active' : ''} onClick={() => setSelectedStudentId(student.id)}><span className="live-roll-badge">{student.rollNo}</span><span><strong>{student.displayName}</strong><small>Marked absent in this saved roll</small></span></button></div>)}
            </div>
            <div className="live-message-preview">
              <div className="live-message-preview-heading"><div><span className="live-eyebrow">DRAFT PREVIEW</span><strong>{selectedStudent?.displayName}</strong></div><div className="live-message-languages" role="group" aria-label="Draft language"><button type="button" aria-pressed={language === 'en'} className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button><button type="button" aria-pressed={language === 'ta'} className={language === 'ta' ? 'active' : ''} onClick={() => setLanguage('ta')}>தமிழ்</button></div></div>
              <pre className="live-message-paper">{draft}</pre>
              {language === 'ta' && <p className="live-message-translation-note">Tamil wording is a draft and must be reviewed by a native speaker before any live use.</p>}
            </div>
          </div>
        )}
        <div className="live-message-footer"><span>Sending is disabled in this build.</span><button className="live-primary-button" type="button" disabled title="Parent contact, consent, and send gates are not implemented">Send disabled</button></div>
      </section>
    </div>
  );
}

function AttendanceThresholdPanel({
  ready,
  loadError,
  savedSettings,
  form,
  formDirty,
  saveBusy,
  canSave,
  result,
  todayISO,
  onFieldChange,
  onSave,
  onDiscard,
}) {
  const validationErrors = validateAttendanceThresholdSettings(form);
  const updateWeekday = (weekday, checked) => {
    const current = new Set(form.workingWeekdays);
    if (checked) current.add(weekday);
    else current.delete(weekday);
    onFieldChange('workingWeekdays', [...current].sort((a, b) => a - b));
  };

  return (
    <section className="live-threshold-panel" aria-labelledby="live-threshold-title">
      <div className="live-threshold-heading">
        <div><span className="live-eyebrow">TEACHER-CONFIGURED · NO AUTOMATIC ALERTS</span><h3 id="live-threshold-title">75% attendance review</h3><p>One college date counts once. Figures are withheld if required saved rolls or student statuses are missing.</p></div>
        <span className="live-threshold-lock">Preview only · no parent messages</span>
      </div>
      {!ready ? (
        <div className="live-threshold-blocker" role="status">
          <strong>Calculation settings unavailable</strong>
          <p>{loadError || 'Load this class history and its calendar settings before configuring attendance review.'}</p>
          {loadError && <small>Publish the updated teacher-scoped Firestore rules before saving percentage settings.</small>}
        </div>
      ) : (
        <>
          <div className="live-threshold-policy">
            <div className="live-threshold-fields">
              <label><span>College term starts</span><input type="date" value={form.termStartISO} max={form.termEndISO || undefined} onChange={(event) => onFieldChange('termStartISO', event.target.value)} disabled={saveBusy} /></label>
              <label><span>College term ends</span><input type="date" value={form.termEndISO} min={form.termStartISO || undefined} onChange={(event) => onFieldChange('termEndISO', event.target.value)} disabled={saveBusy} /></label>
              <label><span>Complete tracking starts</span><input type="date" value={form.trackingStartISO} min={form.termStartISO || undefined} max={form.termEndISO || undefined} onChange={(event) => onFieldChange('trackingStartISO', event.target.value)} disabled={saveBusy} /><small>First date from which all current students’ required rolls are available. Missing data is never counted as absence.</small></label>
            </div>
            <fieldset className="live-threshold-weekdays">
              <legend>Ordinary working weekdays</legend>
              <div>{ATTENDANCE_WEEKDAYS.map((day) => <label key={day.value}><input type="checkbox" checked={form.workingWeekdays.includes(day.value)} onChange={(event) => updateWeekday(day.value, event.target.checked)} disabled={saveBusy} /><span>{day.short}</span></label>)}</div>
            </fieldset>
            <div className="live-threshold-fields">
              <label><span>How do two rolls count as one day?</span><select value={form.sessionPolicy} onChange={(event) => onFieldChange('sessionPolicy', event.target.value)} disabled={saveBusy}><option value="">Choose the college rule</option>{ATTENDANCE_SESSION_POLICIES.map((policy) => <option key={policy.value} value={policy.value}>{policy.label}</option>)}</select></label>
              <label><span>How should “On leave” count?</span><select value={form.leavePolicy} onChange={(event) => onFieldChange('leavePolicy', event.target.value)} disabled={saveBusy}><option value="">Choose the college rule</option>{ATTENDANCE_LEAVE_POLICIES.map((policy) => <option key={policy.value} value={policy.value}>{policy.label}</option>)}</select></label>
            </div>
            <label className="live-threshold-calendar-confirm"><input type="checkbox" checked={form.calendarConfirmed} onChange={(event) => onFieldChange('calendarConfirmed', event.target.checked)} disabled={saveBusy} /><span>I checked the whole selected term against the college schedule, including holidays, breaks, and special working days. I verified or edited the Puducherry 2026 public-holiday defaults where applicable.</span></label>
            {validationErrors.length > 0 && <ul className="live-threshold-validation">{validationErrors.map((message) => <li key={message}>{message}</li>)}</ul>}
            <div className="live-threshold-actions">
              <span>{savedSettings ? `Rules saved${savedSettings.updatedAt ? ` · ${displayTime(savedSettings.updatedAt)}` : ''}` : 'No percentage rules saved yet'}</span>
              <div>{formDirty && <button className="live-secondary-button" type="button" onClick={onDiscard} disabled={saveBusy}>Discard edits</button>}<button className="live-primary-button" type="button" onClick={onSave} disabled={!canSave}>{saveBusy ? 'Saving rules…' : savedSettings ? 'Save rule changes' : 'Save rules'}</button></div>
            </div>
          </div>
          <div className="live-threshold-result" aria-live="polite">
            {result?.status === 'pending-changes' ? (
              <div className="live-threshold-blocker"><strong>{savedSettings ? 'Save or discard policy edits to view percentages.' : 'Complete and save the calculation rules to start.'}</strong><p>{savedSettings ? 'The previous calculation is hidden while its rules are being changed.' : 'No attendance percentage is shown until all required settings are complete.'}</p></div>
            ) : result?.status === 'not-configured' ? (
              <div className="live-threshold-blocker"><strong>No percentage is calculated yet.</strong><p>Complete and save the term dates, working weekdays, session rule, leave treatment, and calendar confirmation above.</p></div>
            ) : result?.status === 'incomplete' ? (
              <div className="live-threshold-blocker">
                <strong>Attendance coverage incomplete — no percentages shown</strong>
                <p>{result.missingRollCount} required roll record{result.missingRollCount === 1 ? '' : 's'} and {result.missingStatusCount} student status{result.missingStatusCount === 1 ? '' : 'es'} are missing across {result.workingDayCount} scheduled working day{result.workingDayCount === 1 ? '' : 's'} ({result.fromISO} to {result.throughISO}). Missing entries are not treated as absences.</p>
                {(result.missingRolls.length > 0 || result.missingStatuses.length > 0) && <ul>{result.missingRolls.slice(0, 5).map((item) => <li key={`${item.dateISO}-${item.rollType}`}>{item.dateISO} · {item.rollType === 'MORNING' ? 'morning' : 'evening'} roll not saved</li>)}{result.missingStatuses.slice(0, 5).map((item) => <li key={`${item.dateISO}-${item.rollType}-status`}>{item.dateISO} · {item.rollType === 'MORNING' ? 'morning' : 'evening'} roll is missing {item.count} student status{item.count === 1 ? '' : 'es'}</li>)}</ul>}
              </div>
            ) : result?.status === 'no-working-days' ? (
              <div className="live-threshold-blocker"><strong>No scheduled working days in the calculation range</strong><p>Checked through {result.throughISO}. Review the tracking start date, term dates, weekdays, and calendar entries.</p></div>
            ) : result?.status === 'no-students' ? (
              <div className="live-threshold-blocker"><strong>No active roster to calculate</strong><p>Add or load the current class roster before reviewing percentages.</p></div>
            ) : result?.status === 'ready' ? (
              <>
                <div className="live-threshold-result-heading"><div><strong>Review through {result.throughISO}</strong><span>{result.workingDayCount} scheduled date{result.workingDayCount === 1 ? '' : 's'} from {result.fromISO} · each date counted once</span></div><span className={result.belowThresholdCount ? 'live-threshold-count risk' : 'live-threshold-count'}>{result.belowThresholdCount} below 75%</span></div>
                <div className="live-threshold-table"><div className="live-threshold-table-head"><span>ROLL</span><span>STUDENT</span><span>PRESENT / COUNTED</span><span>ATTENDANCE</span><span>REVIEW</span></div>{result.rows.map((row) => <div className="live-threshold-table-row" key={row.id}><span className="live-roll-badge">{row.rollNo}</span><strong>{row.displayName}</strong><span>{row.percentage === null ? 'No counted days' : `${row.presentDays} / ${row.countedDays}${row.excludedLeaveDays ? ` · ${row.excludedLeaveDays} leave day${row.excludedLeaveDays === 1 ? '' : 's'} excluded` : ''}`}</span><strong className={row.belowThreshold ? 'risk' : ''}>{row.percentage === null ? '—' : `${Number.isInteger(row.percentage) ? row.percentage.toFixed(0) : row.percentage.toFixed(2)}%`}</strong><span>{row.belowThreshold ? <em className="live-threshold-risk-pill">Below 75%</em> : row.percentage === null ? 'No data' : 'On track'}</span></div>)}</div>
                <p className="live-threshold-disclaimer">Teacher review only. This calculation does not send notifications. Confirm the saved rules and source attendance before acting.</p>
              </>
            ) : result?.status === 'unavailable' ? (
              <div className="live-threshold-blocker"><strong>Calculation is not available</strong><p>{result.message || 'Refresh history and calendar settings before calculating.'}</p></div>
            ) : (
              <div className="live-threshold-blocker"><strong>No percentage is displayed.</strong><p>Refresh the saved history and confirm the calculation rules.</p></div>
            )}
          </div>
        </>
      )}
      <div className="live-threshold-foot">The calculation covers the configured tracking period through {todayISO}, capped at the term end. For “either” or “both” session rules, both AM and PM rolls must be saved on every scheduled working date. No warning is shown if coverage is incomplete.</div>
    </section>
  );
}

export default function FirestoreWorkspace({ user, onSignOut }) {
  const [loadState, setLoadState] = useState('loading');
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [studentsClassId, setStudentsClassId] = useState('');
  const [studentsLoadState, setStudentsLoadState] = useState('loading');
  const [rosterLoadVersion, setRosterLoadVersion] = useState(0);
  const [view, setView] = useState('attendance');
  const [dateISO, setDateISO] = useState(todayInChennai);
  const [rollType, setRollType] = useState('MORNING');
  const [statuses, setStatuses] = useState({});
  const [rollBusy, setRollBusy] = useState(false);
  const [rollDirty, setRollDirty] = useState(false);
  const [rollSavedAt, setRollSavedAt] = useState(null);
  const [parentReviewOpen, setParentReviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [classForm, setClassForm] = useState({ name: '', section: '', yearLabel: '' });
  const [classBusy, setClassBusy] = useState(false);
  const [rosterText, setRosterText] = useState('');
  const [rosterConsent, setRosterConsent] = useState(false);
  const [rosterRows, setRosterRows] = useState(null);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [backupConsent, setBackupConsent] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupSnapshot, setBackupSnapshot] = useState(null);
  const [backupExportedAt, setBackupExportedAt] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyRecords, setHistoryRecords] = useState(null);
  const [historyClassId, setHistoryClassId] = useState('');
  const [historyLoadedAt, setHistoryLoadedAt] = useState(null);
  const [thresholdSettings, setThresholdSettings] = useState(null);
  const [thresholdForm, setThresholdForm] = useState(emptyAttendanceThresholdForm);
  const [thresholdLoadedClassId, setThresholdLoadedClassId] = useState('');
  const [thresholdCalendarOverrides, setThresholdCalendarOverrides] = useState(null);
  const [thresholdCalendarClassId, setThresholdCalendarClassId] = useState('');
  const [thresholdLoadError, setThresholdLoadError] = useState('');
  const [thresholdSaveBusy, setThresholdSaveBusy] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarOverrides, setCalendarOverrides] = useState(null);
  const [calendarClassId, setCalendarClassId] = useState('');
  const [calendarYear, setCalendarYear] = useState(2026);
  const [calendarDrafts, setCalendarDrafts] = useState({});
  const [calendarNewDate, setCalendarNewDate] = useState('2026-01-01');
  const [calendarNewKind, setCalendarNewKind] = useState('HOLIDAY');
  const [calendarNewLabel, setCalendarNewLabel] = useState('');

  const selectedClass = classes.find((item) => item.id === classId) ?? classes[0] ?? null;
  const rosterReady = Boolean(selectedClass && studentsClassId === selectedClass.id && studentsLoadState === 'ready');
  const rosterPending = Boolean(selectedClass && (studentsClassId !== selectedClass.id || studentsLoadState === 'loading'));
  const rosterFailed = Boolean(selectedClass && studentsClassId === selectedClass.id && studentsLoadState === 'error');
  const activeStudents = useMemo(
    () => rosterReady ? students.filter((student) => student.active !== false) : [],
    [students, rosterReady],
  );
  const studentSignature = activeStudents.map((student) => student.id).join('|');
  const counts = useMemo(() => {
    const total = { present: 0, absent: 0, leave: 0, unmarked: 0 };
    for (const student of activeStudents) {
      const status = statuses[student.id];
      if (ATTENDANCE_STATUSES.some((item) => item.value === status)) total[status] += 1;
      else total.unmarked += 1;
    }
    return total;
  }, [activeStudents, statuses]);
  const markedCount = activeStudents.length - counts.unmarked;
  const isComplete = activeStudents.length > 0 && counts.unmarked === 0;
  const absentStudents = useMemo(
    () => activeStudents.filter((student) => statuses[student.id] === 'absent'),
    [activeStudents, statuses],
  );
  const leaveCount = useMemo(
    () => activeStudents.filter((student) => statuses[student.id] === 'leave').length,
    [activeStudents, statuses],
  );
  const canReviewParentDrafts = Boolean(rollSavedAt && !rollDirty && !rollBusy && isComplete);
  const visibleStudents = activeStudents.filter((student) => {
    const query = studentSearch.trim().toLocaleLowerCase('en-IN');
    return !query || String(student.rollNo).toLocaleLowerCase('en-IN').includes(query)
      || String(student.displayName).toLocaleLowerCase('en-IN').includes(query);
  });
  const historyGroups = useMemo(
    () => historyClassId === selectedClass?.id ? groupAttendanceHistory(historyRecords ?? []) : [],
    [historyRecords, historyClassId, selectedClass?.id],
  );
  const todayISO = todayInChennai();
  const thresholdFormDirty = !sameAttendanceThresholdForm(thresholdForm, thresholdSettings ?? emptyAttendanceThresholdForm());
  const thresholdValidationErrors = validateAttendanceThresholdSettings(thresholdForm);
  const thresholdDataReady = Boolean(
    historyClassId === selectedClass?.id
      && thresholdLoadedClassId === selectedClass?.id
      && thresholdCalendarClassId === selectedClass?.id
      && !thresholdLoadError,
  );
  const thresholdCanSave = Boolean(
    thresholdDataReady && isOnline && thresholdFormDirty && thresholdValidationErrors.length === 0
      && !thresholdSaveBusy && !historyBusy && !calendarBusy && !backupBusy && !rollBusy,
  );
  const attendanceThresholdResult = useMemo(() => {
    if (historyRecords === null || historyClassId !== selectedClass?.id) {
      return { status: 'unavailable', message: 'Load saved attendance history to review percentages.' };
    }
    if (!thresholdDataReady) {
      return { status: 'unavailable', message: thresholdLoadError || 'Load this class’s calendar and threshold settings first.' };
    }
    if (thresholdFormDirty) return { status: 'pending-changes' };
    if (!thresholdSettings) return { status: 'not-configured' };
    return calculateAttendanceThreshold({
      settings: thresholdSettings,
      attendanceRecords: historyRecords,
      students: activeStudents,
      calendarOverrides: thresholdCalendarOverrides ?? [],
      todayISO,
    });
  }, [historyRecords, historyClassId, selectedClass?.id, thresholdDataReady, thresholdLoadError, thresholdFormDirty, thresholdSettings, activeStudents, thresholdCalendarOverrides, todayISO]);
  const calendarItems = useMemo(
    () => mergePuducherryCalendar(calendarYear, calendarClassId === selectedClass?.id ? calendarOverrides ?? [] : []),
    [calendarYear, calendarOverrides, calendarClassId, selectedClass?.id],
  );
  const calendarHasPendingChanges = useMemo(() => Object.entries(calendarDrafts).some(([dateISO, draft]) => {
    const original = calendarItems.find((event) => event.dateISO === dateISO);
    return original && (draft.kind !== original.kind || draft.label !== original.label);
  }) || Boolean(calendarNewLabel.trim()), [calendarDrafts, calendarItems, calendarNewLabel]);

  useEffect(() => {
    let cancelled = false;
    setLoadState('loading');
    setError('');
    listTeacherClasses(user.uid)
      .then((items) => {
        if (cancelled) return;
        setClasses(items);
        setClassId((current) => items.some((item) => item.id === current) ? current : (items[0]?.id ?? ''));
        setLoadState('ready');
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(friendlyFirestoreError(reason));
        setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [user.uid]);

  useEffect(() => {
    if (!selectedClass) {
      setStudents([]);
      setStudentsClassId('');
      setStudentsLoadState('ready');
      return undefined;
    }
    let cancelled = false;
    setStudents([]);
    setStudentsClassId(selectedClass.id);
    setStudentsLoadState('loading');
    setStatuses({});
    setRollSavedAt(null);
    setRollDirty(false);
    setRollBusy(false);
    setError('');
    listClassStudents(selectedClass.id)
      .then((items) => {
        if (cancelled) return;
        setStudents(items);
        setStudentsLoadState('ready');
      })
      .catch((reason) => {
        if (cancelled) return;
        setStudentsLoadState('error');
        setError(friendlyFirestoreError(reason));
      });
    return () => { cancelled = true; };
  }, [selectedClass?.id, rosterLoadVersion]);

  useEffect(() => {
    if (!selectedClass || !rosterReady || activeStudents.length === 0) {
      setStatuses({});
      setRollSavedAt(null);
      setRollDirty(false);
      setRollBusy(false);
      return undefined;
    }
    let cancelled = false;
    setParentReviewOpen(false);
    setRollBusy(true);
    setError('');
    loadAttendance(selectedClass.id, dateISO, rollType)
      .then((record) => {
        if (cancelled) return;
        const defaults = Object.fromEntries(activeStudents.map((student) => [student.id, 'unmarked']));
        const savedStatuses = record?.statuses && typeof record.statuses === 'object' ? record.statuses : {};
        for (const student of activeStudents) {
          const saved = savedStatuses[student.id];
          if (ATTENDANCE_STATUSES.some((item) => item.value === saved)) defaults[student.id] = saved;
        }
        setStatuses(defaults);
        setRollSavedAt(record?.updatedAt?.toDate?.() ?? null);
        setRollDirty(false);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(friendlyFirestoreError(reason));
          setStatuses(Object.fromEntries(activeStudents.map((student) => [student.id, 'unmarked'])));
          setRollSavedAt(null);
          setRollDirty(false);
        }
      })
      .finally(() => { if (!cancelled) setRollBusy(false); });
    return () => { cancelled = true; };
  }, [selectedClass?.id, dateISO, rollType, studentSignature, rosterReady]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const updateNetworkStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    setParentReviewOpen(false);
    setBackupSnapshot(null);
    setBackupExportedAt(null);
    setBackupConsent(false);
    setHistoryRecords(null);
    setHistoryClassId('');
    setHistoryLoadedAt(null);
    setThresholdSettings(null);
    setThresholdForm(emptyAttendanceThresholdForm());
    setThresholdLoadedClassId('');
    setThresholdCalendarOverrides(null);
    setThresholdCalendarClassId('');
    setThresholdLoadError('');
    setCalendarOverrides(null);
    setCalendarClassId('');
    setCalendarDrafts({});
  }, [selectedClass?.id]);

  useEffect(() => {
    setCalendarNewDate(`${calendarYear}-01-01`);
    setCalendarDrafts({});
  }, [calendarYear]);

  async function handleCreateClass(event) {
    event.preventDefault();
    if (!isOnline) return;
    setClassBusy(true);
    setError('');
    try {
      const created = await createTeacherClass(user.uid, classForm);
      setClasses((current) => [...current, created]);
      setClassId(created.id);
      setView('roster');
      setNotice('Class created. Add the roster when you are ready; no students were added automatically.');
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setClassBusy(false);
    }
  }

  function previewRoster() {
    if (!rosterReady) return;
    setError('');
    setNotice('');
    try {
      setRosterRows(parseRosterCsv(rosterText, activeStudents));
    } catch (reason) {
      setRosterRows(null);
      setError(reason.message);
    }
  }

  async function handleImportRoster() {
    if (!isOnline || !selectedClass || !rosterReady || !rosterRows || !rosterConsent || rollBusy || rosterBusy || backupBusy || historyBusy || calendarBusy) return;
    if (!confirmDiscardRoll('import a roster')) return;
    const targetClassId = selectedClass.id;
    const importedCount = rosterRows.length;
    setRosterBusy(true);
    setError('');
    try {
      await importClassStudents(targetClassId, rosterRows);
      setBackupSnapshot(null);
      setBackupExportedAt(null);
      setHistoryRecords(null);
      setHistoryClassId('');
      setHistoryLoadedAt(null);
      // The batch has committed. Clear the preview before refreshing so a retry
      // cannot accidentally submit the same list a second time.
      setRosterRows(null);
      setRosterText('');
      setRosterConsent(false);
      setStudents([]);
      setStudentsClassId(targetClassId);
      setStudentsLoadState('loading');
      setView('roster');
      try {
        const updated = await listClassStudents(targetClassId);
        setStudents(updated);
        setStudentsLoadState('ready');
        setView('attendance');
        setNotice(`${importedCount} student records saved to the teacher-owned Firestore project.`);
      } catch (reason) {
        setStudentsLoadState('error');
        setError(`Roster was saved, but the refresh failed. Retry the roster read; do not import the same rows again. ${friendlyFirestoreError(reason)}`);
      }
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setRosterBusy(false);
    }
  }

  function changeStatus(studentId, status) {
    if (!isOnline || backupBusy || historyBusy || calendarBusy) return;
    setStatuses((current) => ({ ...current, [studentId]: status }));
    setRollDirty(true);
    setError('');
  }

  function markAllPresent() {
    if (!isOnline || backupBusy || historyBusy || calendarBusy) return;
    setStatuses(Object.fromEntries(activeStudents.map((student) => [student.id, 'present'])));
    setRollDirty(true);
    setError('');
  }

  async function handleSaveRoll() {
    if (!isOnline || !selectedClass || !rosterReady || !isComplete || rollBusy || backupBusy || historyBusy || calendarBusy) return;
    setRollBusy(true);
    setError('');
    try {
      await saveAttendance({
        classId: selectedClass.id,
        dateISO,
        rollType,
        statuses,
        teacherId: user.uid,
        students: activeStudents,
      });
      setRollDirty(false);
      setRollSavedAt(new Date());
      setBackupSnapshot(null);
      setBackupExportedAt(null);
      setHistoryRecords(null);
      setHistoryClassId('');
      setHistoryLoadedAt(null);
      setNotice(`${rollType === 'MORNING' ? 'Morning' : 'Evening'} roll saved to Firestore.`);
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setRollBusy(false);
    }
  }

  async function handleOpenHistory() {
    if (!isOnline || !selectedClass || !rosterReady || historyBusy || calendarBusy || backupBusy || rollBusy || rosterBusy || classBusy || thresholdSaveBusy) return;
    if (!confirmDiscardThreshold('refresh attendance history') || !confirmDiscardCalendar('open attendance history')) return;
    clearCalendarDrafts();
    const targetClassId = selectedClass.id;
    setView('history');
    setHistoryBusy(true);
    setHistoryRecords(null);
    setHistoryClassId(targetClassId);
    setHistoryLoadedAt(null);
    setThresholdSettings(null);
    setThresholdForm(emptyAttendanceThresholdForm());
    setThresholdLoadedClassId('');
    setThresholdCalendarOverrides(null);
    setThresholdCalendarClassId('');
    setThresholdLoadError('');
    setError('');
    try {
      const [historyResult, settingsResult, calendarResult] = await Promise.allSettled([
        listAttendanceHistory(targetClassId),
        loadClassAttendanceThreshold(targetClassId),
        listClassCalendarOverrides(targetClassId),
      ]);
      if (historyResult.status === 'rejected') throw historyResult.reason;
      const records = historyResult.value;
      setHistoryRecords(records);
      setHistoryLoadedAt(new Date());
      const supportingErrors = [];
      if (settingsResult.status === 'fulfilled') {
        setThresholdSettings(settingsResult.value);
        setThresholdForm(attendanceThresholdFormFrom(settingsResult.value));
        setThresholdLoadedClassId(targetClassId);
      } else {
        supportingErrors.push(`Attendance settings: ${friendlyFirestoreError(settingsResult.reason)}`);
      }
      if (calendarResult.status === 'fulfilled') {
        setThresholdCalendarOverrides(calendarResult.value);
        setThresholdCalendarClassId(targetClassId);
      } else {
        supportingErrors.push(`Calendar data: ${friendlyFirestoreError(calendarResult.reason)}`);
      }
      setThresholdLoadError(supportingErrors.join(' '));
      setNotice(`Loaded ${records.length} saved attendance roll${records.length === 1 ? '' : 's'} from Firestore.`);
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setHistoryBusy(false);
    }
  }

  async function handleSaveAttendanceThreshold() {
    if (!selectedClass || !thresholdCanSave) return;
    setThresholdSaveBusy(true);
    setError('');
    try {
      const saved = await saveClassAttendanceThreshold({
        classId: selectedClass.id,
        teacherId: user.uid,
        settings: thresholdForm,
      });
      setThresholdSettings(saved);
      setThresholdForm(attendanceThresholdFormFrom(saved));
      setBackupSnapshot(null);
      setBackupExportedAt(null);
      setNotice('Attendance review rules saved. Percentages will appear only when every required roll and student status is present.');
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setThresholdSaveBusy(false);
    }
  }

  function discardAttendanceThresholdEdits() {
    setThresholdForm(attendanceThresholdFormFrom(thresholdSettings));
  }

  async function handleOpenCalendar() {
    if (!isOnline || !selectedClass || !rosterReady || calendarBusy || historyBusy || backupBusy || rollBusy || rosterBusy || classBusy || thresholdSaveBusy) return;
    if (!confirmDiscardCalendar('refresh the calendar')) return;
    clearCalendarDrafts();
    const targetClassId = selectedClass.id;
    setView('calendar');
    setCalendarBusy(true);
    setCalendarOverrides(null);
    setCalendarClassId(targetClassId);
    setCalendarDrafts({});
    setError('');
    try {
      const records = await listClassCalendarOverrides(targetClassId);
      setCalendarOverrides(records);
      setNotice(`Loaded ${records.length} teacher calendar change${records.length === 1 ? '' : 's'}.`);
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setCalendarBusy(false);
    }
  }

  function calendarDraftFor(event) {
    return calendarDrafts[event.dateISO] ?? { kind: event.kind, label: event.label };
  }

  function updateCalendarDraft(dateISO, field, value, event) {
    setCalendarDrafts((current) => ({
      ...current,
      [dateISO]: { ...(current[dateISO] ?? { kind: event.kind, label: event.label }), [field]: value },
    }));
  }

  async function saveCalendarDate(dateISO, kind, label) {
    if (!isOnline || !selectedClass || !calendarClassId || calendarBusy || calendarClassId !== selectedClass.id) return false;
    setCalendarBusy(true);
    setError('');
    try {
      const saved = await saveClassCalendarOverride({
        classId: selectedClass.id,
        dateISO,
        kind,
        label,
        teacherId: user.uid,
      });
      setCalendarOverrides((current) => [...(current ?? []).filter((event) => event.dateISO !== dateISO), saved]);
      setBackupSnapshot(null);
      setBackupExportedAt(null);
      setCalendarDrafts((current) => {
        const next = { ...current };
        delete next[dateISO];
        return next;
      });
      setNotice(`${displayDate(dateISO)} saved as ${kind === 'HOLIDAY' ? 'a holiday' : 'a working day'}.`);
      return true;
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
      return false;
    } finally {
      setCalendarBusy(false);
    }
  }

  async function resetCalendarDate(dateISO) {
    if (!isOnline || !selectedClass || calendarBusy || !calendarOverrides?.some((event) => event.dateISO === dateISO)) return;
    if (!window.confirm('Remove this teacher calendar change? The Puducherry default will be restored, or this added date will disappear.')) return;
    setCalendarBusy(true);
    setError('');
    try {
      await deleteClassCalendarOverride(selectedClass.id, dateISO);
      setCalendarOverrides((current) => (current ?? []).filter((event) => event.dateISO !== dateISO));
      setBackupSnapshot(null);
      setBackupExportedAt(null);
      setCalendarDrafts((current) => {
        const next = { ...current };
        delete next[dateISO];
        return next;
      });
      setNotice('Teacher calendar change removed.');
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setCalendarBusy(false);
    }
  }

  async function addCalendarDate() {
    if (!calendarNewDate || calendarItems.some((event) => event.dateISO === calendarNewDate)) return;
    const label = calendarNewLabel.trim();
    if (!label) {
      setError('Enter a short label for the college calendar date.');
      return;
    }
    if (await saveCalendarDate(calendarNewDate, calendarNewKind, label)) setCalendarNewLabel('');
  }

  async function prepareBackupSnapshot() {
    if (!isOnline || !selectedClass || !rosterReady || !backupConsent || backupBusy || rollBusy || rosterBusy || classBusy || historyBusy || calendarBusy || thresholdSaveBusy) return;
    if (rollDirty && !window.confirm('There are unsaved attendance changes. This export includes saved Firestore records only, not the changes on this screen. Continue?')) return;
    setBackupBusy(true);
    setError('');
    setNotice('');
    try {
      const snapshot = await loadClassExportSnapshot(selectedClass.id);
      setBackupSnapshot(snapshot);
      setBackupExportedAt(new Date());
      setNotice('Export snapshot prepared from saved Firestore records. Download the CSV, JSON backup, or both.');
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setBackupBusy(false);
    }
  }

  function downloadAttendanceCsv() {
    if (!backupSnapshot || backupSnapshot.class.id !== selectedClass?.id || !backupExportedAt) return;
    const csv = buildAttendanceCsv(backupSnapshot);
    const fileName = `namma-class-${exportFilenameSlug(backupSnapshot.class.name)}-attendance-${todayInChennai()}.csv`;
    downloadFile(fileName, csv, 'text/csv;charset=utf-8');
    setNotice('Attendance CSV downloaded. Store it only in an approved, access-controlled location.');
  }

  function downloadJsonBackupFile() {
    if (!backupSnapshot || backupSnapshot.class.id !== selectedClass?.id || !backupExportedAt) return;
    const json = buildJsonBackup(backupSnapshot, backupExportedAt);
    const fileName = `namma-class-${exportFilenameSlug(backupSnapshot.class.name)}-backup-${todayInChennai()}.json`;
    downloadFile(fileName, json, 'application/json;charset=utf-8');
    setNotice('JSON backup downloaded. Store it only in an approved, access-controlled location.');
  }

  function confirmDiscardRoll(action) {
    if (!rollDirty) return true;
    return window.confirm(`You have unsaved attendance changes. Continuing to ${action} will discard them. Continue?`);
  }

  function confirmDiscardCalendar(action) {
    if (!calendarHasPendingChanges) return true;
    return window.confirm(`You have unsaved calendar edits. Continuing to ${action} will discard them. Continue?`);
  }

  function confirmDiscardThreshold(action) {
    if (!thresholdFormDirty) return true;
    return window.confirm(`You have unsaved 75% calculation rule edits. Continuing to ${action} will discard them. Continue?`);
  }

  function clearCalendarDrafts() {
    setCalendarDrafts({});
    setCalendarNewLabel('');
  }

  function changeCalendarYear(amount) {
    if (!confirmDiscardCalendar('change calendar years')) return;
    clearCalendarDrafts();
    setCalendarYear((year) => year + amount);
  }

  function handleSafeSignOut() {
    if (rollBusy || rosterBusy || classBusy || backupBusy || historyBusy || calendarBusy || thresholdSaveBusy) return;
    if (confirmDiscardRoll('sign out') && confirmDiscardCalendar('sign out') && confirmDiscardThreshold('sign out')) onSignOut();
  }

  if (loadState === 'loading') {
    return <LiveShell user={user} onSignOut={handleSafeSignOut}><div className="live-loading"><span className="live-spinner" /> Loading your teacher-owned Firestore workspace…</div></LiveShell>;
  }

  if (loadState === 'error') {
    return (
      <LiveShell user={user} onSignOut={handleSafeSignOut}>
        <section className="live-centered-panel">
          <span className="live-eyebrow">FIRESTORE ACCESS</span>
          <h1>Couldn’t load your class list</h1>
          <p>The teacher sign-in is approved, but the class query failed.</p>
          <Notice tone="error">{error}</Notice>
          <button className="live-primary-button" type="button" onClick={() => window.location.reload()}>Retry</button>
        </section>
      </LiveShell>
    );
  }

  if (!selectedClass) {
    return (
      <LiveShell user={user} onSignOut={handleSafeSignOut} signOutDisabled={classBusy}>
        <section className="live-centered-panel live-setup-panel">
          <span className="live-eyebrow">FIRST-TIME SETUP · NO STUDENT DATA YET</span>
          <h1>Create your class</h1>
          <p>This creates one class record owned by your approved teacher account. No sample students or parent contacts are added.</p>
          <Notice tone="error">{error}</Notice>
          <form className="live-form" onSubmit={handleCreateClass}>
            <label>Class name<input required maxLength={80} value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} placeholder="e.g. B.A. English" /></label>
            <div className="live-form-row">
              <label>Section (optional)<input maxLength={24} value={classForm.section} onChange={(event) => setClassForm({ ...classForm, section: event.target.value })} placeholder="e.g. A" /></label>
              <label>Year / term (optional)<input maxLength={40} value={classForm.yearLabel} onChange={(event) => setClassForm({ ...classForm, yearLabel: event.target.value })} placeholder="e.g. Year II" /></label>
            </div>
            <div className="live-safety-note"><strong>Privacy check:</strong> use this teacher-owned project only for class records approved by the college. Messaging and parent contacts remain disabled.</div>
            <button className="live-primary-button" type="submit" disabled={classBusy || !isOnline}>{classBusy ? 'Creating class…' : isOnline ? 'Create class' : 'Connect to create class'}</button>
          </form>
        </section>
      </LiveShell>
    );
  }

  return (
    <LiveShell user={user} onSignOut={handleSafeSignOut} signOutDisabled={rollBusy || rosterBusy || classBusy || backupBusy || historyBusy || calendarBusy || thresholdSaveBusy}>
      <div className="live-content">
        <div className="live-heading-row">
          <div>
            <span className="live-eyebrow">TEACHER-OWNED FIRESTORE · MESSAGES OFF</span>
            <h1>{selectedClass.name}{selectedClass.section ? ` · Section ${selectedClass.section}` : ''}</h1>
            <p>{selectedClass.yearLabel || 'Class workspace'} · {rosterReady ? activeStudents.length : '…'} active student{rosterReady && activeStudents.length === 1 ? '' : 's'}</p>
          </div>
          <div className="live-heading-actions">
            {classes.length > 1 && <label className="live-class-select"><span>Class</span><select value={selectedClass.id} disabled={rollBusy || backupBusy || historyBusy || calendarBusy || rosterBusy || classBusy || thresholdSaveBusy} onChange={(event) => { const nextId = event.target.value; if (nextId === selectedClass.id || !confirmDiscardRoll('switch classes') || !confirmDiscardCalendar('switch classes') || !confirmDiscardThreshold('switch classes')) return; clearCalendarDrafts(); setBackupConsent(false); setBackupSnapshot(null); setBackupExportedAt(null); setHistoryRecords(null); setHistoryClassId(''); setHistoryLoadedAt(null); setCalendarOverrides(null); setCalendarClassId(''); setCalendarDrafts({}); setClassId(nextId); }}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.section ? ` · ${item.section}` : ''}</option>)}</select></label>}
            <button className={`live-quiet-button${view === 'calendar' ? ' current' : ''}`} type="button" onClick={handleOpenCalendar} disabled={!isOnline || !rosterReady || calendarBusy || historyBusy || rollBusy || backupBusy || rosterBusy || classBusy || thresholdSaveBusy}>Calendar</button>
            <button className={`live-quiet-button${view === 'history' ? ' current' : ''}`} type="button" onClick={handleOpenHistory} disabled={!isOnline || !rosterReady || historyBusy || calendarBusy || rollBusy || backupBusy || rosterBusy || classBusy || thresholdSaveBusy}>{historyBusy ? 'Loading history…' : 'History'}</button>
            <button className={`live-quiet-button${view === 'backup' ? ' current' : ''}`} type="button" onClick={() => { if (!confirmDiscardCalendar('open backup/export')) return; clearCalendarDrafts(); setView('backup'); setError(''); }} disabled={calendarBusy || thresholdSaveBusy}>Backup &amp; export</button>
            <button className={`live-quiet-button${view === 'roster' ? ' current' : ''}`} type="button" onClick={() => { if (!confirmDiscardCalendar('open the roster')) return; clearCalendarDrafts(); setView('roster'); setError(''); }} disabled={calendarBusy || thresholdSaveBusy}>Manage roster</button>
          </div>
        </div>

        <div className="live-safety-strip"><span className="live-safe-dot" /><strong>Live records</strong><span>Saved only after you press Save roll · no automatic parent messages</span></div>
        <Notice tone="error">{error}</Notice>
        <Notice>{notice}</Notice>
        {!isOnline && <Notice tone="error">You’re offline. Attendance marking and Firestore writes are disabled until the connection returns; this app does not queue rolls offline.</Notice>}

        <div className="live-tabs" role="tablist" aria-label="Class workspace sections">
          <button type="button" role="tab" aria-selected={view === 'attendance'} className={view === 'attendance' ? 'active' : ''} onClick={() => { if (!confirmDiscardCalendar('return to attendance')) return; clearCalendarDrafts(); setView('attendance'); setError(''); }} disabled={calendarBusy || thresholdSaveBusy}>Attendance</button>
          <button type="button" role="tab" aria-selected={view === 'roster'} className={view === 'roster' ? 'active' : ''} onClick={() => { if (!confirmDiscardCalendar('open the roster')) return; clearCalendarDrafts(); setView('roster'); setError(''); }} disabled={calendarBusy || thresholdSaveBusy}>Roster <span>{activeStudents.length}</span></button>
        </div>

        {rosterPending ? (
          <section className="live-panel"><div className="live-loading small"><span className="live-spinner" /> Loading this class roster…</div></section>
        ) : rosterFailed ? (
          <section className="live-panel live-empty-roster">
            <span className="live-empty-mark">!</span><h2>Roster unavailable</h2><p>Attendance and import are paused until the selected class roster can be read. Your existing records have not been changed.</p>
            <button className="live-secondary-button" type="button" onClick={() => setRosterLoadVersion((version) => version + 1)}>Retry roster read</button>
          </section>
        ) : view === 'roster' ? (
          <section className="live-panel">
            <div className="live-panel-heading">
              <div><span className="live-eyebrow">STUDENT RECORDS · NO CONTACT FIELDS</span><h2>Class roster</h2><p>Only roll number, student name, and active status are stored here.</p></div>
              <span className="live-count-chip">{activeStudents.length} / 100</span>
            </div>
            {activeStudents.length > 0 && (
              <div className="live-roster-tools">
                <label className="live-search"><span aria-hidden="true">⌕</span><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search by name or roll number" /></label>
              </div>
            )}
            {activeStudents.length > 0 && (
              <div className="live-roster-list">
                <div className="live-roster-header"><span>ROLL</span><span>STUDENT</span><span>STATUS</span></div>
                {visibleStudents.map((student) => (
                  <div className="live-roster-row" key={student.id}>
                    <span className="live-roll-badge">{student.rollNo}</span><strong>{student.displayName}</strong><span className="live-active-label"><i /> Active</span>
                  </div>
                ))}
                {visibleStudents.length === 0 && <p className="live-empty-inline">No roster entries match that search.</p>}
              </div>
            )}
            {activeStudents.length < 100 && (
              <div className="live-import-box">
                <div><h3>{activeStudents.length ? 'Add students' : 'Add the approved roster'}</h3><p>Paste two CSV columns per line: <code>roll number,student name</code>. Do not include phone numbers or other contact details.</p></div>
                <textarea value={rosterText} onChange={(event) => { setRosterText(event.target.value); setRosterRows(null); }} rows={6} placeholder={'01,Student example 01\n02,Student example 02'} aria-label="Roster CSV" />
                <label className="live-consent-check"><input type="checkbox" checked={rosterConsent} onChange={(event) => setRosterConsent(event.target.checked)} /><span>I’m authorized to store these class names in this teacher-owned Firebase project.</span></label>
                <div className="live-actions">
                  <button className="live-secondary-button" type="button" onClick={previewRoster} disabled={!rosterText.trim() || rosterBusy}>Preview import</button>
                  {rosterRows && <button className="live-primary-button" type="button" onClick={handleImportRoster} disabled={!rosterConsent || rosterBusy || backupBusy || historyBusy || calendarBusy || !isOnline}>{rosterBusy ? 'Saving roster…' : `Save ${rosterRows.length} student${rosterRows.length === 1 ? '' : 's'}`}</button>}
                </div>
                {rosterRows && <div className="live-import-preview"><strong>Preview: {rosterRows.length} new record{rosterRows.length === 1 ? '' : 's'}</strong><span>{rosterRows.slice(0, 4).map((row) => `${row.rollNo} · ${row.displayName}`).join('  |  ')}{rosterRows.length > 4 ? '  …' : ''}</span></div>}
              </div>
            )}
          </section>
        ) : view === 'calendar' ? (
          <section className="live-panel live-calendar-panel">
            <div className="live-panel-heading">
              <div><span className="live-eyebrow">EDITABLE CLASS DATA · PUDUCHERRY DEFAULTS</span><h2>College calendar</h2><p>Teacher changes are stored under this class in Firestore.</p></div>
              <div className="live-calendar-year-tools"><button className="live-secondary-button" type="button" onClick={() => changeCalendarYear(-1)} disabled={calendarBusy} aria-label="Previous year">‹</button><strong>{calendarYear}</strong><button className="live-secondary-button" type="button" onClick={() => changeCalendarYear(1)} disabled={calendarBusy} aria-label="Next year">›</button></div>
            </div>
            <div className="live-calendar-content">
              <div className="live-calendar-note"><strong>Editable defaults, not a completed college schedule.</strong> The Puducherry public-holiday dates are starting data; verify them against the college calendar. Dates not listed are not automatically treated as working days. The 75% calculation stays off until term dates, working weekdays and the one-day morning/evening rule are confirmed. <a href={PUDUCHERRY_CALENDAR_SOURCE.primaryUrl} target="_blank" rel="noreferrer">Official 2026 holiday order</a>.</div>
              {calendarYear !== 2026 && <div className="live-empty-inline">Only {PUDUCHERRY_CALENDAR_SOURCE.region} defaults for 2026 are bundled. For {calendarYear}, enter college dates manually until an official list is added.</div>}
              {calendarBusy ? (
                <div className="live-loading small"><span className="live-spinner" /> Loading or saving calendar data…</div>
              ) : calendarOverrides === null || calendarClassId !== selectedClass.id ? (
                <div className="live-empty-inline">Calendar data could not be loaded. Check the connection/rules, then retry.<br /><button className="live-secondary-button" type="button" onClick={handleOpenCalendar} disabled={!isOnline || calendarBusy}>Retry calendar</button></div>
              ) : (
                <>
                  <div className="live-calendar-add">
                    <div><h3>Add a college date</h3><p>Add a college holiday or a special working day; dates are editable class data.</p></div>
                    <div className="live-calendar-add-fields">
                      <label><span>Date</span><input type="date" min={`${calendarYear}-01-01`} max={`${calendarYear}-12-31`} value={calendarNewDate} onChange={(event) => setCalendarNewDate(event.target.value)} disabled={!isOnline || calendarBusy} /></label>
                      <label><span>Type</span><select value={calendarNewKind} onChange={(event) => setCalendarNewKind(event.target.value)} disabled={!isOnline || calendarBusy}><option value="HOLIDAY">Holiday</option><option value="WORKING">Working day</option></select></label>
                      <label className="live-calendar-add-label"><span>Label</span><input maxLength={120} value={calendarNewLabel} onChange={(event) => setCalendarNewLabel(event.target.value)} placeholder="e.g. College holiday" disabled={!isOnline || calendarBusy} /></label>
                      <button className="live-primary-button" type="button" onClick={addCalendarDate} disabled={!isOnline || calendarBusy || !calendarNewDate || !calendarNewLabel.trim() || calendarItems.some((event) => event.dateISO === calendarNewDate)}>Add date</button>
                    </div>
                  </div>
                  {calendarItems.length === 0 ? (
                    <div className="live-empty-roster"><span className="live-empty-mark">—</span><h2>No calendar dates listed for {calendarYear}</h2><p>Add a holiday or a special working day above.</p></div>
                  ) : (
                    <div className="live-calendar-list">
                      {calendarItems.map((event) => {
                        const draft = calendarDraftFor(event);
                        const changed = draft.kind !== event.kind || draft.label !== event.label;
                        return (
                          <article className="live-calendar-row" key={event.dateISO}>
                            <div className="live-calendar-row-heading"><strong>{displayDate(event.dateISO)}</strong><span className={`live-calendar-kind ${draft.kind.toLowerCase()}`}>{draft.kind === 'HOLIDAY' ? 'Holiday' : 'Working day'}</span></div>
                            <div className="live-calendar-source">{event.isOverride ? <span>Teacher {event.defaultKind ? 'override' : 'added date'}{event.sourceUrl ? ' · official default available' : ''}</span> : <span>Official Puducherry default</span>}{event.sourceUrl && <a href={event.sourceUrl} target="_blank" rel="noreferrer">Source</a>}</div>
                            {event.isOverride && event.defaultKind && <div className="live-calendar-baseline">Official default: {event.defaultKind === 'HOLIDAY' ? 'Holiday' : 'Working day'} · {event.defaultLabel}</div>}
                            <div className="live-calendar-edit-fields">
                              <label><span>College status</span><select value={draft.kind} onChange={(change) => updateCalendarDraft(event.dateISO, 'kind', change.target.value, event)} disabled={!isOnline || calendarBusy}><option value="HOLIDAY">Holiday / non-working</option><option value="WORKING">Working day</option></select></label>
                              <label className="live-calendar-edit-label"><span>Label</span><input maxLength={120} value={draft.label} onChange={(change) => updateCalendarDraft(event.dateISO, 'label', change.target.value, event)} disabled={!isOnline || calendarBusy} /></label>
                              <div className="live-calendar-row-actions"><button className="live-primary-button" type="button" onClick={() => saveCalendarDate(event.dateISO, draft.kind, draft.label)} disabled={!isOnline || calendarBusy || !changed || !draft.label.trim()}>{calendarBusy ? 'Saving…' : 'Save'}</button>{event.isOverride && <button className="live-secondary-button" type="button" onClick={() => resetCalendarDate(event.dateISO)} disabled={!isOnline || calendarBusy}>Reset</button>}</div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="live-calendar-foot">Source: {PUDUCHERRY_CALENDAR_SOURCE.title} ({PUDUCHERRY_CALENDAR_SOURCE.region}). Lunar dates can change. This list is not auto-synced; teacher edits are class-specific and can be reset to the bundled default.</div>
                </>
              )}
            </div>
          </section>
        ) : view === 'history' ? (
          <section className="live-panel live-history-panel">
            <div className="live-panel-heading">
              <div><span className="live-eyebrow">SAVED ROLLS · MORNING / EVENING</span><h2>Attendance history</h2><p>Each college day is grouped once, while its saved morning and evening rolls remain visible separately.</p></div>
              <button className="live-secondary-button" type="button" onClick={handleOpenHistory} disabled={!isOnline || !rosterReady || historyBusy || calendarBusy || rollBusy || backupBusy || rosterBusy || classBusy || thresholdSaveBusy}>{historyBusy ? 'Refreshing…' : 'Refresh history'}</button>
            </div>
            <div className="live-history-content">
              <div className="live-history-note"><strong>Teacher-reviewed calculation.</strong> Configure the college’s real term, weekdays, session rule, and leave policy. No percentage is shown unless the calendar is confirmed and every required roll and status is present.</div>
              {historyBusy ? (
                <div className="live-loading small"><span className="live-spinner" /> Loading saved attendance history and calculation settings…</div>
              ) : historyRecords === null || historyClassId !== selectedClass.id ? (
                <div className="live-empty-inline">History could not be loaded. Check the connection/rules, then retry.</div>
              ) : (
                <>
                  <AttendanceThresholdPanel
                    ready={thresholdDataReady}
                    loadError={thresholdLoadError}
                    savedSettings={thresholdSettings}
                    form={thresholdForm}
                    formDirty={thresholdFormDirty}
                    saveBusy={thresholdSaveBusy}
                    canSave={thresholdCanSave}
                    result={attendanceThresholdResult}
                    todayISO={todayISO}
                    onFieldChange={(field, value) => setThresholdForm((current) => ({ ...current, [field]: value }))}
                    onSave={handleSaveAttendanceThreshold}
                    onDiscard={discardAttendanceThresholdEdits}
                  />
                  {historyRecords.length === 0 ? (
                    <div className="live-empty-roster"><span className="live-empty-mark">—</span><h2>No saved attendance rolls yet</h2><p>Once a morning or evening roll is saved, it will appear here by date. Percentage review will remain blocked until the configured tracking period has complete rolls.</p></div>
                  ) : (
                    <div className="live-history-days">
                      {historyGroups.map((day) => (
                        <section className="live-history-day" key={day.dateISO}>
                          <div className="live-history-day-heading"><h3>{displayDate(day.dateISO)}</h3><span className="live-count-chip">{day.rolls.length} roll{day.rolls.length === 1 ? '' : 's'}</span></div>
                          <div className="live-history-rolls">
                            {day.rolls.map((roll) => <HistoryRollCard key={roll.id} roll={roll} students={activeStudents} />)}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
              {historyLoadedAt && <div className="live-backup-foot">Loaded from Firestore {historyLoadedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Refresh to include newer rolls.</div>}
            </div>
          </section>
        ) : view === 'backup' ? (
          <section className="live-panel live-backup-panel">
            <div className="live-panel-heading">
              <div><span className="live-eyebrow">PRIVATE DOWNLOAD · NO CLOUD UPLOAD</span><h2>Export &amp; backup</h2><p>Prepare a snapshot of saved roster, attendance, calendar changes, and percentage settings.</p></div>
              <span className="live-count-chip">{backupSnapshot ? `${backupSnapshot.attendance.length} rolls · ${backupSnapshot.calendar.length} calendar edits · ${backupSnapshot.attendanceThreshold ? '75% rules saved' : 'no 75% rules'}` : `${students.length} students`}</span>
            </div>
            <div className="live-backup-content">
              <div className="live-backup-warning"><strong>Student data leaves the app as a file.</strong><span>Downloads contain names, roll numbers, attendance, teacher calendar overrides, and any saved percentage rules. They are not sent to another service. Store them only in a college-approved, access-controlled location.</span></div>
              <label className="live-consent-check live-backup-consent"><input type="checkbox" checked={backupConsent} onChange={(event) => setBackupConsent(event.target.checked)} /><span>I’m authorized to create and store a local copy of these saved class records.</span></label>
              <div className="live-actions">
                <button className="live-primary-button" type="button" onClick={prepareBackupSnapshot} disabled={!isOnline || !rosterReady || !backupConsent || backupBusy || rollBusy || rosterBusy || classBusy || historyBusy || calendarBusy}>{backupBusy ? 'Preparing snapshot…' : backupSnapshot ? 'Refresh snapshot' : 'Prepare snapshot'}</button>
                {backupSnapshot && backupSnapshot.class.id === selectedClass.id && <>
                  <button className="live-secondary-button" type="button" onClick={downloadAttendanceCsv}>Download attendance CSV</button>
                  <button className="live-secondary-button" type="button" onClick={downloadJsonBackupFile}>Download JSON backup</button>
                </>}
              </div>
              {backupSnapshot && backupExportedAt && <div className="live-import-preview"><strong>Saved-data snapshot ready · {backupSnapshot.students.length} roster records · {backupSnapshot.attendance.length} attendance rolls · {backupSnapshot.calendar.length} calendar edits · {backupSnapshot.attendanceThreshold ? 'percentage rules included' : 'no percentage rules saved'}</strong><span>Prepared {backupExportedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. It includes only records already saved in Firestore.</span></div>}
              <div className="live-backup-foot">The CSV is a spreadsheet-friendly attendance register. The JSON v2 file backs up this class, roster, saved rolls, teacher calendar overrides, and saved percentage rules. Bundled Puducherry defaults are part of the app, not copied into the JSON. Automatic cloud backup and restore are not implemented yet.</div>
              {!isOnline && <Notice tone="error">Reconnect to Firestore before preparing or downloading a fresh snapshot.</Notice>}
            </div>
          </section>
        ) : activeStudents.length === 0 ? (
          <section className="live-panel live-empty-roster">
            <span className="live-empty-mark">＋</span><h2>No students in this class yet</h2><p>Add the approved roster before taking attendance. Nothing will be marked or saved without roster entries.</p>
            <button className="live-primary-button" type="button" onClick={() => setView('roster')}>Set up roster</button>
          </section>
        ) : (
          <>
            <div className="live-controls">
              <div className="live-roll-switch" role="tablist" aria-label="Attendance session">
                {ROLL_TYPES.map((type) => <button key={type} type="button" role="tab" aria-selected={rollType === type} className={rollType === type ? 'active' : ''} disabled={rollBusy || backupBusy || historyBusy || calendarBusy} onClick={() => { if (type === rollType || confirmDiscardRoll('switch attendance sessions')) setRollType(type); }}><span>{type === 'MORNING' ? '☼' : '☾'}</span><strong>{type === 'MORNING' ? 'Morning roll' : 'Evening roll'}</strong></button>)}
              </div>
              <label className="live-date-control"><span>Date</span><input type="date" disabled={rollBusy || backupBusy || historyBusy || calendarBusy} max={todayInChennai()} value={dateISO} onChange={(event) => { if (event.target.value && (event.target.value === dateISO || confirmDiscardRoll('change attendance dates'))) setDateISO(event.target.value); }} /></label>
            </div>

            <section className="live-panel live-attendance-panel">
              <div className="live-panel-heading">
                <div><span className="live-eyebrow">{rollType === 'MORNING' ? 'AM CHECKPOINT' : 'PM CHECKPOINT'} · {displayDate(dateISO)}</span><h2>Mark attendance</h2><p>Review each status. No message will be sent from this workspace.</p></div>
                <button type="button" className="live-secondary-button" onClick={markAllPresent} disabled={!isOnline || !rosterReady || rollBusy || backupBusy || historyBusy || calendarBusy || activeStudents.length === 0}>Mark all present</button>
              </div>
              <div className="live-progress"><span style={{ width: `${activeStudents.length ? (markedCount / activeStudents.length) * 100 : 0}%` }} /></div>
              <div className="live-progress-label"><span>{markedCount} of {activeStudents.length} marked</span><span>{activeStudents.length ? Math.round((markedCount / activeStudents.length) * 100) : 0}%</span></div>
              {rollBusy ? <div className="live-loading small"><span className="live-spinner" /> Loading or saving this roll…</div> : (
                <div className="live-attendance-list">
                  {activeStudents.map((student) => (
                    <div className="live-attendance-row" key={student.id}>
                      <div className="live-student-ident"><span className="live-roll-badge">{student.rollNo}</span><strong>{student.displayName}</strong></div>
                      <div className="live-status-buttons" role="group" aria-label={`Attendance for ${student.displayName}`}>
                        {ATTENDANCE_STATUSES.map((item) => <button key={item.value} type="button" aria-pressed={statuses[student.id] === item.value} className={`live-status-button ${item.value} ${statuses[student.id] === item.value ? 'selected' : ''}`} disabled={!isOnline || backupBusy || historyBusy || calendarBusy} onClick={() => changeStatus(student.id, item.value)}><span>{item.short}</span><em>{item.label}</em></button>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="live-save-footer">
                <div className="live-save-caption">{rollSavedAt && !rollDirty ? `Saved to Firestore${rollSavedAt instanceof Date ? ` · ${rollSavedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}` : rollDirty ? 'Unsaved changes on this screen' : isComplete ? 'Ready to save this roll' : `Mark ${counts.unmarked} more before saving`}</div>
                <div className="live-save-actions"><button className="live-secondary-button" type="button" onClick={() => setParentReviewOpen(true)} disabled={!canReviewParentDrafts} title={!canReviewParentDrafts ? 'Save a complete roll before reviewing message drafts' : 'Preview unsent messages for students marked absent'}>Review parent drafts</button><button className="live-primary-button" type="button" onClick={handleSaveRoll} disabled={!isOnline || !isComplete || !rollDirty || rollBusy || backupBusy || historyBusy || calendarBusy}>{rollBusy ? 'Saving…' : 'Save roll'}</button></div>
              </div>
            </section>

            <div className="live-privacy-foot"><span>●</span> Attendance is stored under this class in Firestore. Parent messaging remains disabled.</div>
          </>
        )}
      </div>
      {parentReviewOpen && <ParentMessageReview absentStudents={absentStudents} leaveCount={leaveCount} dateISO={dateISO} rollType={rollType} onClose={() => setParentReviewOpen(false)} />}
    </LiveShell>
  );
}
