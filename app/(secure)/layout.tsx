'use client';
import { HeaderContainer } from '@/components/header/HeaderContainer';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import Breadcrumb from '@/components/ui/breadcrumb';
import Loading from '@/components/ui/loading';
import type { RootState } from '@/stores/store';
import clientLogger from '@/utils/client-logger';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = useSelector((state: RootState) => state.auth.user);
  const { data: session, status, update } = useSession();
  const router = useRouter();

  // update() 呼び出し中も status が一時的に 'loading' になるため、
  // 初回ロード完了後はローディング画面を表示しないようにフラグで管理する
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // update 関数を ref で保持することで依存配列から除外し、
  // update 参照変更による無限ループを防ぐ
  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      setInitialLoadDone(true);
    }
  }, [status, router]);

  // セッションの有効期限が切れる24時間前に update() を呼び出してCookieを更新する。
  // NextAuth v4 では GET /api/auth/session はCookieを書き換えないため、
  // POST /api/auth/session を発行する update() が唯一の更新手段。
  // update を依存配列に含めると参照変更で無限ループになるため ref 経由で呼ぶ。
  useEffect(() => {
    if (status !== 'authenticated' || !session?.expires) return;

    const expiresAt = new Date(session.expires).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const oneDayMs = 24 * 60 * 60 * 1000;

    // 既に24時間以内なら即時更新、それ以外はタイマーで更新
    const refreshIn = Math.max(0, timeUntilExpiry - oneDayMs);

    const timer = setTimeout(() => {
      updateRef.current();
    }, refreshIn);

    return () => clearTimeout(timer);
  }, [session?.expires, status]);

  // クライアントロガーにユーザーIDを設定
  useEffect(() => {
    if (session?.user?.id) {
      clientLogger.setUserId(session.user.id);
    }
    return () => {
      clientLogger.clearUserId();
    };
  }, [session?.user?.id]);

  // 初回セッション読み込み中のみローディングを表示
  // （update() による一時的な loading 状態では表示しない）
  if (status === 'loading' && !initialLoadDone) {
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
