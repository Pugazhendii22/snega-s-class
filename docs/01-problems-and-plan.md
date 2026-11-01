# Class Teacher Assistant — Problem Analysis & Plan (v0.3)

> **Status:** Reframed for **real deployment to one working class teacher**. This is not a college project — see `README.md`.
> **Stack:** React (Vite) + Node/Express + Firebase (Auth, Firestore, Storage, Cloud Functions)
> **Login:** Class teacher only (single role). Students interact via no-login link/QR only. Parents only *receive*.
> **Institution:** **Girls' college**, Chennai, Tamil Nadu — Anna University / state norms assumed (75% attendance rule, 6-period day, internal assessment marks)
> **Flagship capability:** 🛡️ **Parent Alert & Verified Contact System** → `docs/02-parent-alert-system.md`
> **Deployment, cost, legal & operations:** → `docs/03-deployment-and-operations.md` ⬅ **read this too; it constrains everything below**
>
> ### Why "girls' college" changes everything
> It reframes the project from *a records app* to *a student-safety app*. The headline feature is no longer "attendance in 30 seconds" — it is **"no parent ever has to wonder where their daughter is."** It justifies every technical decision: two rolls a day, OTP-verified guardian contacts, escalation timers, exit passes, bilingual templates.
> Frame it as **transparency + safety**, never as surveillance. See `docs/02` §7 and `docs/03` §5.

---

## 0. How to read this document

1. §1 is the **hypothesised** problem set, built from what a class teacher's job actually involves. §2 is where the real teacher's own words replace it.
2. **`docs/03` overrides this file wherever they disagree.** Cost, legality and maintainability beat feature ambitions.
3. The build order in §7 is designed so that she has something *usable* at every stage — never "all or nothing at the end". A tool she can't use in week 2 is a tool she won't use in week 20.
4. **Success metric:** she is still using it in month 4, and no parent has ever received a wrong message.

---

## 1. Problems class teachers actually face (my hypothesis)

A class teacher in an Indian college isn't just a lecturer — they're a record keeper, counsellor, event organiser, and middle-man between HOD, students and parents. The pain is almost never "teaching". It's **paperwork, tracking and communication**.

### 1.1 Attendance — the biggest time sink
| Pain | Detail |
|---|---|
| Manual roll call wastes 8–10 min/period | Across 5 periods × 6 days × a semester, that's ~40+ hours lost. |
| Reconciliation is brutal | Paper sheet → Excel → consolidation form → HOD report. Same data typed 3–4 times. |
| The 75% rule | Students must hit 75% to be exam-eligible. Teachers discover shortfalls **in week 12**, not week 3, when nothing can be done. |
| Proxy / "mark him present" | Verbal marking is easy to abuse and hard to audit. |
| Condonation & medical leave | Separate register, separate proof, separate approval trail — usually in a physical file. |
| Late arrivals | A student at 9:07 — present, absent, or half? No consistent rule, no record. |
| Lab vs theory | Lab sessions run 3 periods together; attendance logic differs (no per-period marking). |

### 1.2 Internal assessment / marks
- CIA marks live in a notebook or an Excel file on one laptop. Lose the file → lose the semester.
- **Backlog/arrear tracking is manual.** Which student has how many arrears, from which semester, in which subject — nobody has a clean view.
- Re-evaluation and grade changes have no history. "Was it 34 or 38?" — unanswerable.
- Mark sheets must be produced in a fixed format for the HOD. Formatting is done by hand, every cycle.

### 1.3 Communication
- Notices are stuck on a board or lost in a WhatsApp group with 200 unread messages.
- **No record of who was informed.** When something goes wrong, "I told the class" is not evidence.
- Parent contact happens only after a crisis. There's no structured way to send progress to 60 parents.
- Students ask the same 5 questions repeatedly (syllabus, exam date, submission deadline, fee date, holiday).

### 1.4 Student tracking & counselling
- No early-warning system for a student slipping — academically or personally.
- Behavioural / disciplinary incidents are recorded nowhere, or in memory.
- Counselling conversations happen but aren't logged, so there's no continuity if the class teacher changes.
- Students with special needs (slow learners, financially struggling, health issues) are tracked in the teacher's head.

