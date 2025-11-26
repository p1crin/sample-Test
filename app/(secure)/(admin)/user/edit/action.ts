import serverLogger from '@/utils/server-logger';
import { UserEditFormState } from './_components/UserEditForm';

interface GetDataParams {
  id: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function saveData(params: UserEditFormState): Promise<Result<number>> {
  try {
    serverLogger.info(`saveData Resquest`, { params });

    // TODO 保存処理

    return { success: true, data: 1 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getData(params: GetDataParams): Promise<Result<UserEditFormState>> {
  try {
    serverLogger.info(`getData Resquest`, { id: params.id });

    const data: UserEditFormState = {
      name: `データ${params.id}`,
      email: '',
      role: '一般',
      department: '',
      company: '',
      tag: '',
      status: true
    };

    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getTagOptions(): Promise<Result<{ value: string, label: string }[]>> {
  try {
    const tagOptions = [
      { value: 'タグA', label: 'タグA' },
      { value: 'タグB', label: 'タグB' },
      { value: 'タグC', label: 'タグC' },
      { value: 'タグD', label: 'タグD' },
      { value: 'タグE', label: 'タグE' },
      { value: 'タグF', label: 'タグF' },
    ];

    return { success: true, data: tagOptions };
  } catch (error) {
    console.error('Error fetching tag options:', error);
    return { success: false, error: 'Failed to fetch tag options.' };
  }
}