# Module: Parent Alert & Verified Contact System

> **The single most important module in this project.** Everything else is convenience; this is safety.
> Context: **Girls' college, Chennai.** Students sometimes leave campus / skip class and tell parents they are "going to work" or "in class". Parents find out late, or never.

---

## 1. The problem, stated honestly

A student is marked absent at 9:00 AM. Her parent believes she is in college. That gap can last the **entire day** — and in a girls' college, an unexplained, unreported absence is not a discipline issue first. It is a **safety issue first**.

Today the class teacher handles this by:
- Calling parents manually, one by one, after the fact.
- Sending a message in a parent WhatsApp group (which many parents mute).
- Or not telling anyone, because there are 60 students and 45 minutes.

There is **no audit trail**. If something goes wrong, nobody can prove the parent was informed, or when.

### What this module must achieve
1. Parent is informed **within seconds** of an unapproved absence — automatically.
2. Parent **confirms** they know — creating a record.
3. If the parent does **not** confirm and the student is unreachable → **escalate**. Fast.
4. Mid-day exits are **logged, parent-notified, and checked back in**.
5. The parent phone number on file is **verified** — a student must not be able to quietly swap in a friend's number.
6. Every message sent is **stored and viewable** — a complete, exportable audit trail.

---

## 2. The two-roll design (your core requirement)

Two mandatory checkpoints per day, plus event-driven instant alerts.

| Roll | Time (configurable) | Who | What happens |
|---|---|---|---|
| 🌅 **Morning Roll** | 9:00 AM, Period 1 | Class teacher | Marks presence. **Instant alert** to parent of every student absent without approved leave. |
| 🌇 **Evening Roll** | 4:00 PM, last period | Class teacher | Marks presence again. **End-of-day summary** to every parent. Catches the student who came in the morning and left after lunch. |

### Why both are necessary
Morning-only catches the student who never arrived.
Evening-only catches the student who left mid-day.
**Neither alone catches the student who arrived, signed in, then went out.** That is exactly the case you described. Two rolls, and a mid-day exit gate between them.

---

## 3. The four message flows

### Flow A — Morning absence alert (instant)
Triggered by Firestore on every `absent` entry with no matching approved leave.

```
  [Teacher marks 9:00 AM roll]
             │
             ▼
  ┌──────────────────────────┐      Firestore onCreate / onUpdate trigger
  │ attendance/{doc}         │─────────────────────────────────────┐
  └──────────────────────────┘                                      │
                                                                    ▼
                                          ┌───────────────────────────────────┐
                                          │ Node: dispatch service            │
                                          │  1. Is there approved leave? → SKIP│
                                          │  2. Is parent number VERIFIED?     │
                                          │  3. Already alerted today? → SKIP  │
                                          │  4. Quiet hours? → defer           │
                                          │  5. Render template (EN / TA)      │
                                          │  6. Send via provider              │
                                          │  7. Write messages/{id} audit doc  │
                                          └───────────────────────────────────┘
                                                                    │
                                                                    ▼
                                          📱 Parent receives within ~10 seconds
                                          ↩️ Parent taps "I am aware" → CONFIRMED
```

**Parent sees (English):**
> **St. Mary's College — Attendance Alert**
> Your ward **Priya S (Roll 23, III CSE-B)** was marked **ABSENT** at **9:02 AM, 12 Nov 2026**.
> No leave has been approved for today.
> 👉 If she is at home or you are aware: reply **CONFIRM 23**
> 👉 If you did NOT know: reply **ALERT 23** — the class teacher will call you immediately.
> Class Teacher: Mrs. R. Lakshmi · 98400 XXXXX
> *To stop these messages, contact the college office.*

