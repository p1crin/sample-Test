import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 認証済みユーザーをリダイレクトするパス（ログインページなど）
const authRedirectPath = '/login';
// 認証が必要なパス
const protectedPaths = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuthのJWTトークンを取得して認証状態を確認
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isAuthenticated = !!token;

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
    // 認証済みユーザーをリダイレクトするパス
    '/login',
  ],
};
