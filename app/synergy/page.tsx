'use client';
import SynergyCenter from '@/components/SynergyCenter';
import { useNav } from '@/components/AppShell';

export default function SynergyPage() {
  const { openNav } = useNav();
  return <SynergyCenter onMenuClick={openNav} />;
}
