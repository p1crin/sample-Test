import { TestGroupListRow } from '../../_components/types/testGroup-list-row';
import { DataGrid, Column } from '@/components/datagrid/DataGrid';

type TestGroupListProps = {
  items: TestGroupListRow[];
  columns: Column<TestGroupListRow>[];
  sortConfig: { key: keyof TestGroupListRow; direction: 'asc' | 'desc' } | null;
  page: number;
  pageCount: number;
  onSort: (key: keyof TestGroupListRow) => void;
  onPageChange: (page: number) => void;
  renderActions?: (item: TestGroupListRow) => React.ReactNode;
};

export function TestGroupList({
  items,
  columns,
  sortConfig,
  page,
  pageCount,
  onSort,
  onPageChange,
  renderActions,
}: TestGroupListProps) {
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
