import React from 'react';
import { TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Column, SortConfig } from './DataGrid';

type DataGridHeaderProps<T> = {
  columns: Column<T>[];
  sortConfig?: SortConfig<T>;
  onSort: (key: keyof T) => void;
  renderActions?: (item: T) => React.ReactNode;
};

export function DataGridHeader<T>({ columns, sortConfig, onSort, renderActions }: DataGridHeaderProps<T>) {
  return (
    <TableHeader>
      <TableRow className="bg-gray-300">
        {columns.map((column) => (
          <TableHead
            key={String(column.key)}
            onClick={() => column.sortable && onSort(column.key)}
            className={
              column.sortable
                ? 'cursor-pointer select-none px-4 py-2 '
                : 'px-4 py-2 '
            }
            style={{ width: column.width }}
          >
            {column.header}{' '}
            {sortConfig?.key === column.key && (sortConfig.direction === 'asc' ? '▲' : '▼')}
          </TableHead>
        ))}
        {renderActions && <TableHead className="px-4 py-2 "></TableHead>}
      </TableRow>
    </TableHeader>
  );
}