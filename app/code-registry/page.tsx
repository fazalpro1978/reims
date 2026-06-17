'use client';
import CodeRegistry from '@/components/CodeRegistry';
import { useNav } from '@/components/AppShell';

export default function CodeRegistryPage() {
  const { openNav } = useNav();
  return <CodeRegistry onMenuClick={openNav} />;
}
