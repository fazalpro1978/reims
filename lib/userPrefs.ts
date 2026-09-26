// Per-user preferences stored in localStorage.
// No backend required — these are personal, per-device conveniences.

export interface UserPrefs {
  defaultLanding:  string;   // route: '/', '/inventory', '/synergy', etc.
  hiddenWidgets:   string[]; // dashboard widget IDs to hide
  pinnedModules:   string[]; // nav item IDs shown in the QuickAccess bar
}

const PREFS_KEY = 'vanguard_user_prefs_v1';

const DEFAULTS: UserPrefs = {
  defaultLanding: '/',
  hiddenWidgets:  [],
  pinnedModules:  ['inventory', 'synergy'],
};

export function getPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs: UserPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    // Fire a custom event so other components on the same page can react
    window.dispatchEvent(new CustomEvent('vanguard-prefs-change', { detail: prefs }));
  } catch {}
}

export function patchPrefs(patch: Partial<UserPrefs>): UserPrefs {
  const merged = { ...getPrefs(), ...patch };
  savePrefs(merged);
  return merged;
}
