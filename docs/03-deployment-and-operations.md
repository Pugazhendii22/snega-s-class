# Deployment & Operations — the real-deployment document

> This is the doc that matters most now. `01` says what to build. `02` says how the alert system works. **This one says whether it survives contact with a real classroom, real parents, and Indian telecom law.**
>
> Everything here assumes: **one class teacher, one class (~60 students), her own phone, no IT department, no budget approved yet.**

---

## 1. The legal reality of messaging parents in India

Read this before writing a single line of messaging code. It is the difference between a tool that works and a tool that silently fails.

### 1.1 SMS — blocked for individuals

Under **TRAI's TCCCPR 2018** (amended 2025), every commercial SMS terminating on an Indian mobile number must be sent by a **DLT-registered Principal Entity (PE)**, using a **registered 6-character sender ID (header)** and **pre-approved content templates**.

| Requirement | Detail |
|---|---|
| Who can register | A business/institution — **not an individual teacher** |
| Documents | GST certificate, PAN, Certificate of Incorporation **or** Trade Licence/Udyam, authorised signatory's Aadhaar/PAN |
| Cost | **₹5,900 one-time** DLT operator fee (incl. GST) |
| Timeline | 3–10 working days for entity + header, 1–5 days per template. Feb 2025 amendment added biometric authentication. |
| Steps | ① Entity registration → PE ID ② Header registration ③ Template registration ④ **PE–TM chain binding** to your SMS provider ⑤ URL/APK whitelisting |
| If you skip it | **Messages are silently dropped at the operator scrubber. Your gateway returns HTTP 200. You think it worked. Nobody received anything.** |
| Penalties | ₹2 lakh first violation, ₹5 lakh repeat, carrier blacklisting. DPDP violations: up to ₹250 crore. |

**Verdict:** SMS only happens if the **college** registers as the Principal Entity. That is Stage 2 — an institutional decision, not a technical one.

⚠️ **This is the single most dangerous trap in the whole project.** A "successful" send that never arrived, in a system whose entire purpose is telling parents their daughter is missing, is worse than no system at all. If you ever do use SMS, **verify delivery receipts end-to-end in the first week, with real phones, not the API response.**

### 1.2 WhatsApp — no DLT required ✅

TRAI's DLT mandate applies **only to SMS/voice terminating on Indian mobile numbers**. The WhatsApp Business Platform is exempt. This is precisely why Indian businesses use WhatsApp OTP while DLT paperwork is pending.

**Pricing as of 1 October 2026** (Meta moved from per-conversation to per-message):

| Item | Cost |
|---|---|
| Cloud API access | **Free** — no monthly Meta fee |
| Free allowance | **1,000 free service messages per business phone number per month.** Resets monthly, does not roll over. |
| Beyond 1,000 | India utility rate per delivered message (verify current rate card before committing) |
| Inbound messages from parents | **Free, always** |
| Template submission & approval | **Free** |
| Business verification | **Free**, but required for higher messaging limits |
| BSP platform (WATI, Go4whatsup, Interakt…) | **₹1,499–₹2,500/month** — *avoidable if you integrate Cloud API directly* |

**Our volume for one class, exception-only alerting:**

| Message | Volume/month |
|---|---|
| Morning absence alerts (~5/day × 25) | 125 |
| Exit-pass notifications | ~50 |
| Escalations & reminders | ~30 |
| **Total** | **~205 → comfortably inside the 1,000 free allowance** |
| Evening summaries (60 × 25 = 1,500) | ❌ **Would blow the allowance — so we do NOT send these. See §4.3.** |

### 1.3 Email — free, but low reach
Firebase Auth / SendGrid / Resend free tiers handle this at ₹0. Realistically, many parents in this demographic will not read email. Use it for the **weekly digest and formal records**, never for a same-day safety alert.

### 1.4 The Stage 0 answer — click-to-send from her own number ✅✅

**`https://wa.me/91XXXXXXXXXX?text=<url-encoded message>`**

The app composes the message; she taps a button; WhatsApp opens with the text already typed; she presses send.

| | |
|---|---|
| Cost | **₹0, forever** |
| Approvals | **None.** No Meta, no DLT, no business verification, no template review. |
| Trust | Message arrives from **her number**, which parents already have saved. Far higher trust than an unknown business sender ID. |
| Human review | **Built in.** She reads it before it goes. That is exactly what you want when the subject is someone's child. |
| Editable | She can soften or add context per parent. |
| Limit | Manual — practical up to ~20 messages/day. Which is fine, because we only message **exceptions**. |
| Limit | No delivery/read receipts back into the app (she can mark "sent" manually, or we accept the gap). |

