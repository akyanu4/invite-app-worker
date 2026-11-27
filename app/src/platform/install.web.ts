import { useEffect, useState } from 'react';

export type InstallState = { show: boolean; canPrompt: boolean; isIOS: boolean; install: () => void; dismiss: () => void };

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const KEY = 'invite.install.dismissed';
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  // Chrome on Android fires this when the site can be installed; keep it for the Install button.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    listeners.forEach((l) => l());
  });
}

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt(): InstallState {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android/.test(ua);
  const canPrompt = !!deferred;
  const show = !dismissed && !isStandalone() && (canPrompt || isMobile);

  return {
    show,
    canPrompt,
    isIOS,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      force((n) => n + 1);
    },
    dismiss: () => {
      try {
        localStorage.setItem(KEY, '1');
      } catch {}
      setDismissed(true);
    },
  };
}
