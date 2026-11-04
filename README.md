# Namma Class — Teacher Workspace

A practical class tool for a working class teacher at a girls' college in Chennai. This is **not a graded student project**: the success measure is that the teacher can trust and keep using it.

## Current build

- **Demo mode:** 60 synthetic students and local-only attendance. No real names or contacts; nothing is sent.
- **Live mode:** teacher Google sign-in and out-of-band approval, followed by a Firestore-backed class setup, two-column roster import, and explicit-save morning/evening attendance.
- **No data is seeded automatically.** Student names are written only after the teacher creates a class and confirms a roster import. Parent contacts and message sending are not implemented.

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

## Firestore live setup

Before using class or attendance writes, publish the reviewed `firestore.rules` from this repository. The latest local rules add teacher-only class listing and the nested class-attendance path, including safe reads for rolls that have not been created yet. Keep the Firebase project under the teacher's account and on Spark/free; do not enable billing for this step. Environment changes must be followed by a new Vercel build.

The app stores:

- `/teachers/{uid}` — project-owner approval record, `active: true`; client writes are forbidden.
- `/classes/{classId}` — teacher-owned class metadata.
- `/classes/{classId}/students/{studentId}` — roll number, display name, active flag, creation timestamp.
- `/classes/{classId}/attendance/{dateISO}_{MORNING|EVENING}` — statuses, owner UID, and server timestamp.

Roster imports accept only roll number and student name columns, cap a class at 100 active students, and require an authorization confirmation. Do not include phone numbers. See `firebase.client-notes.md` for data-handling and deployment details.

## Safety status

- Demo mode remains the safe default; Firebase is not initialized in demo mode.
- `MESSAGING_ENABLED=false`; this build intentionally has no route that can send a message.
- Absence messages remain preview-only and parent numbers are not stored.
- Before any real student data is entered, confirm institutional permission and use the teacher-owned Firebase project with the published rules.
- Tamil copy is a draft and must be reviewed by a native speaker before any live use.
- Attendance percentage/75% history, export/backup, offline recovery, and pilot controls remain future work.

## Stack

- React + Vite frontend
- Node.js + Express API (message sending remains disabled)
- Firebase client SDK (Google Auth + Firestore)
- English/Tamil parent preview templates in `shared/messages.js`
