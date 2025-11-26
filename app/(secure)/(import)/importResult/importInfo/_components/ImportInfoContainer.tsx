'use client';
import { useEffect, useState } from "react";
import { ImportInfo } from './ImportInfo';
import { ImportInfoListRow } from "./types/import-info-list-row";
import clientLogger from '@/utils/client-logger';
import { getImportInfoData } from "../actions";
import Loading from "@/app/loading";

const labels = {
  fileName: { name: "ファイル名", type: "text" as 'text' },
  count: { name: "件数", type: "text" as 'text' },
  importDate: { name: "インポート日時", type: "text" as 'text' },
  importStatus: { name: "インポート状況", type: "text" as 'text' },
  execterName: { name: "実施者", type: "text" as 'text' },
  errorDetails: { name: "エラー詳細", type: "text" as 'text' },
};

type ImportInfoContainerProps = {
  id: number
}

export function ImportInfoContainer({ id }: ImportInfoContainerProps) {
  const [data, setData] = useState<ImportInfoListRow | null>(null);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const importInfoData = await getImportInfoData({ id: id });
        if (!importInfoData.success || !importInfoData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${importInfoData.error})`);
        }
        setData(importInfoData.data);
        setLabelData(labels);
        clientLogger.info('ImportInfoContainer', 'データ取得成功', { data: importInfoData.data.id });
      } catch (err) {
        clientLogger.error('ImportInfoContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('データの取得に失敗しました');
      }
    };

    fetchData();
  }, [id]);

  return (
    <div className='space-y-4'>
      {data ? (
        <ImportInfo labels={labelData} values={data} />
      ) : (
        Loading()
      )}
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
    </div>
  );
}