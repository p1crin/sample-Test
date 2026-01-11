'use client';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { clearAuthSession } from '@/stores/feature/auth';
import { apiPut } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { passwordChangeSchema } from './schemas/password-change-schema';

export function PasswordChangeFormContainer() {
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | { name: string; value: string | string[] };
    const { name, value } = target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // パスワード変更ボタン押下時
  const handlePasswordChange = async () => {
    clientLogger.info('パスワード変更画面', 'パスワード変更ボタン押下');
    // クライアント側バリデーション
    const validationResult = passwordChangeSchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        const fieldPath = err.path[0] as string;
        newErrors[fieldPath] = err.message;
      });
      setErrors(newErrors);
      return;
    }
    // バリデーション成功時はエラーをクリア
    setErrors({});
    try {
      // API呼び出し
      setIsLoading(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = await apiPut<any>('/api/auth/change-password', {
          current_password: formData.currentPassword,
          new_password: formData.newPassword,
          new_password_confirmation: formData.confirmPassword
        });
      } catch (error) {
        // APIが404エラー(現在のパスワードが正しくない)時フォームの下にバリデーションエラーを表示する。
        if (error instanceof Error && error.message.includes('404')) {
          setErrors(prev => ({
            ...prev,
            currentPassword: ERROR_MESSAGES.INVALID_PASSWORD
          }));
          setIsLoading(false);
          return;
        }
        throw error;
      }
      if (result.success) {
        clientLogger.info('パスワード変更画面', 'パスワード変更成功', { id: result.data?.id });
        setModalMessage('パスワードを変更しました');
        setIsModalOpen(true);
        setTimeout(() => {
          handleLogout();
        }, 1500);
      } else {
        clientLogger.error('パスワード変更画面', 'パスワード変更失敗', { error: result.error });
        setModalMessage('パスワード変更に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('パスワード変更画面', 'パスワード変更失敗', { error });
      setModalMessage('パスワード変更に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // パスワード変更後のログアウト
  const handleLogout = () => {
    clearAuthSession();
    signOut({ callbackUrl: '/login' });
  };

  const fields = [
    {
      label: '現在のパスワード',
      type: 'password',
      name: 'currentPassword',
      value: formData.currentPassword,
      onChange: handleInputChange,
      placeholder: '現在のパスワード',
      error: errors.currentPassword
    },
    {
      label: '新しいパスワード',
      type: 'password',
      name: 'newPassword',
      value: formData.newPassword,
      onChange: handleInputChange,
      placeholder: '新しいパスワード',
      error: errors.newPassword
    },
    {
      label: '新しいパスワード(再確認)',
      type: 'password',
      name: 'confirmPassword',
      value: formData.confirmPassword,
      onChange: handleInputChange,
      placeholder: '新しいパスワード(再確認)',
      error: errors.confirmPassword
    },
  ];

  const buttons = [
    {
      label: isLoading ? 'パスワード変更中...' : 'パスワード変更',
      onClick: handlePasswordChange,
    },
  ];

  return (
    <div>
      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}