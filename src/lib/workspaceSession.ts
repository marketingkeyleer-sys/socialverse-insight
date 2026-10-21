// Only navigation choices are stored here, never credentials or provider data.
export function sessionChoice(key: string): string | null {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}

export function saveSessionChoice(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch { /* Storage may be disabled; in-memory navigation still works. */ }
}

export function onboardingStep(value: string | null): number {
  return value && ["1", "2", "3", "4"].includes(value) ? Number(value) : 1;
}
