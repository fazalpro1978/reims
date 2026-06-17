'use client';
import { createContext, useContext, useState } from 'react';
import { usePathname } from 'next/navigation';
import SideNav from './SideNav';

// ── Nav context ───────────────────────────────────────────────────────────────

interface NavCtx { openNav: () => void }
const NavContext = createContext<NavCtx>({ openNav: () => {} });
export const useNav = () => useContext(NavContext);

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();

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
