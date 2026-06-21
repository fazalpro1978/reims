'use client';
import ContractsLegal from '@/components/ContractsLegal';
import { useNav } from '@/components/AppShell';

export default function ContractsPage() {
  const { openNav } = useNav();
  return <ContractsLegal onMenuClick={openNav} />;
}
