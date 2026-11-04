import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoApp } from './App.jsx';
import './styles.css';
import { initializePwaInstallTracking } from './lib/pwaInstall.js';

initializePwaInstallTracking();
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch((error) => console.warn('Namma Class app-shell caching could not start.', error));
  }, { once: true });
}

const FirebaseGate = lazy(() => import('./FirebaseGate.jsx'));
const App = import.meta.env.VITE_DEMO_MODE === 'false' ? FirebaseGate : DemoApp;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div className="bootstrap-loading">Loading Namma Class…</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
);
