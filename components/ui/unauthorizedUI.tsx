'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { clearAuthSession } from '@/stores/feature/auth';
import { Button } from './button';

export default function UnauthorizedUI() {
  const handleSignOut = () => {
    clearAuthSession();
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">認証が必要です</h1>
        </div>

        <p className="text-gray-600 mb-8 max-w-md mx-auto">このページにアクセスするにはログインが必要です。</p>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleSignOut}
            className="px-6 py-2 bg-stnly text-white font-semibold rounded-md hover:bg-stnly-light transition-colors"
          >
            ログイン画面へ戻る
          </Button>
        </div>
      </div>
    </div>
  );
}