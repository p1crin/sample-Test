'use client';
import { store } from '@/stores/store';
import { Provider, useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { loadAuthSession } from '@/stores/feature/auth';
import { login } from '@/stores/feature/authSlice';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

// グローバルな初期化状態
let isGlobalInitialized = false;

function AuthSessionSync() {
  const dispatch = useDispatch();

  useEffect(() => {
    const session = loadAuthSession();

    if (session?.isAuthenticated && session?.user) {
      // セッション全体をloginアクションに渡す
      dispatch(login(session));
    }

    // グローバルの初期化フラグを設定
    isGlobalInitialized = true;
  }, [dispatch]);

  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthSessionSync />
      {children}
    </Provider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// 認証状態の初期化が完了したかどうかを確認する関数をエクスポート
export const isAuthInitialized = () => isGlobalInitialized;
