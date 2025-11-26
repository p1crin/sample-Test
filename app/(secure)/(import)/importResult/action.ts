import serverLogger from '@/utils/server-logger';
import { ImportResultListRow } from './_components/types/import-result-list-row';

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

export async function getDataList(params: GetDataListParams): Promise<Result<ImportResultListRow[]>> {
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
    const data: ImportResultListRow[] = [
      { id: baseId, fileName: `ユーザインポート${baseId}.csv`, importDate: formatDate(new Date()), importStatus: '実施中', execterName: `実施者${baseId}` },
      { id: baseId + 1, fileName: `ユーザインポート${baseId + 1}.csv`, importDate: formatDate(new Date()), importStatus: '完了', execterName: `実施者${baseId + 1}` },
      { id: baseId + 2, fileName: `ユーザインポート${baseId + 2}.csv`, importDate: formatDate(new Date()), importStatus: 'エラー', execterName: `実施者${baseId + 2}` },
      { id: baseId + 3, fileName: `テストインポート${baseId + 3}.zip`, importDate: formatDate(new Date()), importStatus: '実施中', execterName: `実施者${baseId + 3}` },
      { id: baseId + 4, fileName: `テストインポート${baseId + 4}.zip`, importDate: formatDate(new Date()), importStatus: '完了', execterName: `実施者${baseId + 4}` },
      { id: baseId + 5, fileName: `テストインポート${baseId + 5}.zip`, importDate: formatDate(new Date()), importStatus: 'エラー', execterName: `実施者${baseId + 5}` },
      { id: baseId + 6, fileName: `ユーザインポート${baseId + 6}.csv`, importDate: formatDate(new Date()), importStatus: '完了', execterName: `実施者${baseId + 6}` },
      { id: baseId + 7, fileName: `ユーザインポート${baseId + 7}.csv`, importDate: formatDate(new Date()), importStatus: '完了', execterName: `実施者${baseId + 7}` },
      { id: baseId + 8, fileName: `ユーザインポート${baseId + 8}.csv`, importDate: formatDate(new Date()), importStatus: '完了', execterName: `実施者${baseId + 8}` },
      { id: baseId + 9, fileName: `ユーザインポート${baseId + 9}.csv`, importDate: formatDate(new Date()), importStatus: '完了', execterName: `実施者${baseId + 9}` },
    ];

    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}
