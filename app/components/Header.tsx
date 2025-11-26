'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-black text-white shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/test-groups" className="text-xl text-orange-500 font-bold">
          テストケース管理システム
        </Link>

        {session && (
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {session.user.email} (
              {session.user.user_role === 0
                ? '管理者'
                : session.user.user_role === 1
                ? 'テスト管理者'
                : '一般'}
              )
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded text-sm"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
