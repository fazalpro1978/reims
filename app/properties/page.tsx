'use client';
import Properties from '@/components/Properties';
import { useNav } from '@/components/AppShell';

export default function PropertiesPage() {
  const { openNav } = useNav();
  return <Properties onMenuClick={openNav} />;
}