**This is what ships first.** Not because it's a compromise, but because it is genuinely the right tool for 5 messages a day from one teacher.

---

## 2. Hosting — who pays, and where the keys live

### 🔴 Rule zero: everything must be in HER Google account, not yours

This is the most common way well-meaning side projects become disasters. If the Firebase project, the domain and the WhatsApp Business account are all under your email, then:
- The day you graduate / lose interest / change jobs, **she loses her class records.**
- She cannot reset a password, see a bill, or restore a backup.
- You become unpaid, untrained, unreplaceable support.

**Setup sequence:**
1. She creates a dedicated Google account (e.g. `classteacher.<college>@gmail.com`) — or uses her own.
2. **She** creates the Firebase project. You are added as an *Editor*, never the Owner.
3. **She** owns the WhatsApp Business account / Meta Business Portfolio.
4. **She** owns the domain and hosting account.
5. All provider API keys go in **server-side environment variables only** — never in the React bundle. Add a pre-commit secret scan.
6. Write the credentials location and recovery steps into the runbook (§8).

### Cost table — one class

| Item | Provider | Cost |
|---|---|---|
| Frontend hosting | Firebase Hosting / Cloudflare Pages | **₹0** |
| Backend (Node) | Render free tier / Railway / Fly.io | **₹0** (free tier sleeps — acceptable, see caveat) |
| Database + auth + storage | Firebase **Spark** (free) tier | **₹0** — daily reads/writes for 60 students is a rounding error |
| Cloud Functions | ⚠️ **Requires the Blaze (pay-as-you-go) plan** | ~**₹0** in practice; set a **hard budget alert at ₹200/month** |
| Domain (optional) | `.in` | **₹800–1,000/year** |
| Email sending | Resend / SendGrid free tier | **₹0** |
| WhatsApp — Stage 0 | click-to-send from her number | **₹0** |
| WhatsApp — Stage 1 | Meta Cloud API direct, no BSP | **₹0** under 1,000 msgs/month |
| **Total, Stage 0** | | **₹0 – ₹1,000/year** |
| **Total, Stage 1** | | **₹0 – ₹1,000/year** |

> ⚠️ **The Blaze caveat:** Cloud Functions cannot run on the free Spark plan. She must attach a card. This is not optional if you want scheduled escalation checks and triggers. Mitigations: set a **GCP budget alert + a programmatic budget cap**, and write Functions that do almost nothing (Firestore triggers and a couple of cron jobs are genuinely near-zero cost at this scale). Alternatively, run the scheduler inside the Node service on a free-tier host with cron — **no Blaze needed at all**. *For a first deployment, I recommend that route: it removes the credit-card requirement entirely.*

---

## 3. Her actual day with this app

Design against this. If the numbers below are wrong, the app is wrong.

| Time | What she does | Time cost |
|---|---|---|
| 8:55 | Open app → Morning Roll → tap `A` on the absentees → submit | **60 s** |
| 8:57 | Review screen: "5 parents will be notified." Check the drafted messages → **Send all** | **45 s** |
| during day | Exit pass approved on phone if a student asks | 15 s each |
| 16:00 | Evening Roll → submit. Flags anyone present in the morning but gone now. | **60 s** |
| 16:02 | Review screen: only *changed* cases get a message | **20 s** |
| Sat 18:00 | Weekly digest — automatic. She glances at it. | **0 s** |

**≈ 3 minutes a day.** Versus today: a paper sheet, a register, and 5–15 phone calls she does not have time to make.

**Design consequences:**
- 📱 **Mobile-first, one-handed, thumb-reachable.** She is standing in a classroom holding a register.
- ⌨️ **Keyboard/`P`/`A` shortcuts + swipe.** Target: 60 students in under 30 seconds.
- 🔇 **Exception-only messaging.** Never message a parent to say everything is fine. That is how notification systems get muted and abandoned.
- 🔴 **The review screen is sacred.** Nothing goes to a parent without a human seeing it first. Non-negotiable, and it's what makes Stage 0 acceptable to a nervous teacher.
- ⚡ **Under 2 seconds to first useful screen.** Cold-start on a mid-range Android over 4G.
- 🔌 **Offline-tolerant.** Mark now, sync later. A classroom dead zone must not mean a paper fallback.

