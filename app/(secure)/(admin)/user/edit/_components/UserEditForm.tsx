import ButtonGroup from '@/components/ui/buttonGroup';
import { VerticalForm } from '@/components/ui/verticalForm';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/constants/constants';
import { UserRole } from '@/types';
import { fetchData } from '@/utils/api';
import clientLogger from '@/utils/client-logger';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateUserListRow } from '../../_components/types/user-list-row';
import { userEditSchema } from './schemas/user-edit-schema';

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
  errors: Record<string, string[]>;
  onChange: (e: UserEditChangeData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function UserEditForm({
  id,
  form,
  errors,
  onChange,
  onSubmit,
}: UserEditFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [editError, setEditErrors] = useState<Record<string, string>>({});


  useEffect(() => {
    setFormData(form);
  }, [form]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const result = await fetchData('/api/tags');

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
        return ROLE_OPTIONS.SYSTEM_ADMIN;
      case UserRole.TEST_MANAGER:
        return ROLE_OPTIONS.TEST_MANAGER;
      default:
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

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'text',
      name: 'email',
      value: formData.email,
      onChange: handleInputChange,
      placeholder: 'ID (メールアドレス)'
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: formData.name,
      onChange: handleInputChange,
      placeholder: '氏名'
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: formData.department,
      onChange: handleInputChange,
      placeholder: '部署'
    },
    {
      label: '会社名',
      type: 'text',
      name: 'conpany',
      value: formData.company,
      onChange: handleInputChange,
      placeholder: '会社名'
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
      }))
    },
    {
      label: 'パスワード',
      type: 'password',
      name: 'password',
      value: formData.password,
      onChange: handleInputChange,
      placeholder: 'パスワード'
    },
    {
      label: 'タグ',
      type: 'addableTag',
      name: 'tags',
      value: formData.tags,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('tags', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグ',
      options: tagOptions
    },
    {
      label: 'ステータス',
      type: 'select',
      name: 'status',
      value: formData.status,
      onChange: handleInputChange,
      placeholder: 'ステータス',
      options: Object.values(STATUS_OPTIONS).map(status => ({
        value: status,
        label: status
      }))
    },
  ];

  const handleEditer = async () => {
    // 更新処理をここに記述
    console.log('ユーザ編集');
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

    } catch (error) {

    }

    router.push('/user', { scroll: false });
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    router.push('/user', { scroll: false });
  };

  const buttons = [
    {
      label: '更新',
      onClick: () => {
        clientLogger.info('ユーザ編集画面', '更新ボタン押下');
        handleEditer();
      }
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true
    }
  ];

  return (
    <div>
      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />
    </div>
  );
}