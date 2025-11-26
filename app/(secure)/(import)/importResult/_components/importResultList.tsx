import { DataGrid, Column } from '@/components/datagrid/DataGrid';
import { ImportResultListRow } from './types/import-result-list-row';

type ImportResultListProps = {
  items: ImportResultListRow[];
  columns: Column<ImportResultListRow>[];
  sortConfig: { key: keyof ImportResultListRow; direction: 'asc' | 'desc' } | null;
  page: number;
  pageCount: number;
  onSort: (key: keyof ImportResultListRow) => void;
  onPageChange: (page: number) => void;
  renderActions?: (item: ImportResultListRow) => React.ReactNode;
};

export function ImportResultList({
  items,
  columns,
  sortConfig,
  page,
  pageCount,
  onSort,
  onPageChange,
  renderActions,
}: ImportResultListProps) {
  return (
    <section>
      <DataGrid
        items={items}
        columns={columns}
        sortConfig={sortConfig}
        onSort={onSort}
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        renderActions={renderActions}
      />
    </section>
  );
}