### 1.5 Administrative load
- **Event / activity reporting:** every seminar, workshop, industrial visit, sports day, NSS activity needs photos, an attendance list and a report.
- Fee defaulters list, library dues, lab dues, ID-card data, bonafide/NOC/conduct certificate requests.
- Timetable clashes, room allotment, duty roster for invigilation.
- End-of-semester: consolidating everything into the class report, in a hurry, at midnight.

### 1.6 Girls'-college-specific — 🔴 the problem this project exists to solve
| Pain | Detail |
|---|---|
| **The information gap** | A student leaves campus or skips class and tells her parents she is "at college" / "going to work". Parents believe her. The gap can last a full day. |
| **No instant parental notification** | Absence is discovered by the teacher, recorded on paper, and communicated — if at all — days later by phone call. |
| **Mid-day exits are a black hole** | A student signs in at 9:00 AM and is gone by 12:30 PM. Nobody systematically tells the parent she left, or confirms she came back. |
| **Unverified parent numbers** | The contact number on file may be outdated, wrong, or quietly swapped for a friend's number. The whole notification chain silently fails. |
| **No audit trail** | If something goes wrong, the college cannot prove the parent was informed, or when. "We called" is not evidence. |
| **No escalation path** | When a parent says *"I did not know she was absent"*, there is no defined next step — who is called, how fast, who owns it. |
| **Manual calling doesn't scale** | One teacher, 60 students, 45-minute break. It is physically impossible to phone every parent of every absentee, daily. |
| **Safety vs. privacy tension** | The college wants to protect students without becoming an intrusive surveillance state. Getting this balance right is the actual design challenge. |

### 1.7 The meta-problems
- **Data duplication:** the same fact is written down 3–4 times in different formats.
- **No history:** Excel gets overwritten. Nobody knows what a student's attendance was in week 6.
- **No offline tolerance:** college Wi-Fi is unreliable; any app that dies without internet will be abandoned on day 2.
- **Single point of failure:** everything depends on one teacher's memory and one laptop.
- **Handover:** when the class teacher changes, the new teacher inherits nothing.

---

## 2. ⬅ YOUR TURN — replace this with the real list

Get these from **her** — ideally by sitting with her for one morning during an actual roll, not by asking her to fill in a form. For each problem note:

- **Who** feels it (class teacher? student? HOD? parent?)
- **How often** (daily / weekly / per semester / only in emergencies)
- **How they cope today** (notebook, Excel, WhatsApp, memory, nothing)
- **What it costs** (minutes wasted, errors, missed deadlines, a student failing)

Ten messy observations from a real classroom beat sixty guesses. **Frequency + current workaround** is the gold — it tells you what to build first.

**Also ask her these three, which nobody thinks to ask:**
- *"What is the most annoying thing you do every single day?"* → builds the daily-use core.
- *"What did you last get told off for, or nearly get into trouble over?"* → builds the safety net.
- *"What would have to be true for you to keep using this in April?"* → this is the real spec.

---

## 3. What to build — and what to cut

The full feature list is below, but the **MVP is locked at five items** (see `README.md`). Everything else is explicitly deferred. Deferring is not the same as dropping — the data model in §6 leaves room for all of it.

### 🔴 Tier 0 — The locked MVP. Nothing else ships until these are boring and reliable.
1. **Morning & Evening Roll** — fast marking (shortcuts/swipe), 60 students in under 30 s, offline-tolerant, per-subject and per-period history. *Two checkpoints: morning catches who never came, evening catches who came and left.*
2. **🛡️ Parent absence alert (click-to-send)** — on marking absent with no approved leave, the app composes a correct EN/TA message and offers a one-tap **"Send on WhatsApp"** from her own number. ₹0, no approvals, human-reviewed. → `docs/02`
3. **Verified parent contacts + consent** — guardian name, relation, phone, WhatsApp flag, language, signed consent. OTP-verified at setup, re-verified each semester, **teacher-only editing**, every change logged. *The whole system is worthless if the number on file is a friend's.*
4. **Attendance % and the 75% warning** — running %, per-student trend, red/amber/green risk board. Warn in week 3, not week 12.
5. **Export, backup & the panic switch** — nightly JSON backup to her Drive, XLSX/PDF register in the college's own format, full data export, and one red toggle that stops every outgoing message instantly. → `docs/03` §8