---

## 4. Rollout plan — do not skip the silent pilot

A tool that messages parents about their daughters' whereabouts has **exactly one chance** to be trusted. One wrong message — *"your daughter is absent"* when she is sitting in the front row — and every parent stops believing it, and she stops using it.

### Phase 0 — Permission (before any code ships)
- [ ] **Is this official or personal?** Get the Principal's / HoD's written acknowledgement. If the college won't endorse it, you cannot honestly send messages that say *"St. X College — Attendance Alert"*, and the escalation path to a warden does not exist. **Ask this question first. It may change the design.**
- [ ] Confirm who owns the data and who is accountable if a student goes missing.
- [ ] Confirm the college's existing attendance/leave rules so the app matches reality, not an ideal.

### Phase 1 — Parent consent (Week 1–2)
- [ ] Send the consent letter (§6) home. Collect signed copies. Record `consentGiven` + `consentRecordedAt` per parent.
- [ ] Collect and **OTP-verify every parent number** at the same time — one exercise, not two.
- [ ] Record preferred language (EN/TA) and channel (WhatsApp / SMS / email).
- [ ] **Expect 5–10% non-response.** Plan for it: those parents simply don't get automated messages, and appear on her "Action needed" list. Never message a non-consenting parent.

### 🔴 Phase 2 — SILENT PILOT (Week 3–4) — the most important two weeks
The app runs fully but **sends nothing to any parent.**

Every morning she marks the roll and opens the review screen. She checks: *would this message have been right?*

- Every **false absence** (student present, marked absent) is logged and investigated.
- Every **missed absence** (student absent, no alert drafted) is logged.
- Target before going live: **≥ 99.5% accuracy over 10 consecutive days, zero false alerts on two consecutive days.**
- Meanwhile parents are told in advance: *"For the next two weeks you may receive nothing; we are testing a new system."*

> This phase also gives her the muscle memory, so go-live isn't the first time she touches the UI under pressure at 8:58 AM.

### Phase 3 — Go live, morning only (Week 5–6)
- Absence alerts only. Evening roll recorded but **no messages**.
- She reviews and sends manually every day (Stage 0 click-to-send).
- Daily 2-minute check with her: anything wrong? Anything awkward?

### Phase 4 — Add evening roll + weekly digest (Week 7–8)
### Phase 5 — Automation (Month 3+) — only if she asks for it
Move to WhatsApp Cloud API so alerts fire without her tapping. **Do not push this.** Many teachers prefer the manual gate; it keeps them in control and keeps the messages human.

### Phase 6 — Expansion
Second class → second teacher → department → college-wide (Stage 2, with college DLT registration).

---

## 4.3 Decisions that fell out of the cost model

| Decision | Why |
|---|---|
| **No "your child was present today" message** | 1,500/month destroys the free allowance and trains parents to ignore you. Silence = all is well. Say so explicitly in the consent letter. |
| **One alert per student per day, not per period** | Absent in 4 periods = **one** message. Four messages = a muted parent. |
| **Weekly digest by email or broadcast, not per-parent WhatsApp** | Volume control. |
| **Safety escalations bypass every throttle and quiet hour** | Explicit, commented rule in code. |

---

## 5. Privacy, data protection & the DPDP Act 2023

You are processing personal data of **minors or young adults**, including their whereabouts and their parents' contact details. Take this seriously — not for marks, but because a breach here is genuinely harmful.

### What you must have
| Requirement | Implementation |
|---|---|
| **Verifiable parental consent** | Signed consent letter (§6) + `consentGiven`, `consentRecordedAt`, `consentMethod` fields. No consent → no automated message, hard-blocked in the dispatch service. |
| **Data minimisation** | Collect only: name, roll no, phone, parent name/relation/phone, language, photo (optional). **Do not collect** Aadhaar, income, caste, religion, medical history, or "family circumstances" free-text. |
| **Purpose limitation** | Data used for attendance + parent notification. Nothing else. No analytics sold/shared, ever. |
| **Retention** | Message bodies deleted after **1 academic year**; aggregate attendance retained for the student's duration + 2 years; counselling/incident notes deleted on her request or at academic year end. **State the period in the consent letter.** |
| **Right to erasure** | A parent can ask for deletion. Build a **delete-my-data** function now, not later. |
| **Access control** | Firestore security rules: a teacher can only read/write **her own classes**. Parent documents readable only by the owning teacher. Never expose the collection to the client without rules. |
| **Encryption** | TLS in transit (default), Firebase encryption at rest (default). Phone numbers — consider hashing for dedupe lookups. |
| **No third-party leaks** | Do not wire in an analytics SDK. Do not send student data to an LLM API. Do not use a "free" SMS trial that resells data. |

