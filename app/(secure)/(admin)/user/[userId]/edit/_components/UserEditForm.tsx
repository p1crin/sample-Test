import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/constants/constants';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { UserRole } from '@/types';
import { apiGet, apiPut } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateUserListRow } from '../../../_components/types/user-list-row';
import { userEditSchema } from './schemas/user-edit-schema';
import Loading from '@/components/ui/loading';

export type UserEditFormState = UpdateUserListRow;

export type UserEditChangeData = {
  target: {
    id: string;
    name: string;
    value: string;
    type: string;
  };
};

export type UserEditFormProps = {
  id?: number;
  form: UserEditFormState;
};

export function UserEditForm({
  id,
  form,
}: UserEditFormProps) {
  const [formData, setFormData] = useState(form);
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editModalMessage, setEditModalMessage] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isApiSuccess, setIsApiSuccess] = useState(false);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setFormData(form);
  }, [form]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>('/api/tags');

        if (result.success && Array.isArray(result.data)) {
          const tagOptions = result.data.map((tag: { id: number, name: string }) => ({
            value: tag.name,
            label: tag.name,
          }));
          setTagOptions(tagOptions);
        } else {
          setTagError('タグの取得に失敗しました');
        }
      } catch (err) {
        clientLogger.error('ユーザ編集画面', 'タグ取得エラー', { error: err instanceof Error ? err.message : String(err) });
        setTagError(err instanceof Error ? err.message : 'タグの取得に失敗しました');
      }
    };
    fetchTags();
  }, []);

  const userRoleChange = (user_role: number | string): string => {
    if (typeof user_role === 'string') {
      return user_role;
    }
    switch (user_role) {
      case UserRole.ADMIN:
        formData.user_role = ROLE_OPTIONS.SYSTEM_ADMIN;
        return ROLE_OPTIONS.SYSTEM_ADMIN;
      case UserRole.TEST_MANAGER:
        formData.user_role = ROLE_OPTIONS.TEST_MANAGER;
        return ROLE_OPTIONS.TEST_MANAGER;
      default:
        formData.user_role = ROLE_OPTIONS.GENERAL;
        return ROLE_OPTIONS.GENERAL;
    }
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
      const result = await apiGet<any>(`/api/users/check-email?id=${id}&email=${encodeURIComponent(email)}`);
      return result.success && result.isDuplicate
    } catch (err) {
      clientLogger.error('ユーザ編集画面', 'ID(メールアドレス)重複チェックエラー', { error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  // Blurでメールアドレス重複チェック
  const handleEmailBlur = async () => {
    if (!formData.email.trim()) {
      return;
    }
    setIsEmailChecking(true);
    clientLogger.info('ユーザ編集画面', 'ID(メールアドレス)重複チェック開始', { email: formData.email });
    try {
      const isDuplicate = await checkEmailDuplication(formData.email)
      if (isDuplicate) {
        setEditErrors(prev => ({
          ...prev,
          email: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL
        }));
      } else {
        setEditErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.email;
          return newErrors;
        });
        clientLogger.info('ユーザ編集画面', 'ID(メールアドレス)重複なし', { email: formData.email });
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
      placeholder: 'ID (メールアドレス)',
      onBlur: handleEmailBlur,
      error: editErrors.email,
      disabled: isEmailChecking
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: formData.name,
      onChange: handleInputChange,
      placeholder: '氏名',
      error: editErrors.name
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: formData.department,
      onChange: handleInputChange,
      placeholder: '部署',
      error: editErrors.department
    },
    {
      label: '会社名',
      type: 'text',
      name: 'company',
      value: formData.company,
      onChange: handleInputChange,
      placeholder: '会社名',
      error: editErrors.company
    },
    {
      label: '権限',
      type: 'select',
      name: 'user_role',
      value: userRoleChange(formData.user_role),
      placeholder: '権限',
      onChange: handleInputChange,
      options: Object.values(ROLE_OPTIONS).map(role => ({
        value: role,
        label: role
      })),
      error: editErrors.user_role
    },
    {
      label: 'パスワード',
      type: 'password',
      name: 'password',
      value: formData.password,
      onChange: handleInputChange,
      placeholder: 'パスワード',
      error: editErrors.password
    },
    {
      label: 'タグ',
      type: 'addableTag',
      name: 'tags',
      value: formData.tags,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('tags', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグ',
      options: tagOptions,
      error: editErrors.tags
    },
    {
      label: 'ステータス',
      type: 'select',
      name: 'is_deleted',
      value: formData.is_deleted,
      onChange: handleInputChange,
      placeholder: 'ステータス',
      options: Object.values(STATUS_OPTIONS).map(is_deleted => ({
        value: is_deleted,
        label: is_deleted
      })),
      error: editErrors.is_deleted
    },
  ];

  const handleEditer = async () => {
    // クライアント側バリデーション
    const validationResult = userEditSchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        const fieldPath = err.path[0] as string;
        newErrors[fieldPath] = err.message;
      });
      setEditErrors(newErrors);
      return;
    }

    // メールアドレス重複チェック(ブラーをスキップして直接登録ボタン押した場合)
    clientLogger.info('ユーザ編集画面', '更新時ID(メールアドレス)重複チェック開始', { email: formData.email })
    const isDuplicate = await checkEmailDuplication(formData.email);
    if (isDuplicate) {
      setEditErrors(prev => ({
        ...prev,
        email: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL,
      }));
      return;
    }

    // バリデーション成功時にエラークリア
    setEditErrors({});

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPut<any>(`/api/users/${id}`, {
        name: formData.name,
        email: formData.email,
        user_role: formData.user_role === ROLE_OPTIONS.SYSTEM_ADMIN ? UserRole.ADMIN :
          formData.user_role === ROLE_OPTIONS.TEST_MANAGER ? UserRole.TEST_MANAGER : UserRole.GENERAL,
        department: formData.department,
        company: formData.company,
        password: formData.password || undefined,
        tags: formData.tags,
        status: formData.is_deleted === STATUS_OPTIONS.ENABLE ? false : true
      });

      if (result.success) {
        clientLogger.info('ユーザ編集画面', 'ユーザデータ更新成功', { userId: result.data.id });
        setEditModalMessage(result.message);
        setIsApiSuccess(result.success);
        setIsEditModalOpen(true);
        setTimeout(() => {
          router.push('/user');
        }, 1500);
      } else {
        clientLogger.error('ユーザ編集画面', 'ユーザデータ更新失敗', { error: result.error instanceof Error ? result.error.message : String(result.error) });
        setEditModalMessage('ユーザの更新に失敗しました');
        setIsEditModalOpen(true);
      }
    } catch (err) {
      clientLogger.error('ユーザ編集画面', 'ユーザデータ更新エラー', { error: err instanceof Error ? err.message : String(err) });
      setEditModalMessage('ユーザの更新に失敗しました');
      setIsEditModalOpen(true);
    } finally {
      setIsEditLoading(false);
    }
  };

  const closeModal = (isApiSuccess: boolean) => {
    setIsEditModalOpen(false);
    // 更新成功時はユーザ一覧へ遷移する
    if (isApiSuccess) {
      router.push('/user');
    }
  };

  const buttons = [
    {
      label: isEditLoading ? '更新中...' : '更新',
      onClick: () => {
        clientLogger.info('ユーザ編集画面', '更新ボタン押下');
        handleEditer();
      },
      disabled: isEditLoading,
    },
    {
      label: '戻る',
      onClick: () => {
        clientLogger.info('ユーザ編集画面', '戻るボタン押下');
        router.back();
      },
      isCancel: true
    }
  ];

  return (
    <div>
      {/* タグ読み込みエラー表示 */}
      {tagError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">タグの読み込みに失敗しました</p>
        </div>
      )}
      <>
        <VerticalForm fields={fields} />
        <ButtonGroup buttons={buttons} />
      </>
      <Modal open={isEditLoading} onClose={() => setIsEditLoading(false)} isUnclosable={true}>
        <div className="flex justify-center">
          <Loading
            isLoading={true}
            message="データ更新中..."
            size="md"
          />
        </div>
      </Modal>
      {/* 結果モーダル */}
      <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <p className="mb-8">{editModalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => closeModal(isApiSuccess)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
}