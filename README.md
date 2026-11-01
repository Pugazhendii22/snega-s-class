# Class Teacher Assistant
### A real tool for one real class teacher at a girls' college in Chennai

---

## ⚠️ This is NOT a college project

There is no evaluator, no viva, no submission date, no "marks for architecture". There is **one teacher who has to use this on a Monday morning with 60 students and a bad Wi-Fi connection**, and 60 parents who will receive real messages about real children.

That single fact changes every design decision. The rules are now:

| | Student project | This |
|---|---|---|
| Success means | Evaluator is impressed | **She still uses it in month 4** |
| Data | Synthetic, fake names | **Real minors. Real phone numbers.** |
| Failure mode | Lose marks | **A wrong message goes to 60 parents** |
| Messaging | Mock provider is fine | **Must actually deliver, legally** |
| Cost | "Free tier is enough" | **Someone pays the bill every month** |
| Maintenance | Ends at submission | **Who fixes it when it breaks at 8:50 AM?** |
| Handover | Never | **She will change classes. Someone inherits this.** |

Everything in this repo is written against the right-hand column.

---

## The two hard constraints that shaped this

### 1. 🚫 You cannot legally send automated SMS in India as an individual

Under TRAI's TCCCPR 2018, any SMS terminating on an Indian mobile number must come from a **DLT-registered Principal Entity** with a registered sender ID and pre-approved content templates. Registration requires GST certificate / PAN / Certificate of Incorporation or Trade Licence, plus an authorised signatory's ID — and a **one-time ₹5,900** operator fee. Unregistered messages are **silently dropped at the operator level**, even when the gateway returns HTTP 200.

**A teacher cannot register. Only the college can.** Penalties for non-compliance reach ₹2 lakh (first violation) and ₹5 lakh (repeat), and DPDP Act violations go far higher.

➡️ **SMS is off the table unless the college administration becomes the sender.**

### 2. ✅ WhatsApp does NOT require DLT

TRAI's DLT rules apply only to SMS. The WhatsApp Business Platform is exempt — which is exactly why Indian businesses use it as a fallback while DLT paperwork is pending.

Since **1 October 2026** Meta moved to per-message billing: each WhatsApp Business phone number gets **1,000 free service messages per month**, then the India utility rate applies. API access itself is free; a BSP platform (WATI, Go4whatsup, etc.) typically adds **₹1,499–₹2,500/month**.

➡️ **Our exception-only alert volume is roughly 150–250 messages/month for one class. That fits inside the 1,000 free allowance.**

---

## The strategy: three stages, each one usable on its own

This is the most important idea in the project. **Each stage works standalone.** She is never waiting for stage 3 to get value.

### 🟢 Stage 0 — Zero cost, zero approvals, live this week
**Click-to-send from her own WhatsApp number.**

When she marks the morning roll, the app generates a perfect, pre-written Tamil + English message for each absentee and gives her a **"Send on WhatsApp"** button. Tapping it opens WhatsApp with the message already typed — she just presses send.

- ✅ No API. No DLT. No Meta approval. No monthly bill. **₹0 forever.**
- ✅ Messages come from **her number**, so parents recognise and trust them.
- ✅ She can edit before sending — a human always reviews. That is a *feature*, not a limitation, when the recipient is a parent.
- ✅ Works on 5 absentees a day in about 30 seconds.
- ⚠️ Does not scale past ~20 messages (which is why we alert on **exceptions only**, never "your child was present today" × 60).

Plus: **weekly email digest** to parents (free via Firebase/SendGrid) and a **WhatsApp Broadcast list** for whole-class notices.

### 🟡 Stage 1 — Automated, needs Meta setup
**WhatsApp Cloud API, direct with Meta** (no BSP, so no ₹1,499/month platform fee).
Needs: a dedicated phone number, a Facebook Business Portfolio, business verification, and Meta-approved message templates. ~1–2 weeks of paperwork.
Then absence alerts fire **automatically within 10 seconds** of her marking the roll — including the evening roll and the escalation ladder.

