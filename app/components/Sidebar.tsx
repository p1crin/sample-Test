
'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname.startsWith(path) ? 'bg-blue-700' : '';
  };

  return (
    <aside className="w-64 bg-blue-400 text-white min-h-screen">
      <nav className="p-4">
        <ul className="space-y-2">
          <li>
            <Link
              href="/test-groups"
              className={`block px-4 py-2 rounded hover:bg-blue-700 ${isActive(
                '/test-groups'
              )}`}
            >
              テストグループ一覧
            </Link>
          </li>

          {/* Admin only - User Management */}
          {session && session.user.user_role === 0 && (
            <li>
              <Link
                href="/users"
                className={`block px-4 py-2 rounded hover:bg-blue-700 ${isActive(
                  '/users'
                )}`}
              >
                ユーザー管理
              </Link>
            </li>
          )}

          {/* Admin only - Import History */}
          {session && session.user.user_role === 0 && (
            <li>
              <Link
                href="/import-history"
                className={`block px-4 py-2 rounded hover:bg-blue-700 ${isActive(
                  '/import-history'
                )}`}
              >
                インポート履歴
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
}
