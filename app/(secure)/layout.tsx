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
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // セッションの有効期限が切れる24時間前に update() を呼び出してCookieを更新する。
  // NextAuth v4 では GET /api/auth/session はCookieを書き換えないため、
  // POST /api/auth/session を発行する update() が唯一の更新手段。
  useEffect(() => {
    if (status !== 'authenticated' || !session?.expires) return;

    const expiresAt = new Date(session.expires).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const oneDayMs = 24 * 60 * 60 * 1000;

    // 既に24時間以内なら即時更新、それ以外はタイマーで更新
    const refreshIn = Math.max(0, timeUntilExpiry - oneDayMs);

    const timer = setTimeout(() => {
      update();
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [session?.expires, status, update]);

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