**Parent sees (Tamil — must have this):**
> **பெண்கள் கல்லூரி — வருகை அறிவிப்பு**
> உங்கள் மகள் **பிரியா S (பதிவு எண் 23, III CSE-B)** இன்று **காலை 9:02** மணிக்கு **வரவில்லை** என பதிவு செய்யப்பட்டுள்ளது.
> இன்றைய தேதிக்கு விடுமுறை எதுவும் அனுமதிக்கப்படவில்லை.
> 👉 உங்களுக்குத் தெரியும் என்றால்: **CONFIRM 23** என பதில் அனுப்பவும்.
> 👉 உங்களுக்குத் தெரியாது என்றால்: **ALERT 23** என பதில் அனுப்பவும் — வகுப்பு ஆசிரியர் உடனே அழைப்பார்.

> ⚠️ **Tone is deliberate.** No accusation, no "your daughter is missing", no moral language. Facts + time + two clear actions. A shaming message will get the app switched off by the college in week one.

### Flow B — Parent confirmation & escalation (this is the safety net)
```
  Absent + alert sent
        │
        ├─ Parent replies CONFIRM ──► status: PARENT_AWARE ✅  (logged, closed)
        │
        ├─ Parent replies ALERT  ────► status: ESCALATED 🔴
        │                              ├─ Push notification to teacher's phone
        │                              ├─ Teacher's dashboard turns red for that student
        │                              ├─ Auto-draft: call Warden / HoD
        │                              └─ Incident created automatically
        │
        └─ No reply in 30 min ───────► status: UNCONFIRMED 🟠
                                       ├─ Reminder #1 to parent
                                       ├─ Notify teacher: "5 parents haven't confirmed"
                                       └─ At 60 min + student phone unreachable
                                          → ESCALATE to Warden + HoD 🔴
```

**Escalation ladder is configurable per college.** Default: 30 min reminder → 60 min warden → same-day HoD call. This is the single most valuable thing the tool does — **but it requires the college to formally accept the escalation path.** Confirm in Phase 0 (`docs/03` §4) that a warden/HoD will actually act on these. An escalation nobody answers is worse than none, because it creates false confidence.

### Flow C — Mid-day Exit Pass ("Going Out Gate")
Girls' colleges commonly allow mid-day exit only with permission. Digitise it.

```
  Student requests exit (no-login link / QR on ID card)
        │  reason, expected return time, optional proof
        ▼
  Teacher approves on phone  ──► Parent gets INSTANT message:
        │                        "Priya left campus at 12:40 PM. Expected back 2:30 PM.
        │                         Approved by Mrs. R. Lakshmi. Pass #4821."
        ▼
  Student returns, teacher marks CHECK-IN ──► Parent gets:
                                               "Priya checked back in at 2:25 PM. ✅"
        │
        └─ NOT checked in by expected time + 45 min ──► 🔴 ESCALATE
```
This closes the exact loophole you described: **a student cannot leave campus without her parent knowing the minute she walks out.**

### Flow D — Evening summary + digests
| Message | When | To whom |
|---|---|---|
| **Evening roll summary** | 4:15 PM daily | Every parent: *"Priya attended all 6 periods today ✅"* or *"Priya left at 12:40 PM, returned 2:25 PM"* |
| **Left-campus-never-returned** | On detection | Immediate escalation |
| **Weekly digest** | Sat 6:00 PM | Attendance %, below-75% warning, CIA marks, upcoming events |
| **75% danger notice** | When a student crosses the threshold | Formal notice, copy to HoD |

---

## 4. Parent contact verification — do not skip this

The whole system collapses if the phone number on file is a friend's number. **Build this in Phase 1, alongside the consent letter** — do both in one exercise, not two.

**Setup flow:**
1. Teacher/office enters parent name, relation, phone, alternate phone, and whether it's WhatsApp-enabled.
2. System sends a **6-digit OTP** to that number.
3. Parent enters OTP (on a one-time verification link) **or** reads it back over a phone call during admission.
4. Contact is flagged `verified: true`, `verifiedAt`, `verifiedBy`.
5. **Re-verify every semester.** Show a red badge on any contact unverified for >180 days.

**Hard rules:**
- ❗ **A student can never edit a parent contact.** Teacher-only, and every change is logged with old/new value.
- ❗ Unverified numbers get **no messages** — and appear in the teacher's "Action Needed" list.
- ❗ Two parents/guardians can be registered (mother + father), with a primary.

