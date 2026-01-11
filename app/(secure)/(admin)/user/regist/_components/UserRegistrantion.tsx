'use client';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import Loading from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { ROLE_OPTIONS } from '@/constants/constants';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { UserRole } from '@/types';
import { apiGet, apiPost } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { CreateUserListRow } from '../../_components/types/user-list-row';
import { userRegistSchema } from './schemas/user-regist-schema';

const Resist: React.FC = () => {
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateUserListRow>({
    name: '',
    email: '',
    user_role: '',
    department: '',
    company: '',
    password: '',
    tags: [] as string[],
    is_deleted: '',
  });
  const router = useRouter();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setTagLoading(true);
        setTagError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>('/api/tags');

        if (result.success && Array.isArray(result.data)) {
          const tagOptions = result.data.map((tag: { id: number, name: string }) => ({
            value: tag.name,
            label: tag.name
          }));
          setTagOptions(tagOptions);
        } else {
          setTagError('タグの取得に失敗しました。');
        }
      } catch (error) {
        clientLogger.error(`ユーザ新規登録画面`, 'タグ取得エラー', { error });
        setTagError(error instanceof Error ? error.message : 'タグの取得に失敗しました');
      } finally {
        setTagLoading(false);
      }
    };
    fetchTags();
  }, []);

  // 表示権限変更
  const userRoleChange = (user_role: number | string) => {
    if (typeof user_role === 'string') {
      return user_role;
    }
    return '';
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | { name: string; value: string | string[] };
    const { name, value } = target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTagChange = (tagName: string, selectedValues: string[]) => {
    setFormData(prev => ({
      ...prev,
      [tagName]: selectedValues
    }));
  };

  const handleBlur = async () => {
    if (!formData.email.trim()) {
      return;
    }

    clientLogger.info('ユーザ新規登録画面', 'ID(メールアドレス)重複チェック開始', { email: formData.email });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiGet<any>(`/api/users/check-email?email=${encodeURIComponent(formData.email)}`);

      if (result.success && result.isDuplicate) {
        setErrors(prev => ({
          ...prev,
          email: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL
        }));
        clientLogger.warn('ユーザ新規登録画面', 'ID(メールアドレス)重複', { email: formData.email });
      } else {
        // ID(メールアドレス)が重複していない場合、エラークリア
        setErrors(prev => {
          const newError = { ...prev };
          delete newError.email;
          return newError;
        });
        clientLogger.info('ユーザ新規登録画面', 'ID(メールアドレス)重複なし', { email: formData.email });
      }
    } catch (error) {
      clientLogger.error('ユーザ新規登録画面', 'ID(メールアドレス)重複チェックエラー', { error });
    }
  }

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'text',
      name: 'email',
      value: formData.email,
      onChange: handleInputChange,
      onBlur: handleBlur,
      placeholder: 'ID (メールアドレス)',
      error: errors.email
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: formData.name,
      onChange: handleInputChange,
      placeholder: '氏名',
      error: errors.name
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: formData.department,
      onChange: handleInputChange,
      placeholder: '部署',
      error: errors.department
    },
    {
      label: '会社名',
      type: 'text',
      name: 'company',
      value: formData.company,
      onChange: handleInputChange,
      placeholder: '会社名',
      error: errors.company
    },
    {
      label: '権限',
      type: 'select',
      name: 'user_role',
      value: userRoleChange(formData.user_role),
      onChange: handleInputChange,
      placeholder: '権限',
      options: Object.values(ROLE_OPTIONS).map(role => ({
        value: role,
        label: role
      })),
      error: errors.user_role
    },
    {
      label: 'パスワード',
      type: 'password',
      name: 'password',
      value: formData.password,
      onChange: handleInputChange,
      placeholder: 'パスワード',
      error: errors.password
    },
    {
      label: 'タグ',
      type: 'addableTag',
      name: 'tags',
      value: formData.tags,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('tags', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグ',
      options: tagOptions,
      error: errors.tags
    }
  ];

  // 登録ボタン押下時
  const handleRegister = async () => {
    // クライアント側バリデーション
    const validationResult = userRegistSchema.safeParse(formData);
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

      // 権限の取得
      const roleChange = formData.user_role === ROLE_OPTIONS.SYSTEM_ADMIN ? UserRole.ADMIN :
        formData.user_role === ROLE_OPTIONS.TEST_MANAGER ? UserRole.TEST_MANAGER : UserRole.GENERAL;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPost<any>('/api/users', {
        email: formData.email,
        name: formData.name,
        department: formData.department,
        company: formData.company,
        user_role: roleChange,
        password: formData.password,
        userTags: formData.tags
      });

      if (result.success) {
        clientLogger.info('ユーザ新規登録画面', 'ユーザ新規登録成功', { id: result.data?.id });
        setModalMessage('ユーザを登録しました');
        setIsModalOpen(true);
        setTimeout(() => {
          router.push('/user');
        }, 1500);
      } else {
        clientLogger.error('ユーザ新規登録画面', 'ユーザ新規登録失敗', { error: result.error });
        setModalMessage('ユーザの登録に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('ユーザ新規登録画面', '新規登録失敗', { error });
      setModalMessage('ユーザの登録に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // キャンセルボタン押下時
  const handleCancel = () => {
    router.back();
  };

  const buttons = [
    {
      label: isLoading ? '登録中...' : '登録',
      onClick: () => {
        clientLogger.info('ユーザ新規登録画面', '登録ボタン押下');
        handleRegister();
      },
      disabled: isLoading
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true
    }
  ];

  return (
    <div >
      {/* タグ読み込みエラー表示 */}
      {tagError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">タグの読み込みに失敗しました</p>

        </div>
      )}
      {/* タグ読み込み中の表示 */}
      <Loading
        isLoading={tagLoading}
        message="タグを読み込み中..."
        size="md"
      />
      {!tagLoading && (
        <>
          <VerticalForm fields={fields} />
          <ButtonGroup buttons={buttons} />
        </>
      )}
      {/* 登録結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div >
  );
};

export default Resist;