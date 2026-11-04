import React, { useEffect, useMemo, useState } from 'react';
import PwaInstallButton from './PwaInstallButton.jsx';
import {
  createTeacherClass,
  importClassStudents,
  listClassStudents,
  listTeacherClasses,
  loadAttendance,
  saveAttendance,
} from './lib/firestoreRepository.js';
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

function displayDate(dateISO) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  }).format(new Date(`${dateISO}T12:00:00Z`));
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
  const visibleStudents = activeStudents.filter((student) => {
    const query = studentSearch.trim().toLocaleLowerCase('en-IN');
    return !query || String(student.rollNo).toLocaleLowerCase('en-IN').includes(query)
      || String(student.displayName).toLocaleLowerCase('en-IN').includes(query);
  });

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
    if (!isOnline || !selectedClass || !rosterReady || !rosterRows || !rosterConsent || rollBusy || rosterBusy) return;
    if (!confirmDiscardRoll('import a roster')) return;
    const targetClassId = selectedClass.id;
    const importedCount = rosterRows.length;
    setRosterBusy(true);
    setError('');
    try {
      await importClassStudents(targetClassId, rosterRows);
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
    if (!isOnline) return;
    setStatuses((current) => ({ ...current, [studentId]: status }));
    setRollDirty(true);
    setError('');
  }

  function markAllPresent() {
    if (!isOnline) return;
    setStatuses(Object.fromEntries(activeStudents.map((student) => [student.id, 'present'])));
    setRollDirty(true);
    setError('');
  }

  async function handleSaveRoll() {
    if (!isOnline || !selectedClass || !rosterReady || !isComplete || rollBusy) return;
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
      setNotice(`${rollType === 'MORNING' ? 'Morning' : 'Evening'} roll saved to Firestore.`);
    } catch (reason) {
      setError(friendlyFirestoreError(reason));
    } finally {
      setRollBusy(false);
    }
  }

  function confirmDiscardRoll(action) {
    if (!rollDirty) return true;
    return window.confirm(`You have unsaved attendance changes. Continuing to ${action} will discard them. Continue?`);
  }

  function handleSafeSignOut() {
    if (rollBusy || rosterBusy || classBusy) return;
    if (confirmDiscardRoll('sign out')) onSignOut();
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
    <LiveShell user={user} onSignOut={handleSafeSignOut} signOutDisabled={rollBusy || rosterBusy || classBusy}>
      <div className="live-content">
        <div className="live-heading-row">
          <div>
            <span className="live-eyebrow">TEACHER-OWNED FIRESTORE · MESSAGES OFF</span>
            <h1>{selectedClass.name}{selectedClass.section ? ` · Section ${selectedClass.section}` : ''}</h1>
            <p>{selectedClass.yearLabel || 'Class workspace'} · {rosterReady ? activeStudents.length : '…'} active student{rosterReady && activeStudents.length === 1 ? '' : 's'}</p>
          </div>
          <div className="live-heading-actions">
            {classes.length > 1 && <label className="live-class-select"><span>Class</span><select value={selectedClass.id} disabled={rollBusy} onChange={(event) => { const nextId = event.target.value; if (nextId === selectedClass.id || confirmDiscardRoll('switch classes')) setClassId(nextId); }}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.section ? ` · ${item.section}` : ''}</option>)}</select></label>}
            <button className="live-quiet-button" type="button" onClick={() => { setView('roster'); setError(''); }}>Manage roster</button>
          </div>
        </div>

        <div className="live-safety-strip"><span className="live-safe-dot" /><strong>Live records</strong><span>Saved only after you press Save roll · no automatic parent messages</span></div>
        <Notice tone="error">{error}</Notice>
        <Notice>{notice}</Notice>
        {!isOnline && <Notice tone="error">You’re offline. Attendance marking and Firestore writes are disabled until the connection returns; this app does not queue rolls offline.</Notice>}

        <div className="live-tabs" role="tablist" aria-label="Class workspace sections">
          <button type="button" role="tab" aria-selected={view === 'attendance'} className={view === 'attendance' ? 'active' : ''} onClick={() => { setView('attendance'); setError(''); }}>Attendance</button>
          <button type="button" role="tab" aria-selected={view === 'roster'} className={view === 'roster' ? 'active' : ''} onClick={() => { setView('roster'); setError(''); }}>Roster <span>{activeStudents.length}</span></button>
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
                  {rosterRows && <button className="live-primary-button" type="button" onClick={handleImportRoster} disabled={!rosterConsent || rosterBusy || !isOnline}>{rosterBusy ? 'Saving roster…' : `Save ${rosterRows.length} student${rosterRows.length === 1 ? '' : 's'}`}</button>}
                </div>
                {rosterRows && <div className="live-import-preview"><strong>Preview: {rosterRows.length} new record{rosterRows.length === 1 ? '' : 's'}</strong><span>{rosterRows.slice(0, 4).map((row) => `${row.rollNo} · ${row.displayName}`).join('  |  ')}{rosterRows.length > 4 ? '  …' : ''}</span></div>}
              </div>
            )}
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
                {ROLL_TYPES.map((type) => <button key={type} type="button" role="tab" aria-selected={rollType === type} className={rollType === type ? 'active' : ''} disabled={rollBusy} onClick={() => { if (type === rollType || confirmDiscardRoll('switch attendance sessions')) setRollType(type); }}><span>{type === 'MORNING' ? '☼' : '☾'}</span><strong>{type === 'MORNING' ? 'Morning roll' : 'Evening roll'}</strong></button>)}
              </div>
              <label className="live-date-control"><span>Date</span><input type="date" disabled={rollBusy} max={todayInChennai()} value={dateISO} onChange={(event) => { if (event.target.value && (event.target.value === dateISO || confirmDiscardRoll('change attendance dates'))) setDateISO(event.target.value); }} /></label>
            </div>

            <section className="live-panel live-attendance-panel">
              <div className="live-panel-heading">
                <div><span className="live-eyebrow">{rollType === 'MORNING' ? 'AM CHECKPOINT' : 'PM CHECKPOINT'} · {displayDate(dateISO)}</span><h2>Mark attendance</h2><p>Review each status. No message will be sent from this workspace.</p></div>
                <button type="button" className="live-secondary-button" onClick={markAllPresent} disabled={!isOnline || !rosterReady || rollBusy || activeStudents.length === 0}>Mark all present</button>
              </div>
              <div className="live-progress"><span style={{ width: `${activeStudents.length ? (markedCount / activeStudents.length) * 100 : 0}%` }} /></div>
              <div className="live-progress-label"><span>{markedCount} of {activeStudents.length} marked</span><span>{activeStudents.length ? Math.round((markedCount / activeStudents.length) * 100) : 0}%</span></div>
              {rollBusy ? <div className="live-loading small"><span className="live-spinner" /> Loading or saving this roll…</div> : (
                <div className="live-attendance-list">
                  {activeStudents.map((student) => (
                    <div className="live-attendance-row" key={student.id}>
                      <div className="live-student-ident"><span className="live-roll-badge">{student.rollNo}</span><strong>{student.displayName}</strong></div>
                      <div className="live-status-buttons" role="group" aria-label={`Attendance for ${student.displayName}`}>
                        {ATTENDANCE_STATUSES.map((item) => <button key={item.value} type="button" aria-pressed={statuses[student.id] === item.value} className={`live-status-button ${item.value} ${statuses[student.id] === item.value ? 'selected' : ''}`} disabled={!isOnline} onClick={() => changeStatus(student.id, item.value)}><span>{item.short}</span><em>{item.label}</em></button>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="live-save-footer">
                <div className="live-save-caption">{rollSavedAt && !rollDirty ? `Saved to Firestore${rollSavedAt instanceof Date ? ` · ${rollSavedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}` : rollDirty ? 'Unsaved changes on this screen' : isComplete ? 'Ready to save this roll' : `Mark ${counts.unmarked} more before saving`}</div>
                <button className="live-primary-button" type="button" onClick={handleSaveRoll} disabled={!isOnline || !isComplete || !rollDirty || rollBusy}>{rollBusy ? 'Saving…' : 'Save roll'}</button>
              </div>
            </section>

            <div className="live-privacy-foot"><span>●</span> Attendance is stored under this class in Firestore. Parent messaging remains disabled.</div>
          </>
        )}
      </div>
    </LiveShell>
  );
}
