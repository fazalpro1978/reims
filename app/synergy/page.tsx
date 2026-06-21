'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import SynergyCenter from '@/components/SynergyCenter';
import { useNav } from '@/components/AppShell';

function SynergyInner() {
  const { openNav } = useNav();
  const params = useSearchParams();
  const initialRef = params.get('inquiry') ?? undefined;
  return <SynergyCenter onMenuClick={openNav} initialRef={initialRef} />;
}

export default function SynergyPage() {
  return (
    <Suspense>
      <SynergyInner />
    </Suspense>
  );
}
