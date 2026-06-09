'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Theme,
  ThemeId,
  ThemeTokens,
  LayoutMode,
  DEFAULT_THEME_ID,
  getTheme,
  THEMES,
} from '../lib/theme/themes';

// ── Context shape ────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: ThemeId) => void;
  themes: Theme[];
  layoutMode: LayoutMode;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── CSS variable injector ────────────────────────────────────────────────────

function applyTheme(id: ThemeId, tokens: ThemeTokens, layout: LayoutMode) {
  const root = document.documentElement;

  root.setAttribute('data-theme', id);
  if (layout === 'default') {
    root.removeAttribute('data-layout');
  } else {
    root.setAttribute('data-layout', layout);
  }

  // CSS custom properties — consumed by ThemeSwitcher and new themed components
  root.style.setProperty('--accent',          tokens.accent);
  root.style.setProperty('--accent-hover',    tokens.accentHover);
  root.style.setProperty('--accent-text',     tokens.accentText);
  root.style.setProperty('--bg-void',         tokens.bgVoid);
  root.style.setProperty('--bg-base',         tokens.bgBase);
  root.style.setProperty('--bg-surface',      tokens.bgSurface);
  root.style.setProperty('--bg-elevated',     tokens.bgElevated);
  root.style.setProperty('--bg-subtle',       tokens.bgSubtle);
  root.style.setProperty('--bg-header',       tokens.bgHeader);
  root.style.setProperty('--bg-subheader',    tokens.bgSubHeader);
  root.style.setProperty('--border-faint',    tokens.borderFaint);
  root.style.setProperty('--border-default',  tokens.borderDefault);
  root.style.setProperty('--border-strong',   tokens.borderStrong);
  root.style.setProperty('--text-primary',    tokens.textPrimary);
  root.style.setProperty('--text-secondary',  tokens.textSecondary);
  root.style.setProperty('--text-muted',      tokens.textMuted);
  root.style.setProperty('--text-faint',      tokens.textFaint);
  root.style.setProperty('--text-dimmer',     tokens.textDimmer);
  root.style.setProperty('--text-dimmest',    tokens.textDimmest);
}

// ── Persistence key ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'prive-ims-theme';

// ── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const id: ThemeId =
      stored && THEMES.some(t => t.id === stored) ? stored : DEFAULT_THEME_ID;
    setThemeId(id);
    const t = getTheme(id);
    applyTheme(id, t.tokens, t.layoutMode ?? 'default');
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
    const t = getTheme(id);
    applyTheme(id, t.tokens, t.layoutMode ?? 'default');
  }, []);

  const layoutMode: LayoutMode = getTheme(themeId).layoutMode ?? 'default';

  return (
    <ThemeContext.Provider value={{ theme: getTheme(themeId), setTheme, themes: THEMES, layoutMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be called inside <ThemeProvider>');
  return ctx;
}
