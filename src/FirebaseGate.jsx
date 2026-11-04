import React, { useEffect, useState } from 'react';
import FirestoreWorkspace from './FirestoreWorkspace.jsx';
import {
  firebaseConfigured,
  isApprovedTeacher,
  signInTeacherWithGoogle,
  signOutTeacher,
  watchTeacherAuth,
} from './lib/firebaseClient.js';

function describeAuthError(error) {
  if (error?.code === 'auth/unauthorized-domain') {
    return 'This preview domain is not authorized by Firebase. Test from localhost or add this exact hostname under Authentication → Settings → Authorized domains.';
  }
  if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
    return 'The Google sign-in window was blocked or closed. Allow popups and try again.';
  }
  return error?.message || 'Firebase sign-in could not be completed.';
}

function GateCard({ eyebrow, title, children }) {
  return (
    <main className="firebase-gate">
      <section className="firebase-gate-card" aria-live="polite">
        <div className="firebase-gate-brand"><span className="firebase-gate-mark">n</span><strong>namma class</strong></div>
        <div className="firebase-gate-eyebrow">{eyebrow}</div>
        <h1 className="firebase-gate-title">{title}</h1>
        <div className="firebase-gate-copy">{children}</div>
      </section>
    </main>
  );
}

export default function FirebaseGate() {
  const [session, setSession] = useState({ status: 'loading', user: null, error: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured) {
      setSession({ status: 'config-error', user: null, error: 'Firebase Web app configuration is incomplete.' });
      return undefined;
    }

    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = watchTeacherAuth((user) => {
        if (!active) return;
        if (!user) {
          setSession({ status: 'signed-out', user: null, error: '' });
          return;
        }

        setSession({ status: 'checking', user, error: '' });
        isApprovedTeacher(user)
          .then((approved) => {
            if (active) setSession({ status: approved ? 'approved' : 'pending', user, error: '' });
          })
          .catch((error) => {
            if (active) setSession({ status: 'error', user, error: describeAuthError(error) });
          });
      }, (error) => {
        if (active) setSession({ status: 'error', user: null, error: describeAuthError(error) });
      });
    } catch (error) {
      setSession({ status: 'error', user: null, error: describeAuthError(error) });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (session.status === 'config-error') {
    return <GateCard eyebrow="SETUP REQUIRED" title="Firebase config is incomplete"><p>{session.error} Keep demo mode enabled until all Web app values are set.</p></GateCard>;
  }

  if (session.status === 'loading' || session.status === 'checking') {
    return <GateCard eyebrow="TEACHER WORKSPACE" title="Checking access"><p>Verifying the teacher account and its approval record…</p></GateCard>;
  }

  async function handleSignIn() {
    setBusy(true);
    setSession((current) => ({ ...current, error: '' }));
    try {
      await signInTeacherWithGoogle();
    } catch (error) {
      setSession((current) => ({ ...current, error: describeAuthError(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOutTeacher();
      setSession({ status: 'signed-out', user: null, error: '' });
    } catch (error) {
      setSession((current) => ({ ...current, error: describeAuthError(error) }));
    } finally {
      setBusy(false);
    }
  }

  async function recheckApproval() {
    if (!session.user) return;
    setSession((current) => ({ ...current, status: 'checking', error: '' }));
    try {
      const approved = await isApprovedTeacher(session.user);
      setSession({ status: approved ? 'approved' : 'pending', user: session.user, error: '' });
    } catch (error) {
      setSession((current) => ({ ...current, status: 'error', error: describeAuthError(error) }));
    }
  }

  if (session.status === 'signed-out' || !session.user) {
    return (
      <GateCard eyebrow="TEACHER-ONLY SIGN-IN" title="Welcome to Namma Class">
        <p>Sign in with the teacher’s Google account. Only an account explicitly approved for this class can continue.</p>
        {session.error && <div className="firebase-gate-error" role="alert">{session.error}</div>}
        <button className="firebase-gate-button" type="button" onClick={handleSignIn} disabled={busy}>
          {busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <p className="firebase-gate-note">No student or parent data is written by this sign-in screen.</p>
      </GateCard>
    );
  }

  if (session.status === 'pending') {
    return (
      <GateCard eyebrow="ACCOUNT APPROVAL REQUIRED" title="This account is not approved yet">
        <p>Google sign-in succeeded, but there is no active teacher approval for this account. The project owner must create <code>teachers/{session.user.uid}</code> with <code>active: true</code>.</p>
        <div className="firebase-gate-uid"><span>Teacher UID</span><code>{session.user.uid}</code></div>
        <div className="firebase-gate-actions">
          <button className="firebase-gate-button" type="button" onClick={recheckApproval} disabled={busy}>Check approval again</button>
          <button className="firebase-gate-secondary" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>
        </div>
        <p className="firebase-gate-note">No roster or attendance data is accessible until the project owner approves this account.</p>
      </GateCard>
    );
  }

  if (session.status === 'error') {
    return (
      <GateCard eyebrow="FIREBASE ACCESS CHECK" title="Couldn’t verify teacher access">
        <p>The Google sign-in completed, but Firestore could not confirm this account’s approval. Make sure the reviewed Firestore rules are published, then retry.</p>
        <div className="firebase-gate-uid"><span>Teacher UID</span><code>{session.user.uid}</code></div>
        <div className="firebase-gate-error" role="alert">{session.error}</div>
        <div className="firebase-gate-actions">
          <button className="firebase-gate-button" type="button" onClick={recheckApproval} disabled={busy}>Try again</button>
          <button className="firebase-gate-secondary" type="button" onClick={handleSignOut} disabled={busy}>Sign out</button>
        </div>
      </GateCard>
    );
  }

  return <FirestoreWorkspace user={session.user} onSignOut={handleSignOut} />;
}
