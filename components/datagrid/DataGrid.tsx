import React, { useState, useMemo, useCallback } from 'react';
import { Table } from '@/components/ui/table';
import { Pagination } from '@/components/datagrid/Pagination';
import { Modal } from '@/components/ui/modal';
import { DataGridAccordionBody } from './DataGridAccordionBody';
import { DataGridBody } from './DataGridBody';
import { DataGridHeader } from './DataGridHeader';

export type Column<T> = {
  key: keyof T;
  header: React.ReactNode;
  render?: (value: number, row: T) => React.ReactNode;
  sortable?: boolean;
  isLink?: boolean;
  isExlink?: boolean;
  linkPrefix?: string;
  linkPattern?: RegExp; // Pattern for partial link extraction (e.g., /#\d+/g for "#1000")
  width?: string | number;
  isImg?: boolean;
};

export type SortConfig<T> = {
  key: keyof T;
  direction: 'asc' | 'desc';
} | null;

export type DataGridProps<T> = {
  items: T[];
  columns: Column<T>[];
  sortConfig?: SortConfig<T>;
  page?: number;
  pageCount?: number;
  onSort?: (key: keyof T) => void;
  onPageChange?: (page: number) => void;
  renderActions?: (item: T) => React.ReactNode;
  isAccordion?: boolean;
};

type ItemType = {
  [key: string]: unknown;
};

export function DataGrid<T extends ItemType>({
  items,
  columns,
  sortConfig,
  page = 0,
  pageCount = 0,
  onSort = () => { },
  onPageChange = () => { },
  renderActions,
  isAccordion = false,
}: DataGridProps<T>) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const toggleItem = useCallback((itemKey: string) => {
    setExpandedItems(prevState =>
      prevState.includes(itemKey)
        ? prevState.filter(item => item !== itemKey)
        : [...prevState, itemKey]
    );
  }, []);

  const handleImageClick = useCallback((imageSrc: string) => {
    setModalImage(imageSrc);
    setModalOpen(true);
  }, []);

  const groupedItems = useMemo(() => {
    if (!items || !Array.isArray(items)) {
      return {};
    }
    return items.reduce((acc, item) => {
      const key = String(item[columns[0].key]);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }, [items, columns]);

  return (
    <div>
      <div className="overflow-x-auto bg-white rounded shadow">
        <div className="min-w-full">
          <Table className="min-w-full">
            <DataGridHeader columns={columns} sortConfig={sortConfig} onSort={onSort} renderActions={renderActions} />
            {isAccordion ? (
              <DataGridAccordionBody
                groupedItems={groupedItems}
                columns={columns}
                expandedItems={expandedItems}
                toggleItem={toggleItem}
                renderActions={renderActions}
              />
            ) : (
              <DataGridBody
                items={items}
                columns={columns}
                renderActions={renderActions}
                handleImageClick={handleImageClick}
              />
            )}
          </Table>
        </div>
      </div>
      {items.length > 0 && pageCount > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination page={page} pageCount={pageCount} onPageChange={onPageChange} />
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} showCloseButton={true}>
        {modalImage && <img src={modalImage} alt="modal image" width={800} height={600} />}
      </Modal>
    </div>
  );
}