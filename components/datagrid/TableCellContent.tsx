import React from 'react';
import Tag from '@/components/ui/tag';
import { Column } from './DataGrid';
import Link from 'next/link';

type TableCellContentProps<T> = {
  column: Column<T>;
  item: T;
};
type ItemType = {
  [key: string]: unknown;
};

const renderFileLink = (file: string | null, key: number) => (
  file ? (
    <Link href={file} key={key} download style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer', display: 'block' }}>
      {file.split('/').pop()}
    </Link>
  ) : null
);

const renderContent = (value: unknown, isImg?: boolean) => {
  if (Array.isArray(value)) {
    return (
      <>
        {value.map((item, index) => (
          isImg ? renderFileLink(item as string, index) : <span key={index}>{item as string}</span>
        ))}
      </>
    );
  }

  return isImg ? renderFileLink(value as string, 0) : <span>{value as string}</span>;
};

export function TableCellContent<T extends ItemType>({ column, item }: TableCellContentProps<T>) {
  if (column.render) {
    return <>{column.render(item[column.key] as number, item)}</>;
  }

  if (column.isLink) {
    const link = column.isExlink
      ? `${column.linkPrefix || ''}${String(item[column.key])}`
      : `${window.location.href}/${String(item[column.key])}${column.linkPrefix || ''}`;
    return (
      <Link href={link} style={{ color: 'blue', textDecoration: 'underline' }} target={column.isExlink ? '_blank' : '_self'} rel="noopener noreferrer">
        {String(item[column.key])}
      </Link>
    );
  }

  if (column.key === 'tag') {
    return <Tag label={String(item[column.key])} />;
  }

  return <>{renderContent(item[column.key], column.isImg)}</>;
}