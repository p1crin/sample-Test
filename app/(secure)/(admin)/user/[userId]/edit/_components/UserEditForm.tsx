import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/constants/constants';
import { UserRole } from '@/types';
import { apiGet, apiPut } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateUserListRow } from '../../../_components/types/user-list-row';
import { userEditSchema } from './schemas/user-edit-schema';
import { ERROR_MESSAGES } from '@/constants/errorMessages';

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
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [editError, setEditErrors] = useState<Record<string, string>>({});
  const [editModalMessage, setEditModalMessage] = useState('');
  const [editIsModalOpen, setEditIsModalOpen] = useState(false);
  const [editIsLoading, setEditIsLoading] = useState(false);

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
      } catch (error) {
        clientLogger.error('TestGroupRegistration', 'タグ取得エラー', { error });
        setTagError(error instanceof Error ? error.message : 'タグの取得に失敗しました');
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

  const handleBlur = async () => {
    if (!formData.email.trim()) {
      return;
    }

    clientLogger.info('ユーザ編集画面', 'ID(メールアドレス)重複チェック開始', { email: formData.email });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiGet<any>(`/api/users/check-email?id=${id}&email=${encodeURIComponent(formData.email)}`);

      if (result.success && result.isDuplicate) {
        setEditErrors(prev => ({
          ...prev,
          email: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL
        }));
        clientLogger.warn('ユーザ編集画面', 'ID(メールアドレス)重複', { email: formData.email });
      } else {
        // ID(メールアドレス)が重複していない場合、エラークリア
        setEditErrors(prev => {
          const newError = { ...prev };
          delete newError.email;
          return newError;
        });
        clientLogger.info('ユーザ編集画面', 'ID(メールアドレス)重複なし', { email: formData.email });
      }
    } catch (error) {
      clientLogger.error('ユーザ編集画面', 'ID(メールアドレス)重複チェックエラー', { error });
    }
  }


  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'text',
      name: 'email',
      value: formData.email,
      onChange: handleInputChange,
      placeholder: 'ID (メールアドレス)',
      onBlur: handleBlur,
      error: editError.email
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: formData.name,
      onChange: handleInputChange,
      placeholder: '氏名',
      error: editError.name
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: formData.department,
      onChange: handleInputChange,
      placeholder: '部署',
      error: editError.department
    },
    {
      label: '会社名',
      type: 'text',
      name: 'conpany',
      value: formData.company,
      onChange: handleInputChange,
      placeholder: '会社名',
      error: editError.company
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
      error: editError.user_role
    },
    {
      label: 'パスワード',
      type: 'password',
      name: 'password',
      value: formData.password,
      onChange: handleInputChange,
      placeholder: 'パスワード',
      error: editError.password
    },
    {
      label: 'タグ',
      type: 'addableTag',
      name: 'tags',
      value: formData.tags,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('tags', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグ',
      options: tagOptions,
      error: editError.tags
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
      error: editError.is_deleted
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

    // バリデーション成功時にエラークリア
    setEditErrors({});

    try {
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
        setEditIsModalOpen(true);
        setTimeout(() => {
          router.push('/user');
        }, 1500);
      } else {
        clientLogger.error('ユーザ編集画面', 'ユーザデータ更新失敗', { error: result.error });
        setEditModalMessage('ユーザの更新に失敗しました');
        setEditIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('ユーザ編集画面', 'ユーザデータ更新エラー', { error });
      setEditModalMessage('ユーザの更新に失敗しました');
      setEditIsModalOpen(true);
    } finally {
      setEditIsLoading(false);
    }
  };

  // キャンセルボタン押下時処理
  const handleCancel = () => {
    router.back();
  };

  const buttons = [
    {
      label: editIsLoading ? '更新中...' : '更新',
      onClick: () => {
        clientLogger.info('ユーザ編集画面', '更新ボタン押下');
        handleEditer();
      },
      disabled: editIsLoading,
    },
    {
      label: '戻る',
      onClick: () => {
        handleCancel()
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
      {/* 結果モーダル */}
      <Modal open={editIsModalOpen} onClose={() => setEditIsModalOpen(false)}>
        <p className="mb-8">{editModalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setEditIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}