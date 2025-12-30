import serverLogger from '@/utils/server-logger';
import { TestCaseListRow } from '../_components/types/testCase-list-row';

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
    serverLogger.info(`getDataCount Resquest`);

    return { success: true, data: 50 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<TestCaseListRow[]>> {
  try {
    serverLogger.info(`getDataList Request`, { id: params.page });

    const page = !params.page ? 0 : params.page;
    const baseId: number = (page - 1) * 10 + 1;
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      return `${year}/${month}/${day}`;
    };
    const data: TestCaseListRow[] = [
      { tid: `${baseId}-1-1`, firstLayer: `第1層-${baseId}`, secondLayer: `第2層-${baseId}`, thirdLayer: `第3層-${baseId}`, fourthLayer: `第4層-${baseId}`, purpose: `目的${baseId}`, requestId: `要求ID-${baseId}`, checkItems: `確認観点${baseId}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 10, ngCount: 10, notStartCount: 70, excludedCount: 10 } },
      { tid: `${baseId + 1}-1-1`, firstLayer: `第1層-${baseId + 1}`, secondLayer: `第2層-${baseId + 1}`, thirdLayer: `第3層-${baseId + 1}`, fourthLayer: `第4層-${baseId + 1}`, purpose: `目的${baseId + 1}`, requestId: `要求ID-${baseId + 1}`, checkItems: `確認観点${baseId + 1}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 70, ngCount: 10, notStartCount: 10, excludedCount: 10 } },
      { tid: `${baseId + 2}-1-1`, firstLayer: `第1層-${baseId + 2}`, secondLayer: `第2層-${baseId + 2}`, thirdLayer: `第3層-${baseId + 2}`, fourthLayer: `第4層-${baseId + 2}`, purpose: `目的${baseId + 2}`, requestId: `要求ID-${baseId + 2}`, checkItems: `確認観点${baseId + 2}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 60, ngCount: 10, notStartCount: 20, excludedCount: 10 } },
      { tid: `${baseId + 3}-1-1`, firstLayer: `第1層-${baseId + 3}`, secondLayer: `第2層-${baseId + 3}`, thirdLayer: `第3層-${baseId + 3}`, fourthLayer: `第4層-${baseId + 3}`, purpose: `目的${baseId + 3}`, requestId: `要求ID-${baseId + 3}`, checkItems: `確認観点${baseId + 3}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 50, ngCount: 10, notStartCount: 20, excludedCount: 20 } },
      { tid: `${baseId + 4}-1-1`, firstLayer: `第1層-${baseId + 4}`, secondLayer: `第2層-${baseId + 4}`, thirdLayer: `第3層-${baseId + 4}`, fourthLayer: `第4層-${baseId + 4}`, purpose: `目的${baseId + 4}`, requestId: `要求ID-${baseId + 4}`, checkItems: `確認観点${baseId + 4}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 40, ngCount: 20, notStartCount: 30, excludedCount: 10 } },
      { tid: `${baseId + 5}-1-1`, firstLayer: `第1層-${baseId + 5}`, secondLayer: `第2層-${baseId + 5}`, thirdLayer: `第3層-${baseId + 5}`, fourthLayer: `第4層-${baseId + 5}`, purpose: `目的${baseId + 5}`, requestId: `要求ID-${baseId + 5}`, checkItems: `確認観点${baseId + 5}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 30, ngCount: 10, notStartCount: 20, excludedCount: 40 } },
      { tid: `${baseId + 6}-1-1`, firstLayer: `第1層-${baseId + 6}`, secondLayer: `第2層-${baseId + 6}`, thirdLayer: `第3層-${baseId + 6}`, fourthLayer: `第4層-${baseId + 6}`, purpose: `目的${baseId + 6}`, requestId: `要求ID-${baseId + 6}`, checkItems: `確認観点${baseId + 6}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 10, ngCount: 20, notStartCount: 10, excludedCount: 70 } },
      { tid: `${baseId + 7}-1-1`, firstLayer: `第1層-${baseId + 7}`, secondLayer: `第2層-${baseId + 7}`, thirdLayer: `第3層-${baseId + 7}`, fourthLayer: `第4層-${baseId + 7}`, purpose: `目的${baseId + 7}`, requestId: `要求ID-${baseId + 7}`, checkItems: `確認観点${baseId + 7}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 10, ngCount: 10, notStartCount: 0, excludedCount: 80 } },
      { tid: `${baseId + 8}-1-1`, firstLayer: `第1層-${baseId + 8}`, secondLayer: `第2層-${baseId + 8}`, thirdLayer: `第3層-${baseId + 8}`, fourthLayer: `第4層-${baseId + 8}`, purpose: `目的${baseId + 8}`, requestId: `要求ID-${baseId + 8}`, checkItems: `確認観点${baseId + 8}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 0, ngCount: 10, notStartCount: 0, excludedCount: 90 } },
      { tid: `${baseId + 9}-1-1`, firstLayer: `第1層-${baseId + 9}`, secondLayer: `第2層-${baseId + 9}`, thirdLayer: `第3層-${baseId + 9}`, fourthLayer: `第4層-${baseId + 9}`, purpose: `目的${baseId + 9}`, requestId: `要求ID-${baseId + 9}`, checkItems: `確認観点${baseId + 9}`, createdAt: formatDate(new Date()), updatedAt: formatDate(new Date()), chartData: { okCount: 0, ngCount: 0, notStartCount: 0, excludedCount: 100 } },
    ];
    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}
