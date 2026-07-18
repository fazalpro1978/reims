'use client';
import RealtorRegistry from '@/components/RealtorRegistry';
import { useNav } from '@/components/AppShell';

export default function RealtorsPage() {
  const { openNav } = useNav();
  return <RealtorRegistry onMenuClick={openNav} />;
}
