'use client';
import { ReactNode, useState, useEffect } from 'react';
import type { RootState } from '@/stores/store';
import { HeaderContainer } from '@/components/header/HeaderContainer';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import { useSelector } from 'react-redux';
import Breadcrumb from '@/components/ui/breadcrumb';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = useSelector((state: RootState) => state.auth.user);
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderContainer user={user} onToggleSidebar={handleToggleSidebar} />
      <div className="flex h-full">
        <SidebarContainer open={sidebarOpen} />
        <main
          className={`flex-1 overflow-y-auto p-5 pt-16 transition-all ${sidebarOpen ? 'md:ml-48' : ''}`}
        >
          <Breadcrumb />
          {children}
        </main>
      </div>
    </div>
  );
}