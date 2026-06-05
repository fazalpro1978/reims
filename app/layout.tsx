import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Privé Group RE-IMS | Real Estate Information Management System',
  description:
    'Administrator-focused Real Estate Information Management System for Privé Group Real Estate — Qatar property portfolio operations console.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased">{children}</body>
    </html>
  );
}
