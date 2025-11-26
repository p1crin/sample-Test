import { useState, useEffect } from 'react';
import { CreateUserListRow } from '../../_components/types/user-list-row';
import { VerticalForm } from '@/components/ui/verticalForm';
import { useRouter } from 'next/navigation';
import ButtonGroup from '@/components/ui/buttonGroup';
import { getTagOptions } from '../action';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/constants/constants';

export type UserEditFormState = CreateUserListRow;

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
  onClear: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function UserEditForm({
  id,
  form,
  errors,
  onChange,
  onClear,
  onSubmit,
}: UserEditFormProps) {
  const router = useRouter();
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);

  useEffect(() => {
    async function fetchTagOptions() {
      const result = await getTagOptions();
      if (result.success && result.data) {
        setTagOptions(result.data);
      }
    }
    fetchTagOptions();
  }, []);

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'text',
      name: 'email',
      value: '',
      onChange: () => { },
      placeholder: 'ID (メールアドレス)'
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: '',
      onChange: () => { },
      placeholder: '氏名'
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: '',
      onChange: () => { },
      placeholder: '部署'
    },
    {
      label: '会社名',
      type: 'text',
      name: 'conpany',
      value: '',
      onChange: () => { },
      placeholder: '会社名'
    },
    {
      label: '権限',
      type: 'select',
      name: 'role',
      value: '',
      placeholder: '権限',
      onChange: () => { },
      options: Object.values(ROLE_OPTIONS).map(role => ({
        value: role,
        label: role
      }))
    },
    {
      label: 'パスワード',
      type: 'password',
      name: 'password',
      value: '',
      onChange: () => { },
      placeholder: 'パスワード'
    },
    {
      label: 'タグ',
      type: 'addableTag',
      name: 'tag',
      value: '',
      onChange: () => { },
      placeholder: 'タグ',
      options: tagOptions
    },
    {
      label: 'ステータス',
      type: 'select',
      name: 'status',
      value: '',
      onChange: () => { },
      placeholder: 'ステータス',
      options: Object.values(STATUS_OPTIONS).map(status => ({
        value: status,
        label: status
      }))
    },
  ];

  const sampleValue = {
    email: "Sample1@sample.com",
    name: "テスト1郎",
    department: "部署1",
    role: "システム管理者",
    conpany: "会社名1",
    password: "",
    tag: ["タグA", "タグB", "タグC"],
    status: "有効"
  };

  const handleEditer = () => {
    // 更新処理をここに記述
    console.log('ユーザ編集');
    router.push('/user', { scroll: false });
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    router.push('/user', { scroll: false });
  };

  const buttons = [
    {
      label: '更新',
      onClick: handleEditer
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true
    }
  ];

  return (
    <div>
      <VerticalForm fields={fields} values={sampleValue} />
      <ButtonGroup buttons={buttons} />
    </div>
  );
}