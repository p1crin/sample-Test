import React from 'react';
import { TestSummaryResultListRow } from "./types/test-summary-result-list-row";
import { Column, DataGrid } from '@/components/datagrid/DataGrid';

type TestSummaryResultListProps = {
  items: TestSummaryResultListRow[];
  columns: Column<TestSummaryResultListRow>[];
  sortConfig: { key: keyof TestSummaryResultListRow; direction: "desc" | "asc"; } | null;
  page: number;
  pageCount: number;
  onSort: (key: keyof TestSummaryResultListRow) => void;
  onPageChange: (page: number) => void;
  renderActions?: (item: TestSummaryResultListRow) => React.ReactNode;
};

export function TestSummaryResultList({
  items,
  columns,
  sortConfig,
  page,
  pageCount,
  onSort,
  onPageChange,
  renderActions,
}: TestSummaryResultListProps) {
  return (
    <DataGrid
      items={items}
      columns={columns}
      sortConfig={sortConfig}
      page={page}
      pageCount={pageCount}
      onSort={onSort}
      onPageChange={onPageChange}
      renderActions={renderActions}
      isAccordion={true}
    />
  );
}