'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/stores/store';
import { logoutWithCleanup } from '@/stores/feature/authSlice';
import { Header } from './Header';
import { User } from '@/types';

export function HeaderContainer({
  onToggleSidebar,
  user,
}: {
  onToggleSidebar: () => void;
  user: User | null;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const [popupOpen, setPopupOpen] = useState(false);
  const router = useRouter();

  const handleAvatarClick = () => {
    setPopupOpen((prev) => !prev);
  };

  const handleLogout = () => {
    dispatch(logoutWithCleanup());
    setPopupOpen(false);
    router.replace('/');
  };

  return (
    <Header
      onToggleSidebar={onToggleSidebar}
      user={user}
      onLogout={handleLogout}
      popupOpen={popupOpen}
      onAvatarClick={handleAvatarClick}
    />
  );
}