---

## 5. Technical architecture

```
React (PWA)                     Node / Express                        Firebase
┌─────────────────┐            ┌──────────────────────────┐         ┌────────────────┐
│ Morning Roll UI │──write────▶│ /api/messages/send       │◀────────│ Firestore      │
│ Evening Roll UI │            │ /api/messages/inbound    │         │  attendance/   │
│ Template editor │            │ /api/parents/verify      │         │  leaves/       │
│ Message timeline│            │ /api/parents/:id/contacts│         │  messages/     │
│ Alert inbox 🔴  │◀──socket───│ dispatch service         │         │  parents/      │
│ Exit-pass screen│            │  ├─ dedupe (once/day)    │         │  escalations/  │
└─────────────────┘            │  ├─ quiet hours (IST)    │         └───────┬────────┘
                               │  ├─ template renderer    │                 │
                               │  ├─ EN/TA i18n           │      onCreate   │ onUpdate
                               │  └─ retry + backoff      │      triggers   ▼
                               └───────────┬──────────────┘    ┌────────────────────┐
                                           │                   │ Cloud Functions    │
                       ┌───────────────────┼──────────────┐    │ • attendanceAlert  │
                       ▼                   ▼              ▼    │ • leaveApproved    │
              ┌────────────────┐  ┌───────────────┐  ┌──────┐  │ • exitPassIssued   │
              │ SMS (MSG91 /   │  │ WhatsApp      │  │Email │  │ • escalateCheck    │
              │ Twilio /       │  │ Business API  │  │(free)│  │   (scheduled 30/60)│
              │ TextLocal)     │  │ (Gupshup/360) │  │      │  │ • weeklyDigest     │
              └────────────────┘  └───────────────┘  └──────┘  └────────────────────┘
                        └──────── one Provider interface ────────┘
```

### The Provider abstraction (write this first — it is what lets you start at ₹0 and grow)

One interface, several implementations. The app never knows which one is active.

```js
// server/services/messaging/provider.js
class MessageProvider {
  async render({ to, flow, vars, lang })              // → { text, deepLink? }
  async send({ to, template, vars, lang, channel })   // → { id, status }
  async status(messageId)                             // delivered | read | failed | unknown
  async parseInbound(rawPayload)                      // → { studentHint, intent: CONFIRM|ALERT }
}
```

| Provider | Stage | Cost | Needs | Use it for |
|---|---|---|---|---|
| **`ClickToSendProvider`** ⭐ | **0** | **₹0 forever** | **Nothing.** No API, no DLT, no Meta approval, no business verification | **Ship this first.** Composes the message, returns a `https://wa.me/91…?text=…` deep link. She taps, WhatsApp opens pre-filled, she presses send. |
| `DryRunProvider` | 0 | ₹0 | — | **Test mode.** Writes the audit doc, renders the message, shows it in-app, sends nothing. Build before anything that *can* send. |
| `EmailProvider` | 0 | ₹0 | Resend / SendGrid free tier | Weekly digest, formal records, parents without WhatsApp |
| `WhatsAppCloudProvider` | 1 | ₹0 under 1,000 msgs/month | Dedicated number, Facebook Business Portfolio, business verification, Meta-approved templates (~1–2 weeks) | Fully automatic alerts. **No DLT required.** |
| `SmsProvider` (MSG91 / Twilio / TextLocal) | 2 | ~₹0.15/SMS **+ ₹5,900 one-time DLT** | **The college** registered as DLT Principal Entity + header + templates + PE–TM chain binding | Safety-critical fallback: reaches non-smartphones, works when mobile data is down |

