# Firebase setup notes — not connected yet

The current UI is a local demo. Do not create or paste credentials into this repo until the teacher has created and owns the Firebase project.

1. Enable Email/Password authentication for the teacher only.
2. Create a Firestore database and provision the teacher's `/teachers/{uid}` document out-of-band with `active: true`.
3. Review `firestore.rules` against the final data model before deploying. The current rules are a starter deny-by-default baseline, not a production security audit.
4. Copy the web app config into a local `.env` (never commit it); set `VITE_DEMO_MODE=false` only after authentication and rules are tested.
5. Test with synthetic accounts and Firestore Emulator before importing any real class data.

Do not enable parent messaging just because Firebase is configured. Messaging needs independent consent, contact-verification, dedupe, silent-pilot, review, and panic-switch gates.