### 🟠 Tier 1 — Add once Tier 0 has survived a fortnight of real use
6. **Safety rails** *(actually build these in Phase 2, before Tier 0 goes live)* — dry-run/test mode, **silent-pilot mode**, dedupe table, quiet hours, undo window, one-tap correction with auto-apology.
7. **Leave & condonation workflow** — student applies via a signed no-login link, teacher approves, medical proof uploaded, counted in the 75%. **Approved leave suppresses the absence alert** — this is what stops false alarms.
8. **Weekly parent digest** — attendance %, below-75% warning, upcoming events. Saturday 6 PM. Email or WhatsApp broadcast, **never 60 individual WhatsApps** (see `docs/03` §4.3).
9. **Notice board with read receipts** — publish once, see who has opened it. Kills the "I told the class" problem.

### 🟡 Tier 2 — Real value, but only if she asks for it
10. **🛡️ Escalation ladder** — unconfirmed alert → 30 min reminder → 60 min warden → same-day HoD. Red alert inbox. *Needs college endorsement to be meaningful.*
11. **🛡️ Mid-day Exit Pass** — student requests via QR → teacher approves → parent notified the instant she walks out → **check-in** on return → auto-escalate if not back by expected + 45 min. *This is the flow that directly closes the loophole you described — but it depends on the college actually having an exit-permission rule to digitise.*
12. **CIA marks** — internal assessment per cycle, auto total, auto grade, change history.
13. **Student profile 360** — one page: attendance, marks, arrears, incidents, counselling notes, verified parent contact, photo.
14. **Incident log + counselling notes** — private, timestamped, teacher-only. ⚠️ **Must be structurally excluded from every parent message** (`docs/03` §5).
15. **Reports** — PDF mark sheet + attendance statement in the exact format the HOD wants.

### 🟢 Tier 3 — Nice, later, and honestly optional
16. **Offline-first sync queue** — mark with no signal, sync on reconnect. High value on a real campus; non-trivial to get right. Design the write path for it from day one, implement after Tier 0.
17. **WhatsApp Cloud API automation (Stage 1)** — alerts fire without her tapping. Only if she *wants* to lose the manual review gate.
18. **QR / NFC attendance** — scan the room instead of tapping.
19. **Early-warning projection** — "at this rate these 4 fall below 75% by week 11".
20. **Voice attendance**, **event report generator**, **handover pack**, **multi-class / multi-teacher**.

> **What got cut from v0.2 and why:** the 14-week semester calendar (there is no submission date), the "differentiator" framing (nobody is scoring this), synthetic-data-only (she needs her real class), and the assumption that a mock provider is an acceptable end state (a real parent must really receive a real message).

---

## 4. Scope decisions to make early

