# Firebase client and Firestore status

The React app now uses the teacher-owned Firebase Web app for Google sign-in and an approval gate. Approved teachers reach a Firestore-backed class/roster/attendance workspace. The public Web configuration belongs in build-time `VITE_FIREBASE_*` variables; these values are client-visible by design. Never put a Firebase Admin service-account key in the browser, Vercel, or GitHub.

## Project ownership and cost guardrails

Keep the Firebase project under the teacher/friend's Google account and on the Spark/free plan; this roster/attendance slice does not require enabling billing. The Firestore location has not been independently verified from the app. If choosing a location for a database not yet created, Mumbai (`asia-south1`) was recommended if offered; an existing database's location should be checked in Console rather than recreated. Do not enable paid billing or request Google passwords/service-account keys for this work.

## Live data model

- `/teachers/{uid}` — provisioned out-of-band by the project owner with `active: true`. Client writes are denied, so an account cannot self-approve.
- `/classes/{classId}` — teacher-owned class metadata (`teacherId`, `name`, `section`, `yearLabel`, `active`, `createdAt`). The rules allow a narrowly defined create only; class updates/deletes are not available yet.
- `/classes/{classId}/students/{studentId}` — roll number, display name, active flag, and creation timestamp. Rules reject extra fields (including contact details) and deny edits/deletes until a reviewed roster-maintenance flow exists. The explicit roster-import flow accepts only two CSV columns, uses a stable roll-derived document ID, and caps a class at 100 active students.
- `/classes/{classId}/attendance/{dateISO}_{MORNING|EVENING}` — one morning or evening roll per class/date. Writes use server timestamps and only occur when the teacher presses **Save roll**.
- `/classes/{classId}/calendarOverrides/{dateISO}` — a teacher-edited holiday/working-day classification and label. The app bundles editable 2026 Puducherry/Karaikal public-holiday defaults and stores only teacher overrides in this subcollection; no automatic sync is performed.
- `/classes/{classId}/attendanceSettings/percentage` — class-scoped threshold settings with term dates, complete-tracking start date, ordinary weekdays, explicit morning/evening rule, leave treatment, and teacher confirmation that the term calendar was checked. No student or parent contact fields are stored here.

No student records are seeded automatically. No parent contacts, message sends, or automatic alerts are configured. The live workspace allows a teacher-only, unsent draft preview based solely on a complete saved roll; sending remains disabled.

## Before enabling the live attendance workspace

1. Review and publish the current `firestore.rules` to the teacher-owned Firebase project (Firebase Console → Firestore Database → Rules, confirm the selected project, replace with this file, then Publish). In addition to teacher self-read/approval rules, the rules include teacher-only class listing, strict class/roster schemas, nested attendance reads/writes, calendar overrides, and validated owner-only attendance percentage settings. Publish before loading or saving those settings.
2. Run `npm test`, `npm run build`, and `npm run test:rules`. The Firestore Emulator suite uses only `demo-namma-class-rules` and synthetic records; it does not access production Firebase.
3. Set all `VITE_FIREBASE_*` values from the teacher-owned Firebase Web app and set `VITE_DEMO_MODE=false` for the intended Vercel environment. Build a new deployment after changing environment variables.
4. In the Firebase Console, provision the approved teacher document out-of-band. The Console is sufficient; an Admin SDK/service-account key is not needed for this manual step.
5. Create the class and import a roster only after confirming institutional permission to store those student names in the teacher-owned project. Do not include parent phone numbers in roster CSV.

## PWA install and network boundary

The app has a standalone manifest, generated home-screen icons, and a production-only service worker. The worker caches the app shell and static same-origin assets only; it skips `/api/` and does not intercept Firebase's cross-origin Auth/Firestore requests. A cached shell is not offline attendance: sign-in and Firestore reads/writes still need internet, and there is no offline write queue or conflict resolution.

## Known limits of this first Firestore slice

- No offline write queue or conflict-resolution flow.
- No class archive, student deletion, or class deletion (by design; rules deny deletion).
- Saved-roll history groups AM/PM rolls by date. A 75% review now exists but is gated: the teacher must configure the real term range, the first complete tracking date, ordinary weekdays, expected session/day rule, leave treatment, and confirm the full college calendar. It uses Puducherry 2026 holiday defaults plus class overrides; this is not a complete college calendar. For either/both session rules, both AM and PM rolls must exist on each working day. Any missing required roll or student status withholds all percentages rather than treating missing data as absence. Review the result against college policy before acting.
- Teacher-triggered CSV and versioned JSON v2 downloads are available. CSV contains attendance; JSON includes class/roster/saved attendance, calendar overrides, and percentage settings, but not the bundled holiday defaults. Downloads are local only, not automated cloud backups; there is no restore workflow yet. Store files only in an approved, access-controlled location.
- Parent messaging remains disabled; consent/contact verification, human review, deduplication, quiet hours, silent pilot, and a tested panic switch remain separate launch gates.
