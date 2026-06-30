'use client';
import IngestQueue from '@/components/IngestQueue';
import { useNav } from '@/components/AppShell';

export default function IngestQueuePage() {
  const { openNav } = useNav();
  return <IngestQueue onMenuClick={openNav} />;
}