| Decision | My recommendation | Why |
|---|---|---|
| Does Node have a real job? | **Yes — keep it** | Firebase alone can't do PDF generation, Excel parsing, scheduled digests, or keep your Firebase keys off the client. Node = the "reporting & integration" service. **It also lets you skip Firebase Blaze entirely** by running the scheduler as cron inside the Node process — no credit card required. See `docs/03` §2. |
| Firestore or Realtime DB? | **Firestore** | Structured queries, offline persistence built in, better security rules. |
| Students get an app? | **No — give them a link/QR** | A shareable per-student URL or QR for leave applications, mid-day exit passes, and viewing their own status. Zero installs, zero accounts. Preserves "teacher-only login". **Required for the Exit Pass flow.** |
| Web or mobile? | **Responsive web (PWA)** | Installable on a phone, works offline, but one codebase and no app-store friction. No app-store review, no Play Console account, no update friction. |
| Multi-teacher? | **Design for it, build single** | Keep `classId` + `teacherId` in the data model so it scales to the department later, but build only one role now. |
| 🔴 Real students' data? | **Yes — so treat it as real personal data** | This is no longer a synthetic dataset. Real minors, real parent numbers. DPDP Act 2023 applies: verifiable parental consent, data minimisation, stated retention, right to erasure, strict Firestore rules, **her** account owns everything. Full treatment in `docs/03` §5. Use synthetic data only in the dev environment. |
| 🔴 Who owns the accounts? | **Her. Not you.** | Firebase project, domain, hosting, WhatsApp Business — all in her name. You are an Editor. Otherwise the day you move on, she loses her class records and you become permanent unpaid support. `docs/03` §2. |
| 🔴 Automated or human-reviewed sending? | **Human-reviewed first (Stage 0)** | Click-to-send means she reads every message before it goes. Slower by ~45 s/day, and worth it: it is the safeguard against a false "your daughter is missing" alert, and it keeps the messages sounding like a person. Automate later, only if she asks. |
| 🔴 SMS or WhatsApp? | **WhatsApp. SMS is legally blocked for her.** | DLT registration requires the college to be a Principal Entity (GST/PAN/incorporation, ₹5,900, 3–10 days). Unregistered SMS is **silently dropped** even when the API returns 200. WhatsApp needs no DLT. `docs/03` §1. |

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React (Vite) + Tailwind — PWA, installable, offline-capable │
│  • Dashboard  • Attendance  • Marks  • Students  • Reports │
│  • Local cache (IndexedDB / Firebase offline persistence)  │
└───────────────┬──────────────────────┬───────────────────┘
                │ direct reads/writes   │ heavy jobs
                │ (Firebase SDK)        │ (REST)
                ▼                       ▼
┌────────────────────────┐   ┌──────────────────────────────┐
│        FIREBASE         │   │      Node / Express API      │
│ • Auth (email + Google) │   │ • PDF generation (report,    │
│ • Firestore (data)      │◄──┤   mark sheet, event report)  │
│ • Storage (photos,      │   │ • Excel/CSV import-export    │
│   leave proofs)         │   │ • Scheduled digests          │
│ • Cloud Functions       │   │ • WhatsApp/email dispatch    │
│   (triggers, digests)   │   │ • Analytics aggregation      │
└────────────────────────┘   └──────────────────────────────┘
```

**Rule of thumb:** the React app talks to Firebase directly for interactive data (fast, real-time, offline). Node handles anything *heavy, scheduled, secret, or formatted* — server-side PDF, bulk import, notifications, weekly digest.

---

## 6. Data model (Firestore, first cut)

```
teachers/{teacherId}
  name, email, dept, phone, createdAt

classes/{classId}
  teacherId, name ("B.Tech CSE - III Year - Sec B"),
  academicYear, semester, section, room, strength, createdAt

classes/{classId}/students/{studentId}
  rollNo, name, gender, dob, phone, email,
  photoURL, guardianName, guardianPhone,
  bloodGroup, address,
  tags: ["slow-learner" | "sports" | "arrears" | ...],
  status: "active" | "left" | "detained"

classes/{classId}/subjects/{subjectId}
  code, name, type: "theory" | "lab" | "project",
  credits, periodsPerWeek, internalMaxMarks

classes/{classId}/timetable/{dayOfWeek}
  periods: [{ periodNo, subjectId, startTime, endTime, room }]

attendance/{attendanceId}              ← top-level for cheap querying
  classId, subjectId, date, periodNo, sessionType,
  rollType: "MORNING" | "EVENING" | "PERIOD",   🔴 drives the parent alert flows
  takenBy, takenAt, totalPresent, totalAbsent, totalLeave,
  entries: [{ studentId, status: "present"|"absent"|"leave"|"late", minutesLate }]
  alertedParentIds: [],                 🔴 dedupe — who was already notified today
  syncedOffline: bool

marks/{markId}
  classId, studentId, subjectId, cycle ("CIA-1"|"CIA-2"|"Model"),
  components: { assignment: 8, quiz: 12, attendance: 4, seminar: 6 },
  total, grade, enteredAt, history: [{ changedAt, oldValue, newValue, reason }]

leaves/{leaveId}
  classId, studentId, fromDate, toDate, type ("medical"|"duty"|"personal"),
  reason, proofURL, status ("pending"|"approved"|"rejected"),
  condonationEligible, decidedBy, decidedAt

incidents/{incidentId}
  classId, studentId, date, category, severity, description,
  actionTaken, private (bool)

