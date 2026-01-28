'use client';
import { HeaderContainer } from '@/components/header/HeaderContainer';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import Breadcrumb from '@/components/ui/breadcrumb';
import Loading from '@/components/ui/loading';
import type { RootState } from '@/stores/store';
import clientLogger from '@/utils/client-logger';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

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

  // クライアントロガーにユーザーIDを設定
  useEffect(() => {
    if (session?.user?.id) {
      clientLogger.setUserId(session.user.id);
    }
    return () => {
      clientLogger.clearUserId();
    };
  }, [session?.user?.id]);

  // セッション読み込み中の表示
  if (status === 'loading') {
    return (
      <Loading
        isLoading={true}
        message="セッションを読み込み中..."
        fullScreen={true}
        size="lg"
      />
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderContainer user={user} onToggleSidebar={handleToggleSidebar} />
      <div className="flex h-full">
        <SidebarContainer open={sidebarOpen} role={session.user.user_role} />
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