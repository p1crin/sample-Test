'use client';
import { Column } from "@/components/datagrid/DataGrid";
import clientLogger from "@/utils/client-logger";
import { useState, useEffect } from "react";
import { getDataCount, getDataList } from "../action";
import TestSummaryResultGraph from "./TestSummaryResultGraph";
import { TestSummaryResultList } from "./TestSummaryResultList";
import { TestSummaryResultListRow } from "./types/test-summary-result-list-row";
import Loading from "@/app/loading";
import { Button } from "@/components/ui/button";

type TestSummaryResultContainerProps = {
  groupName: string;
};

export default function TestSummaryResultContainer({ groupName }: TestSummaryResultContainerProps) {
  const [menuItems, setMenuItems] = useState<TestSummaryResultListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TestSummaryResultListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<Error | null>(null);
  const pageSize = 10;

  if (apiError) throw apiError;

  useEffect(() => {
    const getDataCountFunc = async () => {
      try {
        const result = await getDataCount();
        if (!result.success || !result.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${result.error})`);
        }
        setPageCount(result.success && result.data ? Math.ceil(result.data / pageSize) : 0);
      } catch (err) {
        clientLogger.error('UserListContainer', 'データ取得失敗', {
          page,
          error: err instanceof Error ? err.message : String(err),
        });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    getDataCountFunc();

  }, []);

  useEffect(() => {
    let ignore = false;
    clientLogger.info('UserListContainer', 'データ取得開始', { page });

    const getDataListFunc = async () => {
      setLoading(true);
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
        if (!ignore) {
          setMenuItems([]);
          setApiError(err instanceof Error ? err : new Error(String(err)));
        }
        clientLogger.error('UserListContainer', 'データ取得失敗', {
          page,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    getDataListFunc();
    return () => {
      ignore = true;
    };
  }, [page]);

  const handleSort = (key: keyof TestSummaryResultListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  };

  const columns: Column<TestSummaryResultListRow>[] = [
    { key: 'firstLayer', header: '第1層', },
    { key: 'secondLayer', header: '第2層', },
    { key: 'totalCount', header: '総項目数', },
    { key: 'targetCount', header: '対象項目数', },
    { key: 'completedCount', header: '実施済数', },
    { key: 'notStartedCount', header: '未着手数', },
    { key: 'inProgressCount', header: '実施中数', },
    { key: 'okCount', header: 'OK数', },
    { key: 'ngCount', header: 'NG数', },
    { key: 'excludedCount', header: '対象外数', },
    { key: 'okRate', header: 'OK率', },
    { key: 'progressRate', header: '進捗率', },
  ];

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
    <>
      {loading ? (
        Loading()
      ) : (
        <>
          <TestSummaryResultList
            items={sortedItems}
            columns={columns}
            sortConfig={sortConfig}
            page={page}
            pageCount={pageCount}
            onSort={handleSort}
            onPageChange={setPage}
          />
          <TestSummaryResultGraph />
        </>
      )}
      <div className="flex justify-center space-x-4 mt-4">
        <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
      </div>
    </>
  );
}