counsellingNotes/{noteId}
  classId, studentId, date, summary, followUpDate, followUpDone

notices/{noticeId}
  classId, title, body, priority, attachments[], publishedAt,
  reads: { [studentId]: timestamp }

events/{eventId}
  classId, title, type, date, venue, report: { description, photos[], attendees[] },
  submittedToHOD: bool

syncQueue (client-side, IndexedDB)
  pending operations for offline attendance → flushed on reconnect

── Added by the Parent Alert module (full definitions in docs/02-parent-alert-system.md §5) ──
parents/{parentDocId}        verified guardian contacts (OTP-verified, consent-recorded)
messages/{messageId}         every message sent — flow, channel, status, timestamps  [audit trail]
confirmations/{id}           parent replies: CONFIRM / ALERT / UNKNOWN
escalations/{id}             level 1→2→3, notified roles, acknowledged, resolved
exitPasses/{id}              mid-day exit: approved, leftAt, checkedInAt, OVERDUE
messageTemplates/{id}        EN/TA templates per flow, versioned
```

---

## 7. Build plan — ordered by *when she can start using it*

Not a semester calendar. There is no submission date. The only question is: **how soon does something real land in her hands, and how fast does each addition pay for itself?**

| Phase | Rough effort | Deliverable | She can… |
|---|---|---|---|
| **0. Discovery** | 1 week | Sit with her during an actual morning roll. Fill §2 from her words, not guesses. Confirm roll times, period count, working days, the college's real leave/exit rules, and who the escalation contacts are. **Confirm whether the college endorses this** (`docs/03` §4 Phase 0). | — |
| **1. Foundation** | 1–2 weeks | Repo, **Firebase project owned by her**, auth, Tailwind design system, class creation, student CSV import, **parent contact CRUD + OTP verification**, `MessageProvider` interface with the **click-to-send** provider. | Import her real class and see it on her phone |
| **2. Safety rails** ⚠️ | 2–3 days | **Build these before anything can send:** global panic switch (`messagingEnabled: false`), **dry-run / test mode**, **silent-pilot mode** (records everything, sends nothing), dedupe table, quiet hours. | Trust that it cannot embarrass her |
| **3. Morning roll + alert** | 1–2 weeks | Fast marking UI (shortcuts, swipe), review screen showing exactly which parents get what, click-to-send in EN/TA, full audit trail. | **Start the silent pilot** |
| **4. Silent pilot** | 2 weeks | *No new features.* Accuracy logging, false-alert investigation, her feedback loop. Exit criteria in `docs/03` §4. | Get confident without risk |
| **5. Go live (morning)** | — | Real messages, morning absence alerts only. Daily 2-minute check-in with her. | Actually help parents |
| **6. Evening roll + 75% board** | 1 week | Second checkpoint, running %, red/amber/green risk board, per-student trend. | Catch the mid-day leaver, warn early |
| **7. Export & backup** | 3–4 days | Nightly JSON backup to her Drive · XLSX/PDF attendance register in the college's own column format · CSV message audit trail · full data export. | Never feel trapped |
| **8. Leave workflow** | 1 week | Student applies via no-login signed link → teacher approves → proof uploaded → **approved leave suppresses the alert** → counted in the 75%. | Stop the false alarms from genuine leave |
| **9. Weekly digest + notices** | 1 week | Saturday 6 PM summary (email/broadcast, not per-parent WhatsApp), notice board with read receipts. | Cut her WhatsApp typing |
| **10. Optional later** | as wanted | Mid-day exit passes · escalation ladder automation · CIA marks · offline-first sync · WhatsApp Cloud API (Stage 1) · student 360 · incident/counselling log · QR attendance. | Grow into it |

> ⚠️ **Phase 2 is not optional and is not deferrable.** The panic switch, dry-run mode and silent-pilot mode are *small* pieces of work — a few days — and they are the difference between a tool she trusts and a tool she is afraid of. Every project that skips this ships the dangerous part first.

> **Anti-pattern:** building all 21 features badly. Five features that are **boring and reliable** will still be in daily use in a year. Twenty clever ones will be abandoned by February.

---

## 8. Cheap things that decide whether she keeps using it

- **Mobile-first, one-handed, thumb-reachable.** She is standing in a classroom holding a register, on a mid-range Android, on 4G. Design for *that*, not for a laptop.
- **Empty states, loading skeletons, clear errors.** Perceived reliability is reliability. A spinner with no explanation at 8:58 AM will be closed and never reopened.
- **Under 2 seconds to first useful screen.** Cold start matters more than any feature.
- **`P` / `A` keyboard shortcuts and swipe gestures.** Target: 60 students marked in under 30 seconds.
- **An "undo" that actually works** — 60-second window on roll submission, and one-tap correction that auto-drafts an apology message to a wrongly-alerted parent.
- **Tamil, properly.** Not machine-translated. Get a native speaker to check every parent-facing string. This decides whether parents read the messages.
- **A realistic seed/demo dataset** for *development only* — 60 synthetic students, 12 weeks of attendance, a few at-risk cases. Never train or demo on her real students' data in front of others.
- **Screenshots + a short screen-recording of her actual workflow**, taken in week 1. You will not get another chance to see the "before" state, and it's how you prove the tool helped.

---

## 9. Risks — reframed for a real deployment

The full operational risk register is in **`docs/03` §7**. These are the project-level ones.

| Risk | Mitigation |
|---|---|
| 🔴 **A wrong message goes to a parent** | Silent pilot · review screen before every send · dedupe · undo window · one-tap correction with auto-apology · panic switch |
| 🔴 **SMS silently dropped for lack of DLT registration** | **Don't use SMS until the college registers.** WhatsApp needs no DLT. If SMS ever happens, verify delivery receipts on real phones in week 1. See `docs/03` §1.1. |
| 🔴 **She stops using it in month 2** | Ship the daily-use core first · keep it under 3 minutes/day · exception-only messaging · weekly check-in for the first two months |
| 🟠 **College refuses to endorse it** | Discovered in Phase 0. If so, messages must not carry the college name and there is no escalation path — redesign accordingly, don't bluff. |
| 🟠 **Scope creep** | The five MVP features in `README.md` are locked. Anything else goes to Phase 10 and waits. |
| 🟠 **You become permanent unpaid support** | `docs/03` §2 (she owns every account) · §8 (runbook, export, handover) · architecture simple enough that a competent stranger could maintain it |
| 🟠 **Firebase Blaze / billing surprise** | Prefer running the scheduler inside the Node service so **Cloud Functions aren't needed at all**. If they are: hard budget cap + ₹200 alert. |
| 🟡 **Privacy / DPDP exposure** | Consent letter, data minimisation, retention period, delete-my-data function, strict Firestore rules. `docs/03` §5. |
| 🟡 **Offline sync bugs** | Ship the online path first and add the offline queue only once the core is boring and reliable — but design the write path so it can be queued from day one. |

---

## 10. Next actions

- [ ] **You:** answer `docs/03` §9 — especially **#2 (does the college endorse this?)**, **#10 (any budget at all?)** and **#12 (who maintains it after handover?)**.
- [ ] **You:** get her own answers to §2, ideally by sitting in on one real morning roll.
- [ ] **Me:** scaffold React + Node + Firebase, with **her** account as owner, and build Phase 1 + Phase 2 (safety rails) first.
- [ ] **Me:** build the click-to-send provider and the dry-run review screen so the whole alert loop is testable with **zero** cost and **zero** risk of a real message.

---

## 11. Documents

| File | Contents |
|---|---|
| `README.md` | Orientation — why this isn't a student project, the two hard legal constraints, the 3-stage messaging strategy, the locked MVP |
| `docs/01-problems-and-plan.md` | This file — problem analysis, feature tiers with cut rationale, architecture, Firestore data model, build order |
| `docs/02-parent-alert-system.md` | 🛡️ Flagship module — two-roll design, four message flows, escalation ladder, OTP-verified contacts, exit passes, EN/TA templates |
| `docs/03-deployment-and-operations.md` | **Real deployment** — DLT & WhatsApp legal pathway, actual monthly cost, hosting & account ownership, her daily workflow, rollout + silent pilot, DPDP & privacy, parental consent letter, failure modes, backup & handover |
