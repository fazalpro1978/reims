'use client';

import React from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import UnixShellOverlay from './UnixShellOverlay';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <UnixShellOverlay />
    </ThemeProvider>
  );
}
