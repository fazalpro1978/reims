import type { Metadata } from 'next';
import './globals.css';
import Providers from '../components/Providers';
import AppShell from '../components/AppShell';

export const metadata: Metadata = {
  title: 'Privé Group | Vanguard REOS',
  description:
    'Vanguard REOS — Administrator-focused real estate operations system for Privé Group Real Estate, Qatar property portfolio.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0f0f0f] text-[#e0e0e0] font-sans antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
