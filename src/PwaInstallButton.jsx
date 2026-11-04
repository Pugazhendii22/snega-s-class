import React, { useEffect, useState } from 'react';
import { promptPwaInstall, subscribeToPwaInstall } from './lib/pwaInstall.js';

export default function PwaInstallButton({ compact = false }) {
  const [installState, setInstallState] = useState({ canPrompt: false, installed: false });
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeToPwaInstall(setInstallState), []);

  async function handleInstall() {
    setError('');
    if (!installState.canPrompt) {
      setShowHelp(true);
      return;
    }
    try {
      const choice = await promptPwaInstall();
      if (choice?.outcome === 'unavailable') setShowHelp(true);
    } catch {
      setError('Your browser could not open the install prompt. Use the browser menu instructions below.');
      setShowHelp(true);
    }
  }

  return (
    <>
      <button
        className={`pwa-install-button${compact ? ' compact' : ''}`}
        type="button"
        onClick={handleInstall}
        disabled={installState.installed}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">⇩</span> {installState.installed ? 'App installed' : 'Install app'}
      </button>
      {showHelp && (
        <div className="pwa-install-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <section
            className="pwa-install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === 'Escape') setShowHelp(false); }}
          >
            <button className="pwa-dialog-close" type="button" onClick={() => setShowHelp(false)} aria-label="Close install instructions">×</button>
            <span className="live-eyebrow">NAMMA CLASS · APP INSTALL</span>
            <h2 id="pwa-install-title">Add Namma Class to your device</h2>
            <p>Install it from your browser to open it in its own app window and add it to your home screen.</p>
            <ol>
              <li><strong>Android · Chrome:</strong> open the ⋮ menu, then choose <em>Install app</em> or <em>Add to Home screen</em>.</li>
              <li><strong>iPhone/iPad · Safari:</strong> tap <em>Share</em>, then <em>Add to Home Screen</em>.</li>
              <li><strong>Desktop · Chrome/Edge:</strong> use the install icon in the address bar or choose <em>Install Namma Class</em> from the browser menu.</li>
            </ol>
            {error && <p className="pwa-install-error" role="alert">{error}</p>}
            <div className="pwa-offline-note"><strong>Internet required:</strong> the app shell can reopen, but sign-in and Firestore attendance need a connection. Attendance is not queued offline.</div>
            <button className="live-primary-button" type="button" onClick={() => setShowHelp(false)}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}
