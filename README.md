# Namma Class — Teacher Workspace

A practical class tool for a working class teacher at a girls' college in Chennai. This is **not a graded student project**: the success measure is that the teacher can trust and keep using it.

## Current build

- **Demo mode:** 60 synthetic students and local-only attendance. No real names or contacts; nothing is sent.
- **Live mode:** teacher Google sign-in and out-of-band approval, followed by a Firestore-backed class setup, two-column roster import, and explicit-save morning/evening attendance.
- **No data is seeded automatically.** Student names are written only after the teacher creates a class and confirms a roster import. Parent contacts and message sending are not implemented.
- **Saved-roll history:** morning/evening rolls are grouped by date, summarized, and expandable to inspect each recorded student status. The 75% warning is deliberately deferred until the college term dates, working-week pattern, and rule for differing AM/PM statuses are confirmed.
- **Editable calendar data:** includes Puducherry/Karaikal 2026 public-holiday defaults plus official 2026 amendments. Teachers can override those dates or add college holidays/special working days per class; these edits are stored in Firestore. This is not a full term/weekday schedule and does not calculate attendance percentages.
- **Teacher-triggered export:** prepare a saved-data snapshot and download attendance CSV or a portable JSON backup, including teacher calendar overrides. No cloud upload or restore flow is included yet.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open the Vite URL printed by the dev server (normally `http://localhost:4100`). The React app proxies `/api` requests to the local Express API on port 4101. Keep `VITE_DEMO_MODE=true` for synthetic demo work. For Firebase testing, use the teacher-owned Web app config and `VITE_DEMO_MODE=false`; never add an Admin service-account key to the app or environment.

Useful checks:

```bash
npm test
npm run build
npm run test:rules
```

The Firestore Emulator tests use a `demo-*` project ID and synthetic records only. They do not write to production Firebase.

## Install it like an app (PWA)

The production site includes a standalone install manifest, Namma Class icons, and a service worker for the static app shell. On Android/desktop, use **Install app** in the app header or the browser menu. On iPhone/iPad Safari, use **Share → Add to Home Screen**. Opening the installed icon launches without the normal browser toolbar.

The service worker caches only the application shell and static assets; it does not cache Firestore records or `/api` responses. Sign-in and attendance writes still require an internet connection, and there is no offline attendance queue. The install prompt is available only on a secure HTTPS production site (localhost for development).

## Firestore live setup

Before using class, attendance, or calendar writes, publish the reviewed `firestore.rules` from this repository. The rules allow teacher-scoped class attendance reads and teacher-only calendar overrides under the owning class. Keep the Firebase project under the teacher's account and on Spark/free; do not enable billing for this step. Environment changes must be followed by a new Vercel build.

The app stores:

- `/teachers/{uid}` — project-owner approval record, `active: true`; client writes are forbidden.
- `/classes/{classId}` — teacher-owned class metadata.
- `/classes/{classId}/students/{studentId}` — roll number, display name, active flag, creation timestamp.
- `/classes/{classId}/attendance/{dateISO}_{MORNING|EVENING}` — statuses, owner UID, and server timestamp.
- `/classes/{classId}/calendarOverrides/{dateISO}` — teacher-edited holiday/working-day classification and label for a date.

The 2026 starter calendar is based on the [official Puducherry holiday list](https://www.py.gov.in/list-government-holidays-2026) and later [government orders/corrigenda](https://py.gov.in/gos-and-notification). It is a government-holiday seed, not an authoritative college term calendar; verify it and adjust dates in the Calendar view. The list is bundled with the app and is not auto-synced. Teacher overrides are included in the JSON backup.

Roster imports accept only roll number and student name columns, cap a class at 100 active students, and require an authorization confirmation. Do not include phone numbers. See `firebase.client-notes.md` for data-handling and deployment details.

## Safety status

- Demo mode remains the safe default; Firebase is not initialized in demo mode.
- `MESSAGING_ENABLED=false`; this build intentionally has no route that can send a message.
- Absence messages remain preview-only and parent numbers are not stored.
- Before any real student data is entered, confirm institutional permission and use the teacher-owned Firebase project with the published rules.
- Tamil copy is a draft and must be reviewed by a native speaker before any live use.
- The attendance history timeline and editable 2026 Puducherry holiday data are available; percentage/75% warnings remain off until the college term, working-week pattern, and one-day AM/PM aggregation rule are confirmed. Automated/remote backup, restore, offline recovery, and pilot controls also remain future work. Current export is a teacher-triggered local download only.

## Stack

- React + Vite frontend
- Node.js + Express API (message sending remains disabled)
- Firebase client SDK (Google Auth + Firestore)
- English/Tamil parent preview templates in `shared/messages.js`
