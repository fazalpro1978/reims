'use client';
import ClientsDirectory from '@/components/ClientsDirectory';
import { useNav } from '@/components/AppShell';

export default function ClientsPage() {
  const { openNav } = useNav();
  return <ClientsDirectory onMenuClick={openNav} />;
}
