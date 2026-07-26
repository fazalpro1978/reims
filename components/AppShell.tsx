'use client';
import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import SideNav from './SideNav';
import { useAuth } from '../contexts/AuthContext';

// ── Nav context ───────────────────────────────────────────────────────────────

interface NavCtx { openNav: () => void }
const NavContext = createContext<NavCtx>({ openNav: () => {} });
export const useNav = () => useContext(NavContext);

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const { loading, user } = useAuth();

  // During auth check, show nothing (AuthContext redirects unauthenticated users)
  const isPublicRoute = pathname?.startsWith('/login') || pathname?.startsWith('/report');
  if (loading && !isPublicRoute) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#c9a84c]/30 border-t-[#c9a84c] animate-spin" />
          <p className="text-[#555] text-xs">Loading…</p>
        </div>
      </div>
    );
  }

  // Report pages render bare — no chrome
  if (pathname?.startsWith('/report')) {
    return <>{children}</>;
  }

  return (
    <NavContext.Provider value={{ openNav: () => setNavOpen(true) }}>
      <SideNav open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Floating hamburger FAB — mobile only */}
      <button
        onClick={() => setNavOpen(true)}
        aria-label="Open navigation menu"
        className={`fixed bottom-6 left-6 z-[45] lg:hidden flex items-center justify-center w-[52px] h-[52px] rounded-full text-[#0f0f0f] bg-[#c9a84c] hover:bg-[#dfc070] shadow-[0_4px_24px_rgba(201,168,76,0.45)] transition-all duration-200 active:scale-95 ${
          navOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="w-5 h-5">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {children}
    </NavContext.Provider>
  );
}
