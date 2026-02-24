'use client';
import { HeaderContainer } from '@/components/header/HeaderContainer';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import Breadcrumb from '@/components/ui/breadcrumb';
import Loading from '@/components/ui/loading';
import type { RootState } from '@/stores/store';
import clientLogger from '@/utils/client-logger';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const user = useSelector((state: RootState) => state.auth.user);
  const { data: session, status, update } = useSession();
  const router = useRouter();

  // 初回ロード完了後はローディング画面を表示しないようにフラグで管理する
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // 1. usePathnameフックで現在のURLパスを取得
  const pathname = usePathname();

  // 2. 更新処理を呼び出す間隔（例：5分）
  const throttleInterval = 5 * 60 * 1000; // 5分（ミリ秒）

  // 3. 最後に更新した時刻と、update関数をrefで管理
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const updateRef = useRef(update);

  // update関数が変更された場合にrefを更新
  useEffect(() => {
    updateRef.current = update;
  }, [update]);

  // 4. pathname（URLパス）が変更された時に処理を実行するuseEffect
  useEffect(() => {
    // 認証済みでなければ何もしない
    if (status !== 'authenticated') {
      return;
    }

    const now = Date.now();

    // 5. 前回の更新から指定した時間が経過しているかチェック
    if (now - lastUpdateTimeRef.current > throttleInterval) {
      // 6. update関数を呼び出してセッションを更新
      updateRef.current();
      // 最終更新時刻を更新
      lastUpdateTimeRef.current = now;
    }

    // 7. 依存配列にpathnameを設定
  }, [pathname, status]);

  // --- ここまで追加 ---

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

  useEffect(() => {
    if (session?.user?.id) {
      clientLogger.setUserId(session.user.id);
    }
    return () => {
      clientLogger.clearUserId();
    };
  }, [session?.user?.id]);

  // セッション読み込み中の表示
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