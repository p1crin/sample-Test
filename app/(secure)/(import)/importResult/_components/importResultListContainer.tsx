'use client';
import { useEffect, useState } from 'react';
import clientLogger from '@/utils/client-logger';
import { Column } from '@/components/datagrid/DataGrid';
import { ImportResultListRow } from './types/import-result-list-row';
import { getDataList, getDataCount } from '../action';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ImportResultList } from './importResultList';

export function ImportResultListContainer() {
  const [menuItems, setMenuItems] = useState<ImportResultListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ImportResultListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);
  const pageSize = 10;
  const router = useRouter();

  // APIエラーがある場合はスロー（error.tsx がキャッチする）
  if (apiError) {
    throw apiError;
  }

  useEffect(() => {
    const getDataCountFunc = async () => {
      try {
        const result = await getDataCount();
        if (!result.success || !result.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${result.error})`);
        }
        setPageCount(result.success && result.data ? Math.ceil(result.data / pageSize) : 0);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        clientLogger.error('ImportResultListContainer', 'インポート結果数取得失敗', {
          error: error.message,
        });
        setApiError(error);
      }
    };
    getDataCountFunc();

  }, []);

  useEffect(() => {
    let ignore = false;
    clientLogger.info('UserListContainer', 'データ取得開始', { page });

    const getDataListFunc = async () => {
      try {
        const userData = await getDataList({ page: page });
        if (!userData.success || !userData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${userData.error})`);
        }
        if (!ignore) setMenuItems(userData.data);
        clientLogger.info('UserListContainer', 'データ取得成功', {
          page,
          count: userData.data?.length,
        });
      } catch (err) {
        if (!ignore) setMenuItems([]);
        const error = err instanceof Error ? err : new Error(String(err));
        clientLogger.error('ImportResultListContainer', 'インポート結果リスト取得失敗', {
          page,
          error: error.message,
        });
        if (!ignore) setApiError(error);
      }
    };
    getDataListFunc();
    return () => {
      ignore = true;
    };
  }, [page]);

  const handleSort = (key: keyof ImportResultListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns: Column<ImportResultListRow>[] = [
    { key: 'fileName', header: 'ファイル名', },
    { key: 'importDate', header: 'インポート日時', },
    { key: 'importStatus', header: 'インポート状況', },
    { key: 'execterName', header: '実施者', },
  ];

  const toImportInfoPage = (id: string) => {
    router.push(`/importResult/importInfo/${id}`);
  };

  const renderActions = (item: ImportResultListRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button variant="default" onClick={() => toImportInfoPage(item.id.toString())}>
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
  );
}