**Why `ClickToSendProvider` is Stage 0 and not a compromise:**
- ✅ Zero cost, zero paperwork, usable this week.
- ✅ The message arrives from **her own number**, already saved in the parent's phone — far more trusted than an unknown business sender ID.
- ✅ **A human reviews every message before it goes.** When the subject is someone's child, that is a feature, not a limitation.
- ✅ She can soften or add context for a particular parent.
- ⚠️ Manual — practical to ~20 messages/day. Fine, because we alert on **exceptions only**, never "your child was present today" × 60.
- ⚠️ No delivery/read receipts back into the app. Mitigation: the review screen has a **"mark as sent"** action and the audit trail records her confirmation. Accept the gap rather than fake it.

> 🚫 **Do not** build an auto-send hack on top of WhatsApp Web (Puppeteer, `whatsapp-web.js`, browser automation). It violates WhatsApp's Terms of Service and will get **her personal number banned** — an unacceptable risk for a tool whose entire purpose is safety. Stage 1 means the official Cloud API.

**Stage 0 UX details that matter:**
- Review screen lists every pending parent message with the **exact rendered text** in the parent's chosen language.
- **"Open all"** walks through them sequentially; each tap opens WhatsApp with the next message queued.
- **Copy to clipboard** and **share sheet** fallbacks for parents on plain SMS or email.
- A per-message **"skip"** with a reason (`number wrong`, `already called`, `parent at college`) — logged. Skipping must be an explicit act, never a silent drop.

### Firestore collections to add
```
parents/{parentDocId}
  classId, studentId, name, relation ("mother"|"father"|"guardian"),
  phone, altPhone, whatsappEnabled, email,
  language: "en" | "ta",
  verified: bool, verifiedAt, verifiedBy, otpHash, otpExpires,
  isPrimary: bool, consentGiven: bool, consentRecordedAt

messages/{messageId}
  classId, studentId, parentId,
  flow: "MORNING_ABSENT" | "LEAVE_APPROVED" | "EXIT_PASS" | "EXIT_RETURN"
        | "EVENING_SUMMARY" | "WEEKLY_DIGEST" | "DANGER_75" | "ESCALATION",
  channel: "sms"|"whatsapp"|"email"|"push",
  templateId, lang, renderedText,
  status: "queued"|"sent"|"delivered"|"read"|"failed",
  providerMessageId, sentAt, deliveredAt,
  attempts: int, lastError

confirmations/{confirmationId}
  messageId, studentId, intent: "CONFIRM"|"ALERT"|"UNKNOWN",
  receivedAt, rawText, source: "sms-reply"|"whatsapp"|"app-button"|"phone-call",
  recordedBy            // "system" or teacherId if noted manually

escalations/{escalationId}
  classId, studentId, triggerFlow, level: 1|2|3,
  notifiedRoles: ["teacher","warden","hod"],
  openedAt, acknowledgedBy, acknowledgedAt, resolvedAt, resolution, isSafetyIncident

exitPasses/{exitPassId}
  classId, studentId, requestedAt, reason, expectedReturn,
  approvedBy, approvedAt, leftAt, checkedInAt,
  status: "pending"|"approved"|"rejected"|"out"|"returned"|"OVERDUE",
  parentNotifiedAt, parentNotifiedReturn

messageTemplates/{templateId}
  flow, lang, body, vars[], active, version, updatedBy, updatedAt
```

### Scheduled jobs (Cloud Functions, all times IST / `Asia/Kolkata`)
| Cron (IST) | Job |
|---|---|
| `15 9 * * 1-6` | Morning roll not taken? Nudge teacher. Send morning summary for late-marked classes. |
| `15 16 * * 1-6` | Evening roll nudge + end-of-day summaries. |
| `*/10 * * * *` | Escalation sweep: unconfirmed alerts past 30/60 min. |
| `*/5 * * * *` | Overdue exit passes (expectedReturn + 45 min, not checked in). |
| `0 18 * * 6` | Weekly digest to all parents. |
| `0 8 * * 1` | Unverified-parent report to teacher. |

**Quiet hours:** suppress non-emergency messages 9:00 PM – 7:00 AM IST. **Safety escalations bypass quiet hours** — make that an explicit, commented, tested rule in code, not a convention somebody remembers.

**Timezone:** store and compute everything in `Asia/Kolkata`. Never rely on server local time or the browser's clock.

