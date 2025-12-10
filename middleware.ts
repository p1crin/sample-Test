import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { User } from '@/types';

// 認証済みユーザーをリダイレクトするパス（ログインページなど）
const authRedirectPath = '/login';
// 認証が必要なパス
const protectedPaths = ['/admin', '/testGroup'];

// トークンからユーザー情報を取得する型安全な関数（従来のシステム用）
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /testGroup/* へのアクセスチェック（NextAuth用）
  if (pathname.startsWith('/testGroup')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      // 未認証の場合、ログインページへリダイレクト
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // 認証済みの全ユーザーがアクセス可能
    // 細かい権限制御（どのテストグループが見えるか、編集できるか）はAPI層で実施
    // - ADMIN(0): すべてのテストグループにアクセス可能
    // - TEST_MANAGER(1): 作成したもの + 割り当てられたものにアクセス可能
    // - GENERAL_USER(2): 割り当てられたもののみアクセス可能
  }

  // /admin へのアクセスチェック（従来のシステム用）
  if (pathname.startsWith('/admin')) {
    const oldToken = request.cookies.get('auth-token')?.value;
    const user = oldToken ? getUserFromToken(oldToken) : null;
    const isAuthenticated = !!user;

    if (!isAuthenticated) {
      // 未認証の場合、ログインページへリダイレクト
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  // 認証済みユーザーをリダイレクトするパス（ログインページなど）
  if (pathname.startsWith(authRedirectPath)) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (token) {
      // 認証済みの場合、テストグループページへリダイレクト
      return NextResponse.redirect(new URL('/testGroup', request.url));
    }
  }

  return NextResponse.next();
}

// Middlewareを適用するパスを設定
export const config = {
  matcher: [
    // 認証が必要なパス
    '/admin/:path*',
    '/testGroup/:path*',
    // 認証済みユーザーをリダイレクトするパス
    '/login',
  ],
};
