import serverLogger from '@/utils/server-logger';
import { TestGroupCopyFormState } from './_components/TestGroupCopyForm';

interface GetDataParams {
  groupId: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function saveData(params: TestGroupCopyFormState): Promise<Result<number>> {
  try {
    serverLogger.info(`saveData Resquest`, { params });

    // TODO 保存処理

    return { success: true, data: 1 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getData(params: GetDataParams): Promise<Result<TestGroupCopyFormState>> {
  try {
    serverLogger.info(`getData Resquest`, { groupId: params.groupId });

    const data: TestGroupCopyFormState = {
      oem: '',
      model: '',
      destination: '',
      event: '',
      variation: '',
      specs: '',
      testDatespan: '',
      ngPlanCount: '',
      created_at: '',
      updated_at: ''
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