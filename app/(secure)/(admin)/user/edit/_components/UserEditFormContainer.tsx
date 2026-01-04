'use client';
import { STATUS_OPTIONS } from '@/constants/constants';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState } from 'react';
import { saveData } from '../action';
import { userEditSchema } from './schemas/user-edit-schema';
import type { UserEditChangeData, UserEditFormState } from './UserEditForm';
import { UserEditForm } from './UserEditForm';

type UserEditFormContainerProps = {
  id: number;
};

export function UserEditFormContainer({ id }: UserEditFormContainerProps) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<UserEditFormState>({
    name: '',
    email: '',
    user_role: '',
    department: '',
    company: '',
    password: '',
    tags: [] as string[],
    status: '',
  });

  const handleChange = (e: UserEditChangeData) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    try {
      const result = userEditSchema.safeParse(form);
      if (!result.success) {
        // Zodのエラーを各フィールドごとにまとめる
        const fieldErrors: Record<string, string[]> = {};
        result.error.errors.forEach((err) => {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = [];
          fieldErrors[key].push(err.message);
        });
        setErrors(fieldErrors);
        return;
      }

      const saveDataFunc = async () => {
        try {
          const userData = await saveData(form);
          if (!userData.success || !userData.data) {
            throw new Error('データの取得に失敗しました' + ` (error: ${userData.error})`);
          }
          clientLogger.info('UserEditFormContainer', 'データ保存成功');
        } catch (err) {
          clientLogger.error('UserEditFormContainer', 'データ保存失敗', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };
      saveDataFunc();
    } catch {
      setLoadError('送信時に予期せぬエラーが発生しました');
    }
  };

  useEffect(() => {
    const getDataFunc = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userData = await apiGet<any>(`/api/users/${id}`);

        if (!userData.success || !userData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${userData.error})`);
        }

        const getEditData = userData.data;
        const formingEdit: UserEditFormState = {
          name: getEditData.name,
          email: getEditData.email,
          user_role: getEditData.user_role,
          department: getEditData.department,
          company: getEditData.company,
          password: '',
          tags: getEditData.userTags,
          status: getEditData.status ? STATUS_OPTIONS.ENABLE : STATUS_OPTIONS.DISABLE
        }
        setForm(formingEdit);

        clientLogger.info('ユーザ編集画面', 'データ取得成功', { data: userData.data.name });
      } catch (err) {
        clientLogger.error('ユーザ編集画面', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    getDataFunc();
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      <UserEditForm
        id={id}
        form={form}
        errors={errors}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
    </>
  );
}