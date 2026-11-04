# Firebase setup and integration status

The teacher reports that the teacher-owned Firebase project, Web app, and Firestore database have been created. Keep the project ID and web config in local environment settings, not committed to the public repository. The React app is **not connected to it yet**: the UI remains in demo mode, attendance still uses browser local storage, and there is no sign-in UI or Firestore read/write flow.

## Safe connection sequence

1. In Firebase Console, enable the teacher's chosen sign-in provider. Google sign-in is the recommended default for a single teacher using her own Google account.
2. Copy the Web app configuration from **Project settings → General → Your apps** into a local, ignored `.env`; do not commit `.env`. Firebase Web config is client config, not an admin credential. Never put a service-account JSON/private key in the browser app or GitHub.
3. Provision `/teachers/{uid}` out-of-band with `active: true` for the teacher's authenticated UID. Client rules intentionally reject unprovisioned accounts.
4. Review `firestore.rules` against the final data model and run `npm run test:rules` (the local Firestore Emulator uses only a `demo-*` project ID) before `VITE_DEMO_MODE=false` or importing real class data. Current rules are still a starter baseline, not a production security audit.
5. Keep parent messaging disabled. Firebase setup does not authorize sending messages; consent, contact verification, dedupe, quiet hours, review, and pilot gates remain required.

## SDK/toolchain note

The app uses Firebase JS SDK 12.19.0 to remain compatible with the project's Node 20/22 toolchains. A narrow npm override pins only the Firestore package's Node-only `@grpc/grpc-js` dependency to a patched release to clear current audit advisories. Re-run `npm audit`, production build, and browser-bundle checks when updating Firebase; remove the override once upstream Firestore accepts a patched gRPC range.
