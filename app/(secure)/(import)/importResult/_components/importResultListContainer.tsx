'use client';
import { Column } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { IMPORT_STATUS, IMPORT_TYPE } from '@/constants/constants';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { formatDateTimeJST } from '@/utils/date-formatter';
import { buildQueryString, updateUrlParams } from '@/utils/queryUtils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ImportResultList } from './importResultList';
import { ImportResultListRow } from './types/import-result-list-row';

export function ImportResultListContainer() {
  const [menuItems, setMenuItems] = useState<ImportResultListRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageCount, setPageCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ImportResultListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [importResultLoading, setImportResultLoading] = useState(true);
  const pageSize = 10;
  const router = useRouter();
  const searchParamsQuery = useSearchParams();
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;
  const pagePath = '/importResult'
  // URLパラメータをコンポーネント状態に同期する
  useEffect(() => {
    const pageNum = parseInt(searchParamsQuery.get('page') || '1', 10);
    const hasPageInUrl = searchParamsQuery.get('page') !== null;
    setPage(pageNum);
    setIsInitialized(true);

    // URLにページパラメータがない場合は、URLを更新(初期表示や再度バーからの遷移時)
    if (!hasPageInUrl) {
      updateUrlParams(router, {}, pagePath, pageNum);
    }
  }, [searchParamsQuery]);

  useEffect(() => {
    // URLパラメータ同期が完了するまで待つ
    if (!isInitialized) {
      return;
    }
    let ignore = false;

    const getDataFunc = async () => {
      try {
        clientLogger.debug('インポート結果一覧画面', 'データ取得開始', { page });
        setImportResultLoading(true);
        const queryString = buildQueryString({}, page, pageSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const importResultData = await apiGet<any>(`/api/import-results?${queryString}`);
        const count = importResultData.totalCount || (importResultData.data ? importResultData.data.length : 0);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        if (!ignore) {
          // 取得したデータをフォーマット
          const formattedImportResults = importResultData.data.map((importResult: typeof importResultData.data[0]) => {
            let importStatus;
            switch (importResult.import_status) {
              case 1:
                importStatus = IMPORT_STATUS.COMPLETE;
                break;
              case 2:
                importStatus = IMPORT_STATUS.ERROR;
                break;
              default:
                importStatus = IMPORT_STATUS.EXECUTING;
            }

            const importType = importResult.import_type == 0 ? IMPORT_TYPE.USER : IMPORT_TYPE.TEST_CASE;


            return {
              ...importResult,
              import_status: importStatus,
              import_type: importType,
              created_at: formatDateTimeJST(importResult.created_at),
              updated_at: formatDateTimeJST(importResult.updated_at),
            };
          });
          setMenuItems(formattedImportResults);
        }
        clientLogger.info('インポート結果一覧画面', 'データ取得成功', {
          page,
          count: importResultData.data?.length,
        });
      } catch (err) {
        if (!ignore) setMenuItems([]);
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('インポート結果一覧画面', 'データ取得失敗',
          page,
          { error: errorMessage });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setImportResultLoading(false);
      }
    };
    getDataFunc();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, isInitialized]);

  const handleSort = (key: keyof ImportResultListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns: Column<ImportResultListRow>[] = [
    { key: 'file_name', header: 'ファイル名', },
    { key: 'import_type', header: '種別' },
    { key: 'created_at', header: 'インポート日時', },
    { key: 'import_status', header: 'インポート状況', },
    { key: 'executor_name', header: '実施者', },
  ];

  const toImportInfoPage = (id: string) => {
    router.push(`/importResult/importInfo/${id}`);
  };

  const renderActions = (item: ImportResultListRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button onClick={() => toImportInfoPage(item.id.toString())}>
        確認
      </Button>
    </div>
  );

  const sortedItems = [...menuItems];
  if (sortConfig) {
    sortedItems.sort((a, b) => {
      const key = sortConfig.key;
      const aValue = a[key];
      const bValue = b[key];
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return (
    <div>
      <Loading
        isLoading={importResultLoading}
        message="データを読み込み中..."
        size="md"
      />
      {!importResultLoading && (
        <>
          {sortedItems.length > 0 ? (
            <ImportResultList
              items={sortedItems}
              columns={columns}
              sortConfig={sortConfig}
              page={page}
              pageCount={pageCount}
              onSort={handleSort}
              onPageChange={setPage}
              renderActions={renderActions}
            />
          ) : (
            <div className="text-gray-500 text-2xl text-center py-8">インポート結果がありません</div>
          )}
        </>
      )}
    </div>
  );
}