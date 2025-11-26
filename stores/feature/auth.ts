'use client';
import { User } from '@/types';

const AUTH_TOKEN_KEY = 'auth-token';
const SESSION_KEY = 'auth-session';

export type AuthSession = {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
};

// 認証セッションの保存
export function setAuthSession(session: AuthSession) {
  // セッションストレージは消える為、ユーザ情報を都度バックエンドから取得する等の修正が必要
  if (session.isAuthenticated && session.user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Cookieにトークンを保存
  if (session.token) {
    document.cookie = `${AUTH_TOKEN_KEY}=${session.token}; path=/; secure; samesite=strict`;
  } else {
    document.cookie = `${AUTH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

// 認証セッションのクリア
export function clearAuthSession() {
  sessionStorage.removeItem(SESSION_KEY);
  document.cookie = `${AUTH_TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// トークンの生成（開発用の簡易実装）
export function generateToken(email: string): string {
  return btoa(`${email}:${Date.now()}`);
}

// 認証セッションの読み込み
export function loadAuthSession(): AuthSession | null {
  const sessionData = sessionStorage.getItem(SESSION_KEY);
  if (!sessionData) return null;
  return JSON.parse(sessionData) as AuthSession;
}
