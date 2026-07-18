'use client';
import ZoneRegistry from '@/components/ZoneRegistry';
import { useNav } from '@/components/AppShell';

export default function ZonesPage() {
  const { openNav } = useNav();
  return <ZoneRegistry onMenuClick={openNav} />;
}
