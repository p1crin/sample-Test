'use client';
import Loading from '@/components/ui/loading';
import { STATUS_OPTIONS } from '@/constants/constants';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { UserEditFormState } from './UserEditForm';
import { UserEditForm } from './UserEditForm';

export function UserEditFormContainer() {
  const params = useParams();
  const userId = parseInt(params.userId as string, 10);
  const [editLoading, setEditLoading] = useState(true);
  const [form, setForm] = useState<UserEditFormState>({
    name: '',
    email: '',
    user_role: '',
    department: '',
    company: '',
    password: '',
    tags: [] as string[],
    is_deleted: '',
  });
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;
  useEffect(() => {
    const getDataFunc = async () => {
      try {
        setEditLoading(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userData = await apiGet<any>(`/api/users/${userId}`);
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
          is_deleted: getEditData.is_deleted ? STATUS_OPTIONS.DISABLE : STATUS_OPTIONS.ENABLE
        }
        setForm(formingEdit);

        clientLogger.info('ユーザ編集画面', 'データ取得成功', { userId: getEditData.id });
      } catch (err) {
        clientLogger.error('ユーザ編集画面', 'データ取得失敗', { error: err instanceof Error ? err.message : String(err) });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setEditLoading(false);
      }
    };
    getDataFunc();
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      <Loading
        isLoading={editLoading}
        message="データ読み込み中..."
        size="md"
      />
      {!editLoading && (
        <UserEditForm
          id={userId}
          form={form}
        />
      )}
    </>
  );
}