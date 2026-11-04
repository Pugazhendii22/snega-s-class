let deferredInstallPrompt = null;
let installed = false;
let initialized = false;
const subscribers = new Set();

function stateSnapshot() {
  return { canPrompt: Boolean(deferredInstallPrompt), installed };
}

function publish() {
  const state = stateSnapshot();
  for (const subscriber of subscribers) subscriber(state);
}

export function initializePwaInstallTracking() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  installed = Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    publish();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredInstallPrompt = null;
    publish();
  });

  const displayMode = window.matchMedia?.('(display-mode: standalone)');
  const handleDisplayModeChange = (event) => {
    installed = event.matches || window.navigator.standalone === true;
    publish();
  };
  if (displayMode?.addEventListener) displayMode.addEventListener('change', handleDisplayModeChange);
  else displayMode?.addListener?.(handleDisplayModeChange);
}

export function subscribeToPwaInstall(subscriber) {
  initializePwaInstallTracking();
  subscribers.add(subscriber);
  subscriber(stateSnapshot());
  return () => subscribers.delete(subscriber);
}

export async function promptPwaInstall() {
  if (!deferredInstallPrompt) return { outcome: 'unavailable' };
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  publish();
  await promptEvent.prompt();
  const result = await promptEvent.userChoice;
  if (result?.outcome === 'accepted') installed = true;
  publish();
  return result;
}
