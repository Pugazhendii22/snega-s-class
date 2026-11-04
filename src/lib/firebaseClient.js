// Firebase connection is intentionally deferred in this demo slice.
// The teacher must create and own the Firebase project before real student
// data is loaded. See firebase.client-notes.md for the safe setup sequence.
export const firebaseConfigured = false;
export const demoMode = true;

export function getFirebaseClient() {
  return null;
}
