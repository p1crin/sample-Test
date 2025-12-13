'use client';

import React, { useState, useEffect } from 'react';
import { TestSummaryResultListRow } from "./types/test-summary-result-list-row";
import { Column, DataGrid } from '@/components/datagrid/DataGrid';
import clientLogger from '@/utils/client-logger';
import Loading from '@/app/loading';

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
  const [error, setError] = useState<string | null>(null);

  // Fetch aggregated data
  useEffect(() => {
    let ignore = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        clientLogger.info('TestSummaryResultList', 'データ取得開始', { groupId });

        const response = await fetch(`/api/test-groups/${groupId}/report-data`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.data) {
          throw new Error(data.error || 'データの取得に失敗しました');
        }

        if (!ignore) {
          const allData = data.data as unknown[];

          // Map data to TestSummaryResultListRow format
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

          clientLogger.info('TestSummaryResultList', 'データ取得成功', {
            groupId,
            count: mappedData.length,
          });
        }
      } catch (err) {
        if (!ignore) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setError(errorMessage);
          setItems([]);

          clientLogger.error('TestSummaryResultList', 'データ取得失敗', {
            groupId,
            error: errorMessage,
          });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      ignore = true;
    };
  }, [groupId]);

  if (error) {
    throw new Error(error);
  }

  if (loading) {
    return Loading();
  }

  // Sort items (all items, no pagination)
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
    <DataGrid
      items={sortedItems}
      columns={columns}
      sortConfig={sortConfig}
      onSort={onSort}
      renderActions={renderActions}
      isAccordion={true}
    />
  );
}