import React from 'react';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { TableCellContent } from './TableCellContent';
import { Column } from './DataGrid';
import { JUDGMENT_OPTIONS } from '@/constants/constants';

type ItemType = {
  [key: string]: unknown;
};

type DataGridBodyProps<T extends ItemType> = {
  items: T[];
  columns: Column<T>[];
  renderActions?: (item: T) => React.ReactNode;
  handleImageClick: (imageSrc: string) => void;
};

export function DataGridBody<T extends ItemType>({ items, columns, renderActions, handleImageClick }: DataGridBodyProps<T>) {
  return (
    <TableBody>
      {items.map((item, index) => {
        const isExcluded = item.judgment === JUDGMENT_OPTIONS.EXCLUDED;
        return (
          <TableRow key={index} className={`border-b ${isExcluded ? 'bg-gray-200 opacity-60 pointer-events-none' : ''}`}>
            {columns.map((column) => (
              <TableCell key={String(column.key)} className="px-4 py-2" style={{ width: column.width }}>
                <TableCellContent column={column} item={item} />
              </TableCell>
            ))}
            {renderActions && (
              <TableCell className="px-4 py-2">{renderActions(item)}</TableCell>
            )}
          </TableRow>
        );
      })}
    </TableBody>
  );
}