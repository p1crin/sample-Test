'use client';
import { IMPORT_STATUS } from "@/constants/constants";
import { apiGet } from "@/utils/apiClient";
import clientLogger from '@/utils/client-logger';
import { formatDateTimeJST } from "@/utils/date-formatter";
import { useEffect, useState } from "react";
import { ImportInfo } from './ImportInfo';
import { ImportInfoListRow } from "./types/import-info-list-row";
import Loading from "@/components/ui/loading";

const labels = {
  file_name: { name: "ファイル名", type: "text" as 'text' },
  count: { name: "件数", type: "text" as 'text' },
  created_at: { name: "インポート日時", type: "text" as 'text' },
  import_status: { name: "インポート状況", type: "text" as 'text' },
  executor_name: { name: "実施者", type: "text" as 'text' },
  message: { name: "エラー詳細", type: "text" as 'text' },
};

type ImportInfoContainerProps = {
  id: number
}

export function ImportInfoContainer({ id }: ImportInfoContainerProps) {
  const [data, setData] = useState({
    id: '',
    file_name: '',
    count: '',
    import_status: '',
    executor_name: '',
    created_at: '',
    message: '',
  });
  const [importInfoLoading, setImportInfoLoading] = useState(true);
  const [labelData, setLabelData] = useState(labels);
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;

  useEffect(() => {
    const getDataFunc = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importInfoData = await apiGet<any>(`/api/import-results/${id}`);

        // 取得したデータをフォーマット
        const formattedImportInfo: ImportInfoListRow = {
          ...importInfoData.data,
          count: importInfoData.data.count.toString(),
          import_status: importInfoData.data.import_status === 0 ? IMPORT_STATUS.EXECUTING : importInfoData.data.import_status === 1 ? IMPORT_STATUS.COMPLETE : IMPORT_STATUS.ERROR,
          created_at: formatDateTimeJST(importInfoData.data.created_at),
          updated_at: formatDateTimeJST(importInfoData.data.updated_at)
        };
        setData(formattedImportInfo);
        setLabelData(labels);
        clientLogger.info('インポート内容確認画面', 'データ取得成功', { data: importInfoData.data.id });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('インポート内容確認画面', 'データ取得失敗', { error: errorMessage });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setImportInfoLoading(false);
      }
    };
    getDataFunc();
  }, [id]);

  return (

    <div className='space-y-4'>
      <Loading
        isLoading={importInfoLoading}
        message="データを読み込み中..."
        size="md"
      />
      {!importInfoLoading && (
        <ImportInfo labels={labelData} values={data} />
      )}
    </div>
  );
}