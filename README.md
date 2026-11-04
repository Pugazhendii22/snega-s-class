# Namma Class — Teacher Workspace

A practical class tool for a working class teacher at a girls' college in Chennai. This is **not a graded student project**: the success measure is that the teacher can trust and keep using it.

## Current build

**Phase 1 slice: attendance roll + guarded parent-message previews.** The current app is a local demo with 60 synthetic students. It has no real student/parent records, no Firebase SDK/project attached, and no message-send endpoint. Parent text is preview-only; WhatsApp is not connected. Do not put real student data into demo mode.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Open the Vite URL printed by the dev server (normally `http://localhost:4100`). The React app proxies `/api` requests to the local Express API on port 4101. The small Node launcher starts both without an extra process-manager dependency. Local attendance drafts are stored in this browser's local storage and are synthetic demo records only.

Useful checks:

```bash
npm test
npm run build
```

## Safety status

- `VITE_DEMO_MODE=true` by default; Firebase is not initialized in demo mode.
- `MESSAGING_ENABLED=false`; this build intentionally has no route that can send a message.
- The preview generator uses neutral language and makes no claim about a student's whereabouts.
- Moving to real data requires a Firebase project owned by the teacher, teacher-only authentication, reviewed Firestore rules, written consent, verified parent contacts, and a supervised silent pilot. See `docs/03-deployment-and-operations.md`.
- Tamil copy is a draft and must be reviewed by a native speaker before any live use.

## Stack

- React + Vite frontend
- Node.js + Express API
- Firebase client scaffold (Auth + Firestore with persistent local cache); not yet connected
- English/Tamil parent preview templates in `shared/messages.js`

## Planned MVP

1. Morning and evening roll
2. Parent absence alert, click-to-send only after all safety gates pass
3. Verified parent contact and written-consent workflow
4. Attendance percentage and 75% warning board
5. Export, backup, and panic switch

The remaining operations, DPDP/privacy and rollout decisions are documented in `docs/01-problems-and-plan.md`, `docs/02-parent-alert-system.md`, and `docs/03-deployment-and-operations.md`.
