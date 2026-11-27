// React Native's Alert does nothing in a browser, so use the browser's own dialogs.
export function notify(title: string, message?: string) {
  window.alert(message ? `${title}\n\n${message}` : title);
}

export function confirm(title: string, message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
