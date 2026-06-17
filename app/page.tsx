'use client';
import UnitsInventory from '@/components/UnitsInventory';
import { useNav } from '@/components/AppShell';

export default function HomePage() {
  const { openNav } = useNav();
  return <UnitsInventory onMenuClick={openNav} />;
}
