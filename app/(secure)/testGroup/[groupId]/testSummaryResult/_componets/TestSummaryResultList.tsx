'use client';

import { Column, DataGrid } from '@/components/datagrid/DataGrid';
import Loading from '@/components/ui/loading';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import React, { useEffect, useState } from 'react';
import { TestSummaryResultListRow } from "./types/test-summary-result-list-row";

type TestSummaryResultListProps = {
  groupId: number;
  columns: Column<TestSummaryResultListRow>[];
  sortConfig: { key: keyof TestSummaryResultListRow; direction: "desc" | "asc"; } | null;
  onSort: (key: keyof TestSummaryResultListRow) => void;
  renderActions?: (item: TestSummaryResultListRow) => React.ReactNode;
};

export function TestSummaryResultList({
  groupId,
  columns,
  sortConfig,
  onSort,
  renderActions,
}: TestSummaryResultListProps) {
  const [items, setItems] = useState<TestSummaryResultListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        clientLogger.info('テスト集計結果表示画面', 'データ取得開始', { groupId });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await apiGet<any>(`/api/test-groups/${groupId}/report-data`);

        if (!data.success || !data.data) {
          throw new Error(data.error || 'データの取得に失敗しました');
        }

        const allData = data.data as unknown[];

        const mappedData: TestSummaryResultListRow[] = allData.map((item: unknown) => {
          const row = item as Record<string, number | string>;
          return {
            firstLayer: row.first_layer as string,
            secondLayer: row.second_layer as string,
            totalCount: row.total_items as number,
            targetCount: (row.total_items as number) - (row.excluded_items as number),
            completedCount: row.completed_items as number,
            notStartedCount: row.not_started_items as number,
            inProgressCount: row.in_progress_items as number,
            okCount: row.ok_items as number,
            ngCount: row.ng_items as number,
            excludedCount: row.excluded_items as number,
            okRate: parseFloat(((row.ok_rate as number) * 100).toFixed(1)),
            progressRate: parseFloat(((row.progress_rate as number) * 100).toFixed(1)),
          };
        });

        setItems(mappedData);

        clientLogger.info('テスト集計結果表示画面', 'データ取得成功', { groupId, count: mappedData.length });
      } catch (err) {
        setItems([]);
        clientLogger.error('テスト集計結果表示画面', 'データ取得失敗', { groupId, error: err instanceof Error ? err.message : String(err) });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <Loading
        isLoading={true}
        message={"データ読み込み中..."}
        size="md"
      />
    )
  }

  const sortedItems = [...items];
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
      {
        sortedItems.length > 0 ? (
          <DataGrid
            items={sortedItems}
            columns={columns}
            sortConfig={sortConfig}
            onSort={onSort}
            renderActions={renderActions}
            isAccordion={true}
          />
        ) : (
          <div className="text-gray-500 text-center py-8">データがありません</div>
        )
      }
    </div>
  );
}