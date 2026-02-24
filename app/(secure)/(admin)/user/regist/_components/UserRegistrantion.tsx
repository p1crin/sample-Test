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
  const [isApiSuccess, setIsApiSuccess] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEmailChecking, setIsEmailChecking] = useState(false);
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
      } catch (err) {
        clientLogger.error(`ユーザ新規登録画面`, 'タグ取得エラー', { error: err instanceof Error ? err.message : String(err) });
        setTagError(err instanceof Error ? err.message : 'タグの取得に失敗しました');
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

  // メールアドレスの重複チェック
  const checkEmailDuplication = async (email: string): Promise<boolean> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiGet<any>(`/api/users/check-email?email=${encodeURIComponent(email)}`);
      return result.success && result.isDuplicate
    } catch (err) {
      clientLogger.error('ユーザ新規登録画面', 'ID(メールアドレス)重複チェックエラー', { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  // Blurでメールアドレス重複チェック
  const handleEmailBlur = async () => {
    if (!formData.email.trim()) {
      return;
    }
    setIsEmailChecking(true);
    clientLogger.info('ユーザ新規登録画面', 'ID(メールアドレス)重複チェック開始', { email: formData.email });
    try {
      const isDuplicate = await checkEmailDuplication(formData.email)
      if (isDuplicate) {
        setErrors(prev => ({
          ...prev,
          email: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL
        }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.email;
          return newErrors;
        });
        clientLogger.info('ユーザ新規登録画面', 'ID(メールアドレス)重複なし', { email: formData.email });
      }
    } finally {
      setIsEmailChecking(false);
    }
  };

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'text',
      name: 'email',
      value: formData.email,
      onChange: handleInputChange,
      onBlur: handleEmailBlur,
      placeholder: 'ID (メールアドレス)',
      error: errors.email,
      disabled: isEmailChecking
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

    // メールアドレス重複チェック(ブラーをスキップして直接登録ボタン押した場合)
    clientLogger.info('ユーザ新規登録画面', '登録時ID(メールアドレス)重複チェック開始', { email: formData.email })
    const isDuplicate = await checkEmailDuplication(formData.email);
    if (isDuplicate) {
      setErrors(prev => ({
        ...prev,
        email: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL,
      }));
      return;
    }

    // バリデーション成功時にエラークリア
    setErrors({});

    try {
      // API呼び出し
      setIsLoading(true);
      clientLogger.info('ユーザ新規登録画面', 'ユーザ新規登録開始', { formData });
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
        clientLogger.info('ユーザ新規登録画面', 'ユーザ新規登録成功', { userId: result.data?.id });
        setModalMessage('ユーザを登録しました');
        setIsApiSuccess(result.success);
        setIsModalOpen(true);
        setTimeout(() => {
          router.push('/user');
        }, 1500);
      } else {
        clientLogger.error('ユーザ新規登録画面', 'ユーザ新規登録失敗', { error: result.error instanceof Error ? result.error.message : String(result.error) });
        setModalMessage('ユーザの登録に失敗しました');
        setIsModalOpen(true);
      }
    } catch (err) {
      clientLogger.error('ユーザ新規登録画面', 'ユーザ新規登録失敗', { error: err instanceof Error ? err.message : String(err) });
      setModalMessage('ユーザの登録に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = (isApiSuccess: boolean) => {
    setIsModalOpen(false);
    // 登録成功時はユーザ一覧へ遷移する
    if (isApiSuccess) {
      router.push('/user');
    }
  }

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
      onClick: () => {
        clientLogger.info('ユーザ新規登録画面', '戻るボタン押下');
        router.back();
      },
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
      
      <Modal open={isLoading} onClose={() => setIsLoading(false)} isUnclosable={true}>
        <div className="flex justify-center">
          <Loading
            isLoading={true}
            message="データ登録中..."
            size="md"
          />
        </div>
      </Modal>

      {/* 登録結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => closeModal(isApiSuccess)}
          >
            閉じる
          </Button>
        </div>
      </Modal>
    </div >
  );
};

export default Resist;