### Dedupe rules (stop parent spam — the #1 way these systems fail)
- One alert per student per flow per calendar day.
- If a student is absent in 4 periods, the parent gets **one** morning message, not four.
- Evening summary always sends, even if the morning alert already went out — it closes the loop.
- Leave approved → suppresses the absence alert entirely.

---

## 6. Cost estimate (be ready for this question)

Assume: 1 class of 60 students, 6 working days, ~8% daily absence.

| Item | Volume/month | Cost |
|---|---|---|
| Morning absence alerts (SMS) | ~5 × 25 days = 125 | ~₹19 (MSG91 @ ₹0.15) |
| Evening summaries | 60 × 25 = 1,500 | ~₹225 |
| Weekly digests | 60 × 4 = 240 | ~₹36 |
| Exit passes + confirmations | ~150 | ~₹23 |
| **Total per class** | **~2,000 SMS** | **~₹300 / month** |
| Firebase (Spark free tier) | — | **₹0** |
| Email fallback for all of the above | — | **₹0** |

**Whole college (say 40 classes):** ~₹12,000/month SMS, or **₹0 if WhatsApp/email-first with SMS only for escalations.** That hybrid is what I'd recommend and it's a strong line in your report: *"SMS reserved for safety-critical messages; routine summaries via WhatsApp/email at no marginal cost."*

---

## 7. Privacy, ethics & legal — put this in your report

This is not decoration for a report. It is what keeps a real teacher — and real students' families — out of harm. Full operational treatment in `docs/03` §5.

**What this app DOES:**
- Records attendance the teacher marks.
- Notifies a **pre-registered, OTP-verified** guardian about that attendance.
- Keeps an audit trail of every message.

**What this app deliberately does NOT do:**
- ❌ No location tracking or GPS of students.
- ❌ No monitoring of calls, chats or social media.
- ❌ No photos of students outside campus.
- ❌ No reporting of *who* a student was with, or any moral judgement.
- ❌ No sharing of a student's record with other students.

**Why the distinction matters:**
> The system enforces **transparency about attendance**, which is the college's legitimate interest and the parent's right to know. It does not attempt to surveil a student's private life. If a parent is told the truth about where their daughter is, the family decides what to do with that — not the app, and not the college. This keeps the project ethical, legally defensible, and genuinely useful.

**Legal notes (India):**
- **DPDP Act 2023:** you're processing personal data of (likely) minors. You need **verifiable parental consent** → the `consentGiven` + `consentRecordedAt` fields exist for exactly this. Practise **data minimisation** — don't collect what you don't use.
- **TRAI DLT registration:** any real SMS in India needs a DLT-registered Principal Entity, sender ID and pre-approved templates. **The college must register — a teacher cannot.** Until then, send no SMS at all: unregistered messages are silently dropped at the operator scrubber while your gateway returns HTTP 200. Detail in `docs/03` §1.1.
- **The WhatsApp Business Platform is exempt from DLT** — the practical reason Stage 0 and Stage 1 are both WhatsApp-based.
- **Never message a parent without recorded consent.** Hard-block it in the dispatch service, not in the UI.
- Retention: define a policy (e.g., delete message bodies after 1 academic year, keep aggregate stats).

---

## 8. Build order for this module

Sequenced so that **nothing capable of sending a real message exists until the safety rails are in place.**

