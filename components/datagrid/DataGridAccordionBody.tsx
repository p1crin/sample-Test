import React from 'react';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { TableCellContent } from './TableCellContent';
import { Column } from './DataGrid';
import { calculateOKRate, calculateProgressRate, calculateSum } from './calculations';

type ItemType = {
  secondLayer?: string;
  okCount?: number;
  totalCount?: number;
  excludedCount?: number;
  ngCount?: number;
};

type DataGridAccordionBodyProps<T extends ItemType> = {
  groupedItems: Record<string, T[]>;
  columns: Column<T>[];
  expandedItems: string[];
  toggleItem: (itemKey: string) => void;
  renderActions?: (item: T) => React.ReactNode;
};

export function DataGridAccordionBody<T extends ItemType>({
  groupedItems,
  columns,
  expandedItems,
  toggleItem,
  renderActions,
}: DataGridAccordionBodyProps<T>) {
  return (
    <TableBody>
      {Object.keys(groupedItems).map((groupKey, index) => (
        <React.Fragment key={index}>
          <TableRow className={`border-b ${groupedItems[groupKey].length > 1 ? '' : 'cursor-default'}`}>
            <TableCell
              className="px-4 py-2 cursor-pointer"
              onClick={() => groupedItems[groupKey].length > 1 && toggleItem(groupKey)}
            >
              {groupedItems[groupKey].length > 1 ? (expandedItems.includes(groupKey) ? '-' : '+') : ''} {groupKey}
            </TableCell>
            {columns.slice(1).map((column) => (
              <TableCell key={String(column.key)} className="px-4 py-2 " style={{ width: column.width }}>
                {
                  column.key === 'secondLayer'
                    ? groupedItems[groupKey].length > 1 ?
                      '' : groupedItems[groupKey][0].secondLayer
                    : column.key === 'okRate'
                      ? calculateOKRate(groupedItems[groupKey])
                      : column.key === 'progressRate'
                        ? calculateProgressRate(groupedItems[groupKey])
                        : String(calculateSum(groupedItems[groupKey], column.key))}
              </TableCell>
            ))}
            {renderActions && <TableCell className="px-4 py-2 "></TableCell>}
          </TableRow>
          {expandedItems.includes(groupKey) && groupedItems[groupKey].map((item, itemIndex) => (
            <TableRow key={itemIndex} className="border-b">
              {columns.map((column, colIndex) => (
                <TableCell key={String(column.key)} className="px-4 py-2 " style={{ width: column.width }}>
                  {colIndex === 0 ? '' : <TableCellContent column={column} item={item} />}
                </TableCell>
              ))}
              {renderActions && (
                <TableCell className="px-4 py-2 ">{renderActions(item)}</TableCell>
              )}
            </TableRow>
          ))}
        </React.Fragment>
      ))}
    </TableBody>
  );
}