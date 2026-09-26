'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPrefs, getPrefs, savePrefs } from '../lib/userPrefs';

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<UserPrefs>(getPrefs);

  // Sync when another component on the same page calls savePrefs
  useEffect(() => {
    const handler = (e: Event) => {
      setPrefs((e as CustomEvent<UserPrefs>).detail);
    };
    window.addEventListener('vanguard-prefs-change', handler);
    return () => window.removeEventListener('vanguard-prefs-change', handler);
  }, []);

  const update = useCallback((patch: Partial<UserPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  return { prefs, update };
}
