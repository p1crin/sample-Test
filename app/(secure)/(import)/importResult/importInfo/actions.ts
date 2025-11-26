import serverLogger from '@/utils/server-logger';
import { ImportInfoListRow } from './_components/types/import-info-list-row';

interface GetImportInfoDataParams {
  id: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getImportInfoData(params: GetImportInfoDataParams): Promise<Result<ImportInfoListRow>> {
  try {
    serverLogger.info(`getImportInfoData Request`, { id: params.id });

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      return `${year}/${month}/${day}`;
    };
    const data: ImportInfoListRow = {
      id: params.id.toString(),
      fileName: "sample-file.csv",
      count: "100",
      importDate: formatDate(new Date()),
      importStatus: "実施中",
      execterName: "実施者1",
      errorDetails: ""
    };

    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching import info data:', error);
    return { success: false, error: 'Failed to fetch import info data.' };
  }
}