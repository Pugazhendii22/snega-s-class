import React, { useEffect, useMemo, useState } from 'react';
import { DEMO_STUDENTS } from './data/demoRoster.js';
import { emptyRoll, readDemoRolls, rollKey, writeDemoRolls } from './lib/demoStorage.js';
import { renderParentMessage } from '../shared/messages.js';

const NAV_ITEMS = [
  { id: 'roll', label: 'Attendance', icon: 'grid' },
  { id: 'students', label: 'Students', icon: 'users' },
  { id: 'insights', label: 'Insights', icon: 'chart' },
  { id: 'safety', label: 'Safety centre', icon: 'shield' },
];

const STATUS_ORDER = ['present', 'absent', 'leave'];

function todayInChennai() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function shiftDate(dateISO, offset) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function prettyDate(dateISO, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'Asia/Kolkata' })
    .format(new Date(`${dateISO}T12:00:00Z`));
}

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const content = {
    grid: <><rect x="3.3" y="3.3" width="7.2" height="7.2" rx="1.8" /><rect x="13.5" y="3.3" width="7.2" height="7.2" rx="1.8" /><rect x="3.3" y="13.5" width="7.2" height="7.2" rx="1.8" /><rect x="13.5" y="13.5" width="7.2" height="7.2" rx="1.8" /></>,
    users: <><path d="M16 20v-1.7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="3.4" /><path d="M17 11a3.2 3.2 0 1 0-1.2-6.2M21 20v-1.7a4 4 0 0 0-2.8-3.8" /></>,
    chart: <><path d="M4 19.5h16" /><path d="M6.5 16V11" /><path d="M12 16V5" /><path d="M17.5 16V8" /></>,
    shield: <><path d="M12 3 19 6v5.2c0 4.3-2.8 7.6-7 9.8-4.2-2.2-7-5.5-7-9.8V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    left: <><path d="m14.5 18-6-6 6-6" /></>,
    right: <><path d="m9.5 18 6-6-6-6" /></>,
    calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M7.5 3v4M16.5 3v4M3.5 9h17" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4.5 4.5" /></>,
    check: <><path d="m5 12.5 4.2 4.2L19.5 6.8" /></>,
    cross: <><path d="m6 6 12 12M18 6 6 18" /></>,
    leave: <><path d="M4 12h13" /><path d="m13 7 5 5-5 5" /><path d="M20 5v14" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    alert: <><path d="M12 3.5 21 20H3l9-16.5Z" /><path d="M12 9v4.5M12 17h.01" /></>,
    lock: <><rect x="4.5" y="10" width="15" height="10.5" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    leaf: <><path d="M20 4c-8 0-14 3.8-14 10a6 6 0 0 0 6 6c6.2 0 8-7.2 8-16Z" /><path d="M4 21c2.5-4.5 6-7.4 11-10" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>{content[name] || content.info}</svg>;
}

function StatusPill({ status }) {
  if (status === 'present') return <span className="status-pill present"><span className="status-dot" />Present</span>;
  if (status === 'absent') return <span className="status-pill absent"><span className="status-dot" />Absent</span>;
  if (status === 'leave') return <span className="status-pill leave"><span className="status-dot" />On leave</span>;
  return <span className="status-pill unmarked"><span className="status-dot" />Not marked</span>;
}

