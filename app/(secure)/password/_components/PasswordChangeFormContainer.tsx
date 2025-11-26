'use client';
import { logoutWithCleanup } from '@/stores/feature/authSlice';
import { AppDispatch } from '@/stores/store';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { PasswordChangeForm } from './PasswordChangeForm';

export function PasswordChangeFormContainer() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [popupOpen, setPopupOpen] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert('新しいパスワードと確認パスワードが一致しません。');
      return;
    }

    try {
      alert('パスワードが変更されました。');
      handleLogout();
    } catch (error) {
      if (error instanceof Error) {
        console.log('エラーが発生しました:', error.message);
      } else {
        console.log('予期しないエラーが発生しました:', error);
      }
    }
  };

  const handleLogout = () => {
    dispatch(logoutWithCleanup());
    setPopupOpen(false);
    router.replace('/');
  };

  return (
    <PasswordChangeForm
      currentPassword={currentPassword}
      newPassword={newPassword}
      confirmPassword={confirmPassword}
      setCurrentPassword={setCurrentPassword}
      setNewPassword={setNewPassword}
      setConfirmPassword={setConfirmPassword}
      handlePasswordChange={handlePasswordChange}
    />
  );
}
