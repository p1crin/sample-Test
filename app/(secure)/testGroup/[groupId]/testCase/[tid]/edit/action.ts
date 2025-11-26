import serverLogger from '@/utils/server-logger';
import { TestCaseEditFormState } from './_components/TestCaseEditForm';

interface GetDataParams {
  id: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function saveData(params: TestCaseEditFormState): Promise<Result<number>> {
  try {
    serverLogger.info(`saveData Resquest`, { params });

    // TODO 保存処理

    return { success: true, data: 1 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getData(params: GetDataParams): Promise<Result<TestCaseEditFormState>> {
  try {
    serverLogger.info(`getData Resquest`, { id: params.id });

    const data: TestCaseEditFormState = {
      tid: '12345',
      firstLayer: '第1層-1',
      secondLayer: '第2層-1',
      thirdLayer: '第3層-1',
      fourthLayer: '第4層-1',
      purpose: 'テスト目的',
      requestId: '要求ID',
      checkItems: 'チェック項目1, チェック項目2',
      createdAt: '2025-09-12T16:46:27.981865108',
      updatedAt: '2025-09-12T16:46:27.981865108',
      chartData: {
        okCount: 0,
        ngCount: 0,
        notStartCount: 0,
        excludedCount: 0
      }
    };

    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}