| Step | What | Gate |
|---|---|---|
| 1 | `MessageProvider` interface + **`DryRunProvider`** + in-app message preview | — |
| 2 | **Panic switch** — global `messagingEnabled` flag, checked at the top of the dispatch service, surfaced as a big red toggle in Settings | 🔴 must exist before step 5 |
| 3 | **Silent-pilot mode** — full pipeline runs, every message rendered and logged, nothing leaves the app | 🔴 must exist before step 5 |
| 4 | Parent contact CRUD + consent recording + **OTP verification** | — |
| 5 | `ClickToSendProvider` (wa.me deep links) + the **review screen** | ✅ first real messages possible |
| 6 | Morning roll UI → Firestore write → dispatch → audit doc | — |
| 7 | **Dedupe** (one alert per student per day) + quiet hours + skip-with-reason | 🔴 must exist before go-live |
| 8 | Confirmation parsing (`CONFIRM 23` / `ALERT 23`) + `confirmations` collection | — |
| 9 | Evening roll + end-of-day review screen | — |
| 10 | Undo window (60 s) + one-tap correction with auto-drafted apology | 🔴 before go-live |
| 11 | Template editor with EN/TA + variable preview | — |
| 12 | Escalation sweep (cron in the Node service — **no Firebase Blaze needed**) + red alert inbox | after college confirms the escalation path |
| 13 | Exit Pass flow (signed student link → teacher approve → parent notify → check-in → overdue) | after the college's exit rule is confirmed |
| 14 | `EmailProvider` (real) + weekly digest | — |
| 15 | `WhatsAppCloudProvider` (Stage 1) — automatic sending | only if she asks to give up manual review |
| 16 | `SmsProvider` (Stage 2) | only after the college completes DLT registration |

---

## 9. How to test this without risking a single real parent

Build the harness **first**, because you will use it every time you touch the pipeline.

1. **Synthetic class.** 60 fake students with fake parent numbers — *your own* numbers, and a couple of family members who have agreed. Never test against the real contact list.
2. **Dry-run mode on, always, in dev.** Every message renders to the audit log and the preview pane. Nothing sends.
3. **The simulated parent phone.** A browser panel styled like a phone lock screen that shows each rendered message exactly as the parent would see it — with the timestamp, the sender name and the language. This is how you and she review wording without touching a real parent.
4. **Clock injection.** Never `new Date()` directly in the pipeline — take time from an injectable clock so you can simulate "30 minutes with no reply", "quiet hours", "second roll of the day", "semester boundary".
5. **The chaos checklist.** Run each of these deliberately before go-live:
   - [ ] Student marked absent who actually has approved leave → **no message**
   - [ ] Same student absent in 4 periods → **exactly one message**
   - [ ] Parent number unverified → **no message**, appears on "Action needed"
   - [ ] Parent has not given consent → **no message**, hard-blocked
   - [ ] Panic switch off → **no messages at all**, UI says why
   - [ ] Offline marking → queued, then sent once on reconnect, no duplicates
   - [ ] Roll submitted twice by accident → no second batch
   - [ ] 23:00 non-urgent message → deferred to 07:00
   - [ ] 23:00 safety escalation → **sent anyway**
   - [ ] Roll undone and corrected → apology drafted, audit trail intact
6. **The silent pilot** (`docs/03` §4) is the final test: two weeks of real rolls, zero real messages, accuracy logged daily. Exit criterion: **≥ 99.5% accuracy and zero false alerts on two consecutive days.**

---

## 10. Open questions

**Answered already:** girls' college · teacher-only login · Chennai/Tamil Nadu · React + Node + Firebase.

**Still needed:**
- [ ] Exact **morning and evening roll times**? (assumed 9:00 AM / 4:00 PM)
- [ ] **Mon–Fri or Mon–Sat**? (assumed 6 days)
- [ ] Does the **college endorse this**, and can messages carry the college name? → `docs/03` §4 Phase 0
- [ ] Is there a **warden / HoD** who will act on an escalation, and how do they want to be contacted?
- [ ] What proportion of parents are on **WhatsApp**? Any without smartphones?
- [ ] Tamil script, or **Tamil written in English letters** (*tanglish*)? Ask her which parents actually read.
- [ ] Primary guardian to notify — mother, father, or both?
- [ ] Does the college have an existing **mid-day exit permission rule** worth digitising, or would this be a new rule?
- [ ] Any budget at all, even ₹500/month? Or strictly ₹0?
- [ ] Should the **student** see that her parent was notified? (Recommended: yes — transparency reduces conflict and stops the app feeling like an ambush.)

The rest of the open questions — hosting ownership, maintenance, DPDP, consent — are in **`docs/03` §9**.
