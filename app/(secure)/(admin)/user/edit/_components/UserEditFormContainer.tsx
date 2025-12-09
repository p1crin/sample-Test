'use client';
import { useState, useEffect } from 'react';
import clientLogger from '@/utils/client-logger';
import { userEditSchema } from './schemas/user-edit-schema';
import { UserEditForm } from './UserEditForm';
import type { UserEditChangeData, UserEditFormState } from './UserEditForm';
import { getData, saveData } from '../action';

type UserEditFormContainerProps = {
  id: number;
};

export function UserEditFormContainer({ id }: UserEditFormContainerProps) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);

  if (apiError) throw apiError;

  // 初期データ
  const initialForm: UserEditFormState = {
    name: '',
    email: '',
    role: '一般',
    department: '',
    company: '',
    tag: '',
    status: true,
  };

  const [form, setForm] = useState<UserEditFormState>(initialForm);

  const handleClear = () => {
    setForm(initialForm);
  };

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
        const userData = await getData({ id: id });
        if (!userData.success || !userData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${userData.error})`);
        }
        setForm(userData.data);
        clientLogger.info('UserEditFormContainer', 'データ取得成功', { data: userData.data.name });
      } catch (err) {
        clientLogger.error('UserEditFormContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    getDataFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      <UserEditForm
        id={id}
        form={form}
        errors={errors}
        onChange={handleChange}
        onClear={handleClear}
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