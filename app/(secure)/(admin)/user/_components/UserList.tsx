import { UserListTableRow } from './types/user-list-row';
import { DataGrid, Column } from '@/components/datagrid/DataGrid';

type UserListProps = {
  items: UserListTableRow[];
  columns: Column<UserListTableRow>[];
  sortConfig: { key: keyof UserListTableRow; direction: 'asc' | 'desc' } | null;
  page: number;
  pageCount: number;
  onSort: (key: keyof UserListTableRow) => void;
  onPageChange: (page: number) => void;
  renderActions?: (item: UserListTableRow) => React.ReactNode;
};

export function UserList({
  items,
  columns,
  sortConfig,
  page,
  pageCount,
  onSort,
  onPageChange,
  renderActions,
}: UserListProps) {
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
