'use client';

import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { clearAuthSession } from '@/stores/feature/auth';
import { signOut } from 'next-auth/react';
import { Button } from './button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  pathname: string
}

export default function ErrorPage({
  error,
  pathname
}: ErrorPageProps) {
  const isForbidden = error.message.includes('403') || error.message.includes('Permission') || error.message.includes('Forbidden');
  const isUnauthorized = error.message.includes('401') || error.message.includes('Unauthorized');
  const isNotFound = error.message.includes('404') || error.message.includes('Not Found');

  const statusMessage = isForbidden ? ERROR_MESSAGES.PERMISSION_DENIED : isUnauthorized ? ERROR_MESSAGES.UNAUTHORIZED : isNotFound ? ERROR_MESSAGES.NOT_FOUND : ERROR_MESSAGES.DEFAULT;
  const description = isForbidden
    ? 'このページにアクセスする権限がありません。'
    : isUnauthorized
      ? 'このページにアクセスするにはログインが必要です。'
      : isNotFound
        ? 'ページが見つかりませんでした。'
        : '申し訳ございませんが、エラーが発生しました。';

  const handleSignOut = () => {
    clearAuthSession();
    signOut({ callbackUrl: '/login' });
  };

  const handleToTestGroup = () => {
    window.location.href = '/testGroup';
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">{statusMessage}</h1>
        </div>

        <p className="text-gray-600 mb-8 max-w-md mx-auto">{description}</p>

        <div className="flex gap-4 justify-center">
          {isUnauthorized || pathname === '/testGroup' ? (
            < Button
              onClick={handleSignOut}
              className="px-6 py-2 bg-stnly text-white font-semibold rounded-md hover:bg-stnly-light transition-colors"
            >
              ログイン画面へ戻る
            </Button>
          ) : (
            <Button
              onClick={handleToTestGroup}
              className="px-6 py-2 bg-stnly text-white font-semibold rounded-md hover:bg-stnly-light transition-colors"
            >
              テストグループ一覧へ戻る
            </Button>
          )}
        </div>
      </div>
    </div >
  );
}