'use client';
import { useSearchParams } from 'next/navigation';
import UnitsInventory from '@/components/UnitsInventory';
import { useNav } from '@/components/AppShell';

export default function InventoryPage() {
  const { openNav }   = useNav();
  const params        = useSearchParams();
  const initialStatus = params.get('status') ?? undefined;
  const initialZone   = params.get('zone')   ?? undefined;
  return (
    <UnitsInventory
      onMenuClick={openNav}
      initialStatus={initialStatus}
      initialZone={initialZone}
    />
  );
}
