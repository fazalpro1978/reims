'use client';
import UnitImportPipeline from '@/components/UnitImportPipeline';
import { useNav } from '@/components/AppShell';

export default function UnitsImportPage() {
  const { openNav } = useNav();
  return <UnitImportPipeline onMenuClick={openNav} />;
}
