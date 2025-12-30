import serverLogger from '@/utils/server-logger';
import { TestSummaryResultListRow } from "./_componets/types/test-summary-result-list-row";

interface GetDataListParams {
  page?: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getDataCount(): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Request`);

    return { success: true, data: 50 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<TestSummaryResultListRow[]>> {
  try {
    serverLogger.info(`getDataList Request`, { id: params.page });

    const page = !params.page ? 0 : params.page;
    const baseId: number = (page - 1) * 10 + 1;
    const data: TestSummaryResultListRow[] = [
      { firstLayer: `第1層${baseId}`, secondLayer: `第2層${baseId}`, totalCount: 10, targetCount: 10 - 0, completedCount: 4 + 1, notStartedCount: 2, inProgressCount: 1, okCount: 4, ngCount: 1, excludedCount: 0, okRate: Number((4 / (10 - 0) * 100).toFixed(1)), progressRate: Number(((4 + 1) / (10 - 0) * 100).toFixed(1)) },
      { firstLayer: `第1層${baseId}`, secondLayer: `第2層${baseId + 1}`, totalCount: 10, targetCount: 10 - 0, completedCount: 4 + 1, notStartedCount: 2, inProgressCount: 1, okCount: 4, ngCount: 1, excludedCount: 0, okRate: Number((4 / (10 - 0) * 100).toFixed(1)), progressRate: Number(((4 + 1) / (10 - 0) * 100).toFixed(1)) },
      { firstLayer: `第1層${baseId + 1}`, secondLayer: `第2層${baseId}`, totalCount: 20, targetCount: 20 - 0, completedCount: 8 + 2, notStartedCount: 5, inProgressCount: 0, okCount: 8, ngCount: 2, excludedCount: 0, okRate: Number((8 / (20 - 0) * 100).toFixed(1)), progressRate: Number(((8 + 2) / (20 - 0) * 100).toFixed(1)) },
      { firstLayer: `第1層${baseId + 2}`, secondLayer: `第2層${baseId}`, totalCount: 30, targetCount: 30 - 0, completedCount: 18 + 2, notStartedCount: 5, inProgressCount: 0, okCount: 18, ngCount: 2, excludedCount: 0, okRate: Number((18 / (30 - 0) * 100).toFixed(1)), progressRate: Number(((18 + 2) / (30 - 0) * 100).toFixed(1)) },
      { firstLayer: `第1層${baseId + 3}`, secondLayer: `第2層${baseId}`, totalCount: 40, targetCount: 40 - 0, completedCount: 28 + 2, notStartedCount: 5, inProgressCount: 0, okCount: 28, ngCount: 2, excludedCount: 0, okRate: Number((28 / (40 - 0) * 100).toFixed(1)), progressRate: Number(((28 + 2) / (40 - 0) * 100).toFixed(1)) },
      { firstLayer: `第1層${baseId + 4}`, secondLayer: `第2層${baseId}`, totalCount: 50, targetCount: 50 - 0, completedCount: 38 + 2, notStartedCount: 5, inProgressCount: 0, okCount: 38, ngCount: 2, excludedCount: 0, okRate: Number((38 / (50 - 0) * 100).toFixed(1)), progressRate: Number(((38 + 2) / (50 - 0) * 100).toFixed(1)) },
      { firstLayer: `第1層${baseId + 4}`, secondLayer: `第2層${baseId + 1}`, totalCount: 50, targetCount: 50 - 0, completedCount: 38 + 2, notStartedCount: 5, inProgressCount: 0, okCount: 38, ngCount: 2, excludedCount: 0, okRate: Number((38 / (50 - 0) * 100).toFixed(1)), progressRate: Number(((38 + 2) / (50 - 0) * 100).toFixed(1)) },
    ];
    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}