### What this app deliberately does NOT do
- ❌ No GPS or location tracking of students.
- ❌ No monitoring of calls, chats, social media or photos outside campus.
- ❌ No recording of *who* a student was with, or any moral judgement about her life.
- ❌ No sharing of one student's record with other students or other parents.
- ❌ No public leaderboard, no shaming, no "defaulters list" circulated to parents.

### The framing that keeps this ethical (and keeps her out of trouble)
> The app enforces **transparency about attendance** — the college's legitimate interest and a parent's right to know. It does not surveil a student's private life. Once a parent has the truth, **the family decides what to do with it** — not the app, and not the college.

**A specific warning:** if a teacher begins using this to report a student's personal life to her parents, the app becomes an instrument of harm regardless of how well it's built. Mitigations that belong in the product, not just in a policy:
- Incident/counselling notes are **private and never included in any parent message** — enforce this in the message renderer, not by convention.
- Messages are **templated**. Free-text to a parent should require a deliberate, logged action.
- Everything sent is in the audit trail — including *who* composed it.

---

## 6. Parental consent letter (template)

Bilingual. Print on college letterhead, send home in Week 1. Adjust the college name and details.

> **STUDENT ATTENDANCE NOTIFICATION SYSTEM — PARENTAL CONSENT**
>
> Dear Parent/Guardian,
>
> The college is introducing an attendance notification facility for the students of **\<Class/Section\>**. Its only purpose is to help you know, on the same day, whether your ward is present in college.
>
> **What you will receive:**
> - A message on **WhatsApp / SMS / email** on the day your ward is marked **absent** without an approved leave.
> - A message if your ward **leaves the campus during college hours** with permission, and again when she returns.
> - A summary of attendance and internal marks **once a week**.
>
> **What you will NOT receive:** a message on days your ward is present. **No message means all is well.**
>
> **What we collect:** your ward's name, roll number, and your name, relationship and contact number. Nothing else. We do not track location, and we do not monitor students outside college hours.
>
> **Your reply matters.** If you receive an absence alert and you were **not** aware of it, please reply **ALERT** immediately. The class teacher will call you.
>
> **How long we keep it:** message records are deleted after one academic year. You may withdraw consent or request deletion of your details at any time by contacting the class teacher.
>
> ☐ **I consent** to receiving these messages on the number below.
> ☐ **I do not consent.**
>
> Parent/Guardian name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Relationship: \_\_\_\_\_\_\_\_\_\_\_
> WhatsApp-enabled mobile: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Alternate: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
> Preferred language: ☐ English ☐ தமிழ்
> Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Date: \_\_\_\_\_\_\_\_\_\_\_\_
>
> *(தமிழ் வடிவம் மறுபுறம் / Tamil version overleaf)*

---

## 7. Failure modes — and the safeguard for each

