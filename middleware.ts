import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { User } from '@/types';

// 認証済みユーザーをリダイレクトするパス（ログインページなど）
const authRedirectPath = '/login';
// 認証が必要なパス
const protectedPaths = ['/admin'];

// トークンからユーザー情報を取得する型安全な関数
function getUserFromToken(token: string): Pick<User, 'email'> | null {
  try {
    const decodedData = atob(token);
    const [email, timestamp] = decodedData.split(':');
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();

    // トークンの形式チェックと有効期限チェック（24時間）
    if (!!email && !!tokenTime && now - tokenTime < 24 * 60 * 60 * 1000) {
      return { email };
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // セッショントークンの取得と検証
  const token = request.cookies.get('auth-token')?.value;
  const user = token ? getUserFromToken(token) : null;
  const isAuthenticated = !!user;

  // 認証が必要なパスへのアクセスチェック
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    if (!isAuthenticated) {
      // 未認証の場合、ログインページへリダイレクト
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  // 認証済みユーザーをリダイレクトするパス（ログインページなど）
  if (pathname.startsWith(authRedirectPath)) {
    if (isAuthenticated) {
      // 認証済みの場合、メニュー1ページへリダイレクト
      return NextResponse.redirect(new URL('testGroup', request.url));
    }
  }

  return NextResponse.next();
}

// Middlewareを適用するパスを設定
export const config = {
  matcher: [
    // 認証が必要なパス
    '/admin/:path*',
    // 認証済みユーザーをリダイレクトするパス
    '/login',
  ],
};
