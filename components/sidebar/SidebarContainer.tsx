'use client';

import { Sidebar } from './Sidebar';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/types/database';

export function SidebarContainer({ open }: { open: boolean }) {
  const { data: session } = useSession();
  const userRole = session?.user?.user_role ?? UserRole.GENERAL;

  return <Sidebar open={open} userRole={userRole} />;
}