| # | Failure | Blast radius | Safeguard |
|---|---|---|---|
| 1 | 🔴 **False absence** — "your daughter is missing" when she's in class | Trust destroyed permanently | Review screen before send · 60-second undo · **silent pilot** · one-tap correction that auto-drafts an apology message |
| 2 | 🔴 **Missed absence** — alert never fires | The exact harm we exist to prevent | Every absentee appears on a "Notifications due" list with an explicit sent/failed/skipped state. **Never a silent failure.** |
| 3 | 🔴 **Wrong parent number** | Message to a stranger about a minor | OTP verification at setup · re-verify each semester · student can never edit · every change logged with old/new value |
| 4 | 🟠 **SMS silently dropped** (if Stage 2, no DLT binding) | Total silent failure | Delivery-receipt verification with real phones in week 1 · never trust HTTP 200 |
| 5 | 🟠 **Parent spam → muted** | System ignored when it matters | Exception-only · one message per student per day · dedupe table · quiet hours |
| 6 | 🟠 **Teacher on leave / phone lost** | Roll not taken, no alerts | Any day with no roll by 10:00 AM → notify the HoD/backup teacher · she designates a substitute with temporary access |
| 7 | 🟠 **She leaves the college** | Orphaned system, locked data | Full export (§8) · **her** account owns everything · written runbook · documented handover |
| 8 | 🟡 **Free-tier host sleeps** | First tap of the day takes 10 s | Acceptable; add a 5-min uptime ping, or move to a ₹400/mo always-on instance if it annoys her |
| 9 | 🟡 **Firebase bill shock** | Card charged unexpectedly | Stay on Spark where possible · hard budget cap · alert at ₹200 |
| 10 | 🟡 **A student forges the leave link** | Unauthorised leave approval | Teacher must approve; the link only *requests*. Per-student signed token, expiring, single-use. |
| 11 | 🟡 **Parent objects / complains** | Conflict for the teacher | Consent is opt-in and revocable · every message carries "to stop these, contact the office" · the audit trail proves what was sent and when |
| 12 | 🔴 **A student is genuinely missing** | Life-safety | ⚠️ **The app does not solve this and must never claim to.** It provides *timely information to parents and a timestamped record*. The escalation path (teacher → warden → HoD → parents → police) is a **college protocol**; the app only accelerates step 1. Write this limitation down plainly so nobody over-trusts it. |

---

## 8. Backup, export & handover

**She must be able to walk away with everything, at any time, in open formats.** Build this in Phase 1 — it's a day of work and it's the difference between a tool and a trap.

| What | Format | Frequency |
|---|---|---|
| Full class data dump | JSON (Firestore export) | Nightly → her Google Drive |
| Attendance register | XLSX, college's own column format | On demand + end of month |
| Attendance statement per student | PDF | On demand |
| CIA mark sheet | PDF/XLSX | Per cycle |
| Message audit trail | CSV | On demand |
| Parent contact list | XLSX (with consent status + verified date) | On demand |

**Runbook — write it, print it, keep it with her:**
1. Where the Firebase project lives (account, project ID).
2. Where the backend is hosted and how to redeploy it.
3. Where every secret is stored and who can rotate it.
4. How to restore from the nightly backup.
5. How to disable all outgoing messages in one action ← **the panic switch. Build it. Test it.**
6. Who to call when it breaks, and what she does in the meantime (paper fallback — keep the register for the first two months).

> **The panic switch deserves emphasis.** The day something goes wrong, she needs one button that stops every message immediately, without finding a developer. A single Firestore flag — `messagingEnabled: false` — checked at the top of the dispatch service, surfaced as a big red toggle in settings.

---

## 9. Open questions — answers needed before writing code

**About her and the college**
1. How many students, and is she class teacher for **one** class or several?
2. Has the college agreed to this, or is she doing it independently? *(Determines whether messages can carry the college name, and whether an escalation path to a warden exists at all.)*
3. Does the college already have any system — a register, an ERP, a parent WhatsApp group? What must this replace or coexist with?
4. What are the **actual** roll times, period count, and working days?
5. Is there a warden / HoD who would accept escalation, and how do they want to be contacted?
6. What is the college's existing leave and mid-day-exit rule? *(Match reality, not an ideal.)*

**About the parents**
7. What proportion have smartphones with WhatsApp? Any without?
8. Tamil, English, or both? Is Tamil script comfortable for the parents, or Tamil-in-English-letters (*tanglish*) better?
9. Who is the primary guardian to notify — mother, father, or both?

**About money and maintenance**
10. Is there **any** budget, even ₹500/month? Or strictly ₹0?
11. Can the college be persuaded to register for DLT or fund a WhatsApp BSP later?
12. Who maintains this after you hand it over — you, her, a junior student, nobody? **Be honest; the answer changes how simple the architecture must be.**
13. How technical is she? Comfortable with a Google account, Firebase console, and redeploying — or should she never see any of it?

**About scope**
14. Which of the five MVP features does *she* say she wants most? Build that one first, and let her feel it working in week 2.

---

## 10. Immediate next steps

- [ ] Get answers to §9 — especially #2 (college endorsement) and #12 (maintenance).
- [ ] Build the **panic switch** and **test/dry-run mode** before anything that can send.
- [ ] Build the **silent pilot mode** (records everything, sends nothing) as a first-class feature, not a hack.
- [ ] Scaffold: React PWA + Node + Firebase, her account as owner.
- [ ] Ship the morning roll + click-to-send. Let her use it for a fortnight before adding anything else.
