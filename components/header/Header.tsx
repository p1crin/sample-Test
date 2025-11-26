'use client';
import { User } from '@/types';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearAuthSession } from '@/stores/feature/auth';

export type HeaderProps = {
  onToggleSidebar: () => void;
  user: User | null;
  onLogout: () => void;
  popupOpen: boolean;
  onAvatarClick: () => void;
};


export function Header({ onToggleSidebar, user, onLogout, popupOpen, onAvatarClick }: HeaderProps) {
  const [userData, setUserData] = useState<User | null>();
  const { data: session } = useSession();

  useEffect(() => {
    setUserData(user);
  }, [user]);

  return (
    <header
      className={`w-screen bg-[#151617] border-b z-20 fixed top-0 left-0 right-0 h-16 flex items-center px-4 sm:px-8`}
    >
      <button
        onClick={onToggleSidebar}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded hover:bg-gray-700 focus:outline-none"
        aria-label="サイドバー切替"
        type="button"
        style={{ display: !onToggleSidebar ? 'none' : 'block' }}
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-menu"
        >
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>
      <span className="font-bold text-lg tracking-wide select-none whitespace-nowrap ml-12 text-[#ff5611]">
        テストケースDBアプリ
      </span>
      {session && (
        <div className="ml-auto flex items-center flex-wrap sm:flex-nowrap gap-2 sm:gap-4">
          {/* PC表示 */}
          <div className="hidden sm:flex items-center gap-4">
            {userData && (
              <span className="text-sm text-white">{userData.email ?? userData.name}</span>
            )}
            <Link href="/password">
              <button className="text-sm text-white py-2 px-4 rounded border hover:bg-stone-600">
                パスワード変更
              </button>
            </Link>
            <button className="text-sm text-white py-2 px-4 rounded border hover:bg-stone-600" onClick={() => {
              clearAuthSession();
              signOut({ callbackUrl: '/login' });
            }}>
              ログアウト
            </button>
          </div>
        </div>
      )}
    </header>
  );
}