### 🔴 Stage 2 — Only if the college adopts it
The **college** registers as the DLT Principal Entity and/or funds a BSP. Then SMS becomes the safety-critical channel (works on non-smartphones, works when data is down), and this scales to all classes.

> **Recommendation:** build Stage 0 *properly*, architected so Stage 1 is a provider swap, not a rewrite. Do not build Stage 1 first — the paperwork will stall and she'll have nothing in her hands.

---

## What actually ships (the MVP)

Ruthlessly cut. These five, working well, beat twenty working badly.

| # | Feature | Why it survives the cut |
|---|---|---|
| 1 | **Morning & Evening Roll** | The two checkpoints. Morning catches who never came; evening catches who came and left. Neither alone catches the case that started this. |
| 2 | **🛡️ Parent absence alert (click-to-send)** | The whole point. Instant, accurate, in the parent's language, from a number they recognise. |
| 3 | **Verified parent contacts** | The system is worthless if the number on file is a friend's. OTP-verify at setup, re-verify each semester, teacher-only editing. |
| 4 | **Attendance % and the 75% warning** | The other thing she is legally on the hook for. Warn in week 3, not week 12. |
| 5 | **Full export & backup** | Her data must never be trapped in someone's Firebase project. One-click Excel/PDF, automatic nightly backup. |

Deliberately **deferred**: mid-day exit passes, escalation ladder automation, CIA marks, notice board read receipts, incidents/counselling log, QR attendance, offline sync, prediction, voice attendance, event reports. Each is documented in `docs/01` with its rationale, and the architecture leaves room for them — but none ships before the five above are *boring and reliable*.

---

## The non-negotiables for a real deployment

1. **A human always reviews before a parent is messaged** (Stage 0 enforces this by design; Stage 1 keeps it as a toggle).
2. **No message ever says anything judgemental.** Facts, time, two clear actions. Nothing about boyfriends, nothing about character. A shaming message will get this switched off within a week — and it would be the wrong thing to do to a 19-year-old anyway.
3. **Written parental consent before the first message.** Template in `docs/03` §6. No consent, no message.
4. **DPDP Act 2023 compliance** — verifiable parental consent for minors, data minimisation, a stated retention period, and the ability to delete on request. See `docs/03` §5.
5. **She can leave.** Full export, always, in open formats. Documented handover. This is not a trap.
6. **Offline-tolerant.** She must be able to mark a full period with no signal and have it sync later.
7. **Test mode.** A dry-run that shows exactly which parents *would* get which message, before anything real goes out. **Build this first, not last.**

---

## Documents

| # | File | Contents |
|---|---|---|
| 1 | [`docs/01-problems-and-plan.md`](docs/01-problems-and-plan.md) | Full problem analysis, feature tiers with cut rationale, architecture, Firestore data model, build order |
| 2 | [`docs/02-parent-alert-system.md`](docs/02-parent-alert-system.md) | 🛡️ The flagship module — two-roll design, message flows, escalation ladder, verified contacts, exit passes, templates in EN/TA |
| 3 | [`docs/03-deployment-and-operations.md`](docs/03-deployment-and-operations.md) | **NEW — the real-deployment doc.** Hosting, actual monthly cost, WhatsApp/SMS legal pathway step-by-step, DPDP & privacy, parental consent letter, rollout plan, backup & handover, failure modes |

---

## Stack

- **Frontend:** React (Vite) + Tailwind — installable PWA. She uses this standing up, one-handed, in a classroom, on her own phone.
- **Backend:** Node/Express — message rendering, exports, scheduled jobs, and keeping every API key server-side.
- **Firebase:** Auth · Firestore (with offline persistence) · Storage · Cloud Functions. Free Spark tier covers one class comfortably.
- **Messaging:** one `MessageProvider` interface → `ClickToSend` (Stage 0) · `Email` · `WhatsAppCloud` (Stage 1) · `Sms` (Stage 2).
- **i18n:** English + Tamil. Tamil is not optional — it decides whether parents actually read these.

---

## Status

🟡 **Design.** Awaiting answers to the open questions in `docs/03` §9 before writing code.