function RosterRow({ student, status, onChange }) {
  return (
    <div className={`roster-row ${status !== 'unmarked' ? `row-${status}` : ''}`}>
      <div className="student-identity">
        <div className="student-avatar">{student.rollNo}</div>
        <div className="student-name-wrap">
          <div className="student-name-line">
            <span className="student-name">{student.label}</span>
            <span className="student-roll">Roll {student.rollNo}</span>
          </div>
          <div className="student-subline">
            <span className="attendance-mini" title={`Historical attendance ${student.attendancePct}%`}>
              <span className="attendance-mini-track"><span style={{ width: `${student.attendancePct}%` }} /></span>
              <span>{student.attendancePct}% attendance</span>
            </span>
            {student.attendancePct < 75 && <span className="risk-tag">Below 75%</span>}
          </div>
        </div>
      </div>
      <div className="mark-controls" role="group" aria-label={`Attendance for ${student.label}`}>
        {STATUS_ORDER.map((value) => (
          <button
            key={value}
            type="button"
            className={`mark-button mark-${value} ${status === value ? 'selected' : ''}`}
            onClick={() => onChange(student.id, value)}
            aria-pressed={status === value}
            aria-label={`${value === 'leave' ? 'Mark on approved leave' : `Mark ${value}`} for ${student.label}`}
            title={value === 'leave' ? 'Approved leave — suppress parent absence draft' : `Mark ${value}`}
          >
            <span className="mark-letter">{value === 'present' ? 'P' : value === 'absent' ? 'A' : 'L'}</span>
            <span className="mark-word">{value === 'leave' ? 'Leave' : value[0].toUpperCase() + value.slice(1)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ParentPreviewModal({ open, onClose, absentStudents, leaveCount, dateISO, rollType, language, onLanguage, onToast }) {
  const [selectedId, setSelectedId] = useState(absentStudents[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const activeStudent = absentStudents.find((student) => student.id === selectedId) ?? absentStudents[0] ?? null;

  useEffect(() => {
    if (!open || !activeStudent) return undefined;
    const controller = new AbortController();
    const payload = {
      studentLabel: activeStudent.label,
      rollNo: activeStudent.rollNo,
      rollType,
      dateISO,
      language,
    };
    setLoading(true);
    setDraft('');

    fetch('/api/messages/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Preview unavailable');
        return result.draft;
      })
      .then((message) => setDraft(message))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        // Local fallback lets the teacher inspect the draft during a temporary API outage.
        try { setDraft(renderParentMessage(payload)); } catch { setDraft('Preview could not be created.'); }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open, activeStudent?.id, dateISO, rollType, language]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      onToast('Draft copied. Nothing was sent.');
    } catch {
      onToast('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="modal-header">
          <div>
            <div className="micro-label"><Icon name="shield" size={14} /> HUMAN REVIEW · NO SEND</div>
            <h2 id="review-title">Review parent drafts</h2>
            <p>Check the roll and wording before any future Stage 0 send.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close review" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="review-safety-note">
          <Icon name="lock" size={17} />
          <span><strong>Demo only.</strong> There are no parent contacts and this build has no message-send capability.</span>
        </div>

        {absentStudents.length === 0 ? (
          <div className="empty-review">
            <div className="empty-review-icon"><Icon name="check" size={24} /></div>
            <h3>No absence drafts</h3>
            <p>{leaveCount > 0 ? `${leaveCount} student${leaveCount === 1 ? '' : 's'} marked on leave are excluded from absence drafts.` : 'No students were marked absent in this saved roll.'}</p>
          </div>
        ) : (
          <div className="review-body">
            <aside className="draft-list" aria-label="Students with draft messages">
              <div className="draft-list-heading">ABSENT · {absentStudents.length}</div>
              {absentStudents.map((student) => (
                <button
                  type="button"
                  key={student.id}
                  className={`draft-student ${activeStudent?.id === student.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(student.id)}
                >
                  <span className="student-avatar small">{student.rollNo}</span>
                  <span><strong>{student.label}</strong><small>Roll {student.rollNo}</small></span>
                  <Icon name="right" size={16} />
                </button>
              ))}
            </aside>
            <div className="draft-preview-wrap">
              <div className="draft-preview-top">
                <div>
                  <span className="micro-label">MESSAGE PREVIEW</span>
                  <h3>{activeStudent?.label ?? 'No student selected'}</h3>
                </div>
                <div className="language-toggle" role="group" aria-label="Preview language">
                  <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onLanguage('en')}>EN</button>
                  <button type="button" className={language === 'ta' ? 'active' : ''} onClick={() => onLanguage('ta')}>தமிழ்</button>
                </div>
              </div>
              <div className="message-paper" aria-live="polite">
                {loading ? <div className="draft-loading"><span className="spinner" /> Preparing preview…</div> : draft}
              </div>
              {language === 'ta' && <p className="translation-note"><Icon name="info" size={14} /> Tamil wording is a draft; a native speaker must review it before live use.</p>}
              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={copyDraft} disabled={!draft || loading}><Icon name="copy" size={16} /> Copy draft</button>
                <button type="button" className="button button-disabled" disabled title="No parent contacts, consent records, or send capability are configured"><span className="whatsapp-mark">◉</span> WhatsApp not connected</button>
              </div>
            </div>
          </div>
        )}
        <div className="modal-footer"><span><Icon name="clock" size={14} /> {prettyDate(dateISO, { day: 'numeric', month: 'short', year: 'numeric' })} · {rollType === 'MORNING' ? 'Morning' : 'Evening'} roll</span><button type="button" className="text-button" onClick={onClose}>Done</button></div>
      </section>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, right }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {right && <div className="heading-actions">{right}</div>}
    </div>
  );
}

export function DemoApp() {
  const today = useMemo(() => todayInChennai(), []);
  const [view, setView] = useState('roll');
  const [dateISO, setDateISO] = useState(today);
  const [rollType, setRollType] = useState('MORNING');
  const [records, setRecords] = useState(() => readDemoRolls());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [messageLanguage, setMessageLanguage] = useState('en');
  const [search, setSearch] = useState('');
  const [apiOnline, setApiOnline] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const ok = writeDemoRolls(records);
    if (!ok) setToast('Local storage is unavailable. Keep this demo tab open while testing.');
  }, [records]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('API unavailable')))
      .then((payload) => setApiOnline(payload.ok === true && payload.messagingEnabled === false))
      .catch(() => setApiOnline(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const key = rollKey(dateISO, rollType);
  const currentRecord = records[key] ?? emptyRoll(DEMO_STUDENTS);
  const statuses = currentRecord.statuses ?? emptyRoll(DEMO_STUDENTS).statuses;
  const counts = useMemo(() => {
    const value = { present: 0, absent: 0, leave: 0, unmarked: 0 };
    for (const student of DEMO_STUDENTS) value[statuses[student.id] ?? 'unmarked'] += 1;
    return value;
  }, [statuses]);
  const markedCount = DEMO_STUDENTS.length - counts.unmarked;
  const complete = markedCount === DEMO_STUDENTS.length;
  const absentStudents = DEMO_STUDENTS.filter((student) => statuses[student.id] === 'absent');
  const atRiskStudents = DEMO_STUDENTS.filter((student) => student.attendancePct < 75).sort((a, b) => a.attendancePct - b.attendancePct);
  const classAverage = Math.round(DEMO_STUDENTS.reduce((sum, student) => sum + student.attendancePct, 0) / DEMO_STUDENTS.length);
  const progress = Math.round((markedCount / DEMO_STUDENTS.length) * 100);

  function updateStudentStatus(studentId, status) {
    setRecords((previous) => {
      const base = previous[key] ?? emptyRoll(DEMO_STUDENTS);
      return {
        ...previous,
        [key]: { ...base, statuses: { ...base.statuses, [studentId]: status }, dirty: true },
      };
    });
  }

  function markAllPresent() {
    setRecords((previous) => {
      const base = previous[key] ?? emptyRoll(DEMO_STUDENTS);
      return {
        ...previous,
        [key]: {
          ...base,
          statuses: Object.fromEntries(DEMO_STUDENTS.map((student) => [student.id, 'present'])),
          dirty: true,
        },
      };
    });
    setToast('All 60 marked present. Review any exceptions before saving.');
  }

  function saveRoll() {
    if (!complete) {
      setToast(`Mark all ${DEMO_STUDENTS.length} students before saving (${markedCount} marked).`);
      return;
    }
    setRecords((previous) => {
      const base = previous[key] ?? emptyRoll(DEMO_STUDENTS);
      return { ...previous, [key]: { ...base, savedAt: new Date().toISOString(), dirty: false } };
    });
    setToast(`Demo ${rollType === 'MORNING' ? 'morning' : 'evening'} roll saved on this device.`);
  }

  function openReview() {
    if (!currentRecord.savedAt || currentRecord.dirty) {
      setToast('Save a complete roll before reviewing parent drafts.');
      return;
    }
    setReviewOpen(true);
  }

  const filteredStudents = DEMO_STUDENTS.filter((student) => {
    const query = search.trim().toLowerCase();
    return !query || student.label.toLowerCase().includes(query) || student.rollNo.includes(query);
  });

  const pageTitle = {
    roll: ['CLASSROOM · DAILY WORK', 'Attendance', 'Take a careful roll. Review every exception before anything reaches a parent.'],
    students: ['CLASSROOM · ROSTER', 'Students', 'A demo roster with synthetic IDs only. Real student data is not loaded.'],
    insights: ['CLASSROOM · ATTENDANCE HEALTH', 'Attendance insights', 'A simple early-warning view against the 75% threshold. Demo figures only.'],
    safety: ['CLASSROOM · TRUST & PRIVACY', 'Safety centre', 'The message pathway stays closed until each real-world safety gate is met.'],
  }[view];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-symbol"><span /><span /><span /><span /></div>
          <div className="brand-name"><strong>namma</strong><span>class</span></div>
        </div>

        <div className="side-section-label">YOUR CLASS</div>
        <button type="button" className="class-switcher" onClick={() => setView('roll')}>
          <span className="class-avatar">A</span>
          <span className="class-switch-copy"><strong>Demo · Section A</strong><small>Year II · 60 students</small></span>
          <span className="switch-caret">⌄</span>
        </button>

        <div className="side-section-label nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button type="button" key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.id === 'safety' && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="sidebar-note-icon"><Icon name="leaf" size={17} /></div>
          <div><strong>Care first</strong><p>Attendance is a record, not a judgement.</p></div>
        </div>
        <div className="teacher-profile">
          <div className="teacher-avatar">T</div>
          <div className="teacher-profile-text"><strong>Teacher workspace</strong><span>Demo account · no login</span></div>
          <button type="button" className="more-button" aria-label="More options">···</button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-breadcrumb"><span>CLASSROOM</span><span className="breadcrumb-separator">/</span><strong>{NAV_ITEMS.find((item) => item.id === view)?.label.toUpperCase()}</strong></div>
          <div className="topbar-right">
            <span className="demo-chip"><span className="demo-pulse" />DEMO MODE</span>
            <span className={`api-chip ${apiOnline ? 'online' : 'offline'}`} title={apiOnline ? 'Local preview API connected; send capability is off' : 'Local API not detected'}><span />{apiOnline ? 'LOCAL API READY' : 'API OFFLINE'}</span>
            <div className="topbar-avatar" title="Teacher-only workspace">T</div>
          </div>
        </header>

        <div className="page-content">
          <PageHeading eyebrow={pageTitle[0]} title={pageTitle[1]} description={pageTitle[2]} />

          {view === 'roll' && (
            <>
              <div className="roll-toolbar">
                <div className="roll-mode-tabs" role="tablist" aria-label="Attendance roll time">
                  <button type="button" role="tab" aria-selected={rollType === 'MORNING'} className={rollType === 'MORNING' ? 'active' : ''} onClick={() => setRollType('MORNING')}>
                    <span className="time-glyph morning-glyph">☼</span><span><strong>Morning roll</strong><small>First checkpoint</small></span>
                  </button>
                  <button type="button" role="tab" aria-selected={rollType === 'EVENING'} className={rollType === 'EVENING' ? 'active' : ''} onClick={() => setRollType('EVENING')}>
                    <span className="time-glyph evening-glyph">☾</span><span><strong>Evening roll</strong><small>Second checkpoint</small></span>
                  </button>
                </div>
                <div className="date-navigator">
                  <button type="button" className="date-arrow" aria-label="Previous day" onClick={() => setDateISO((value) => shiftDate(value, -1))}><Icon name="left" size={16} /></button>
                  <label className="date-label">
                    <Icon name="calendar" size={16} />
                    <span>{prettyDate(dateISO, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <input aria-label="Choose attendance date" type="date" value={dateISO} max={today} onChange={(event) => event.target.value && setDateISO(event.target.value)} />
                  </label>
                  <button type="button" className="date-arrow" aria-label="Next day" disabled={dateISO >= today} onClick={() => setDateISO((value) => shiftDate(value, 1))}><Icon name="right" size={16} /></button>
                </div>
              </div>

              <div className="safety-banner">
                <div className="safety-banner-mark"><Icon name="shield" size={18} /></div>
                <div className="safety-banner-copy"><strong>Safe demo mode is on</strong><span>60 synthetic students · no parent numbers · no messages can be sent</span></div>
                <span className="safety-banner-status"><Icon name="lock" size={14} /> SENDING OFF</span>
              </div>

              <div className="roll-layout">
                <section className="panel roster-panel">
                  <div className="panel-heading">
                    <div>
                      <div className="micro-label">{rollType === 'MORNING' ? 'AM CHECKPOINT' : 'PM CHECKPOINT'} <span className="mini-live-dot" /></div>
                      <h2>Mark the roll</h2>
                      <p>Tap a status for each student. Leave is excluded from parent drafts.</p>
                    </div>
                    <button type="button" className="button button-soft mark-all" onClick={markAllPresent}><Icon name="check" size={15} /> Mark all present</button>
                  </div>

                  <div className="progress-block">
                    <div className="progress-caption"><span><strong>{markedCount}</strong> of {DEMO_STUDENTS.length} marked</span><span>{progress}% complete</span></div>
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                  </div>

                  <div className="roster-list-head"><span>CLASS ROSTER <b>{DEMO_STUDENTS.length}</b></span><span className="roster-key"><i className="key-present" /> Present <i className="key-absent" /> Absent <i className="key-leave" /> Leave</span></div>
                  <div className="roster-list">
                    {DEMO_STUDENTS.map((student) => (
                      <RosterRow key={student.id} student={student} status={statuses[student.id] ?? 'unmarked'} onChange={updateStudentStatus} />
                    ))}
                  </div>
                  <div className="roster-footer">
                    <div className="footer-save-status">
                      {currentRecord.savedAt && !currentRecord.dirty ? <><span className="saved-check"><Icon name="check" size={13} /></span><span>Saved locally · {new Date(currentRecord.savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></> : <><span className="save-dot" /><span>{complete ? 'Ready to save on this device' : `Mark ${counts.unmarked} more to complete the roll`}</span></>}
                    </div>
                    <div className="footer-buttons">
                      <button type="button" className="button button-secondary" disabled={!currentRecord.savedAt || currentRecord.dirty} onClick={openReview}><Icon name="shield" size={15} /> Review drafts {absentStudents.length > 0 && <span className="button-count">{absentStudents.length}</span>}</button>
                      <button type="button" className="button button-primary" disabled={!complete} onClick={saveRoll}><Icon name="check" size={16} /> {currentRecord.savedAt && !currentRecord.dirty ? 'Saved' : 'Save roll'}</button>
                    </div>
                  </div>
                </section>

                <aside className="roll-sidebar">
                  <section className="panel snapshot-panel">
                    <div className="snapshot-topline"><span className="micro-label">TODAY AT A GLANCE</span><span className="snapshot-date">{prettyDate(dateISO, { day: 'numeric', month: 'short' })}</span></div>
                    <div className="snapshot-main">
                      <div className="attendance-ring" style={{ '--ring-value': `${Math.round((counts.present / DEMO_STUDENTS.length) * 100)}%` }}><div><strong>{Math.round((counts.present / DEMO_STUDENTS.length) * 100)}%</strong><span>present</span></div></div>
                      <div className="snapshot-counts">
                        <div><span className="count-dot present-dot" />Present<strong>{counts.present}</strong></div>
                        <div><span className="count-dot absent-dot" />Absent<strong>{counts.absent}</strong></div>
                        <div><span className="count-dot leave-dot" />On leave<strong>{counts.leave}</strong></div>
                      </div>
                    </div>
                    <div className="snapshot-foot"><span>Historical class average</span><strong>{classAverage}%</strong></div>
                  </section>

                  <section className="panel parent-drafts-panel">
                    <div className="drafts-icon"><Icon name="shield" size={18} /></div>
                    <div className="drafts-content">
                      <div className="drafts-status">HUMAN REVIEW ONLY</div>
                      <h3>{absentStudents.length > 0 ? `${absentStudents.length} draft${absentStudents.length === 1 ? '' : 's'} to review` : 'Parent drafts'}</h3>
                      <p>{absentStudents.length > 0 ? 'Factual previews for absences in this roll. Approved leave is excluded.' : 'Mark a student absent to create a review-only preview.'}</p>
                    </div>
                    {currentRecord.savedAt && !currentRecord.dirty ? (
                      <button type="button" className="button button-draft" onClick={openReview}>Open review <Icon name="right" size={15} /></button>
                    ) : (
                      <div className="drafts-locked"><Icon name="lock" size={14} /> Save a complete roll to unlock review</div>
                    )}
                    <div className="no-send-note"><span /> No WhatsApp or SMS connection in demo</div>
                  </section>

                  <section className="panel threshold-panel">
                    <div className="threshold-heading"><div className="threshold-icon"><Icon name="alert" size={17} /></div><div><span className="micro-label">ATTENDANCE WATCH</span><h3>Below 75% threshold</h3></div></div>
                    <div className="threshold-number"><strong>{atRiskStudents.length}</strong><span>students to review</span></div>
                    <p>Based on synthetic historical attendance. This is a prompt for teacher review, not an automatic parent alert.</p>
                    <button type="button" className="text-link" onClick={() => setView('insights')}>View attendance insights <Icon name="right" size={15} /></button>
                  </section>

                  <div className="offline-hint"><Icon name="info" size={15} /><span>Demo marks stay in this browser only. No cloud sync is configured.</span></div>
                </aside>
              </div>
            </>
          )}

          {view === 'students' && (
            <section className="panel directory-panel">
              <div className="directory-toolbar">
                <div><div className="micro-label">SYNTHETIC DATA ONLY</div><h2>Class roster <span className="subtle-count">60</span></h2><p>Student names and parent contacts are intentionally not present in this demo.</p></div>
                <label className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search roll number" aria-label="Search roster" /><kbd>⌘ K</kbd></label>
              </div>
              <div className="directory-table-head"><span>STUDENT</span><span>HISTORICAL ATTENDANCE</span><span>STATUS</span></div>
              <div className="directory-list">
                {filteredStudents.map((student) => (
                  <div className="directory-row" key={student.id}>
                    <div className="student-identity"><div className="student-avatar">{student.rollNo}</div><div><div className="student-name-line"><span className="student-name">{student.label}</span><span className="student-roll">Roll {student.rollNo}</span></div><div className="directory-muted">Demo identifier · no contact details</div></div></div>
                    <div className="directory-progress"><div className="attendance-mini-track wide"><span className={student.attendancePct < 75 ? 'low' : ''} style={{ width: `${student.attendancePct}%` }} /></div><strong className={student.attendancePct < 75 ? 'risk-text' : ''}>{student.attendancePct}%</strong></div>
                    <div>{student.attendancePct < 75 ? <span className="status-pill absent"><span className="status-dot" />Below 75%</span> : <span className="status-pill present"><span className="status-dot" />On track</span>}</div>
                  </div>
                ))}
                {filteredStudents.length === 0 && <div className="empty-search">No demo roll number matches “{search}”.</div>}
              </div>
              <div className="directory-footer"><Icon name="info" size={15} /> This roster is generated in code and is not connected to a real class.</div>
            </section>
          )}

          {view === 'insights' && (
            <div className="insights-layout">
              <section className="panel insights-summary">
                <div className="insight-kicker"><Icon name="chart" size={16} /> DEMO ATTENDANCE SUMMARY</div>
                <div className="insights-numbers">
                  <div><span>Class average</span><strong>{classAverage}<small>%</small></strong><em>Historical demo figure</em></div>
                  <div><span>Below 75%</span><strong className="risk-text">{atRiskStudents.length}</strong><em>Teacher review recommended</em></div>
                  <div><span>Class strength</span><strong>60</strong><em>Synthetic roster only</em></div>
                </div>
                <div className="insight-callout"><Icon name="info" size={17} /><span>Thresholds are prompts for a teacher to review. Do not use this demo data to contact students or parents.</span></div>
              </section>
              <section className="panel risk-list-panel">
                <div className="panel-heading compact"><div><div className="micro-label">EARLY REVIEW LIST</div><h2>Under 75%</h2><p>Sorted from lowest historical attendance.</p></div><span className="risk-count-badge">{atRiskStudents.length} students</span></div>
                <div className="risk-list">
                  {atRiskStudents.map((student, index) => (
                    <div className="risk-row" key={student.id}>
                      <span className="risk-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div className="student-avatar small">{student.rollNo}</div>
                      <div className="risk-student-copy"><strong>{student.label}</strong><span>Roll {student.rollNo} · synthetic record</span></div>
                      <div className="risk-progress"><div className="attendance-mini-track wide"><span className="low" style={{ width: `${student.attendancePct}%` }} /></div><strong>{student.attendancePct}%</strong></div>
                    </div>
                  ))}
                </div>
                <div className="risk-footer"><Icon name="shield" size={15} /> No automatic warnings or parent alerts are sent from this screen.</div>
              </section>
            </div>
          )}

          {view === 'safety' && (
            <div className="safety-layout">
              <section className="panel safety-hero">
                <div className="safety-hero-mark"><Icon name="shield" size={27} /></div>
                <div><div className="micro-label">CURRENT OPERATING MODE</div><h2>Messages are switched off</h2><p>This first slice has no send endpoint. Nothing here can contact a parent, student, or college.</p></div>
                <div className="switch-off"><span />OFF</div>
              </section>
              <section className="panel readiness-panel">
                <div className="panel-heading compact"><div><div className="micro-label">BEFORE ANY REAL DATA</div><h2>Readiness gates</h2><p>Every item below must be completed before a live pilot.</p></div><span className="gates-badge">0 / 5 READY</span></div>
                <div className="gate-list">
                  {[
                    ['Firebase project owned by the teacher', 'Not connected', 'cloud'],
                    ['Teacher-only authentication and approved account', 'Not configured', 'lock'],
                    ['Written consent + verified guardian contacts', 'No real contacts stored', 'users'],
                    ['Silent pilot, dedupe, and panic switch verified', 'Not run', 'shield'],
                    ['Native-speaker review of Tamil templates', 'Draft only', 'info'],
                  ].map(([title, detail, icon]) => (
                    <div className="gate-row" key={title}><span className="gate-icon"><Icon name={icon === 'cloud' ? 'grid' : icon} size={17} /></span><div className="gate-copy"><strong>{title}</strong><span>{detail}</span></div><span className="gate-state"><span />Pending</span></div>
                  ))}
                </div>
                <div className="readiness-foot"><Icon name="lock" size={16} /><span>Keep demo mode enabled. Never paste service-account keys or real parent phone numbers into chat.</span></div>
              </section>
              <section className="panel safety-principles">
                <div className="micro-label">NON-NEGOTIABLES</div>
                <div className="principle-grid">
                  <div><span className="principle-number">01</span><strong>Human review</strong><p>A teacher checks the exact text before every Stage 0 message.</p></div>
                  <div><span className="principle-number">02</span><strong>Facts, not assumptions</strong><p>An attendance mark cannot prove where a student is or why she is absent.</p></div>
                  <div><span className="principle-number">03</span><strong>Leave suppresses alerts</strong><p>Approved leave must be recorded before the roll is reviewed.</p></div>
                  <div><span className="principle-number">04</span><strong>One red stop</strong><p>A global panic switch must block every outbound channel.</p></div>
                </div>
              </section>
            </div>
          )}
        </div>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => (
            <button type="button" key={item.id} className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)} aria-current={view === item.id ? 'page' : undefined}>
              <Icon name={item.icon} size={19} /><span>{item.label === 'Safety centre' ? 'Safety' : item.label}</span>
            </button>
          ))}
        </nav>
      </main>

      <ParentPreviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        absentStudents={absentStudents}
        leaveCount={counts.leave}
        dateISO={dateISO}
        rollType={rollType}
        language={messageLanguage}
        onLanguage={setMessageLanguage}
        onToast={setToast}
      />
      {toast && <div className="toast-message" role="status"><span className="toast-check"><Icon name="check" size={14} /></span>{toast}</div>}
    </div>
  );
}
