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

const renderFileLink = (file: string | { name: string; id: string } | null, key: number) => {
  if (!file) return null;

  const isObject = typeof file === 'object';
  const displayName = isObject ? file.name : file.split('/').pop();
  const href = isObject ? `/api/evidence/${file.id}` : file;

  return (
    <Link href={href} key={key} download style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer', display: 'block' }}>
      {displayName}
    </Link>
  );
};

const renderContent = (value: unknown, isImg?: boolean) => {
  if (Array.isArray(value)) {
    return (
      <>
        {value.map((item, index) => (
          isImg ? renderFileLink(item as string | { name: string; id: string }, index) : <span key={index}>{String(item)}</span>
        ))}
      </>
    );
  }

  return isImg ? renderFileLink(value as string | { name: string; id: string }, 0) : <span>{String(value)}</span>;
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

  if (column.key === 'tags') {
    return <Tag label={String(item[column.key])} />;
  }

  return <>{renderContent(item[column.key], column.isImg)}</>;
}