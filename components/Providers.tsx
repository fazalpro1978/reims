'use client';

import React from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import UnixShellOverlay from './UnixShellOverlay';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        {children}
        <UnixShellOverlay />
      </ThemeProvider>
    </AuthProvider>
  );
}
