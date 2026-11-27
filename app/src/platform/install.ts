// In the real Android/iPhone app there is nothing to install.
export type InstallState = { show: boolean; canPrompt: boolean; isIOS: boolean; install: () => void; dismiss: () => void };

export function useInstallPrompt(): InstallState {
  return { show: false, canPrompt: false, isIOS: false, install: () => {}, dismiss: () => {} };
}
