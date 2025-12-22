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

const renderPartialLinks = (text: string, pattern: RegExp, linkPrefix: string, isExlink: boolean) => {
  // Split by the pattern and extract matches
  const parts: (string | RegExpMatchArray)[] = [];
  let lastIndex = 0;
  let match;

  // Create a new RegExp with global flag if not already set
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');

  while ((match = globalPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(match);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return (
    <>
      {parts.map((part, index) => {
        if (typeof part === 'string') {
          return <span key={index}>{part}</span>;
        }
        // part is a RegExpMatchArray (matched pattern)
        const matchedText = part[0];
        // Extract the number from the match (e.g., "1000" from "#1000")
        const numberMatch = matchedText.match(/\d+/);
        if (!numberMatch) return <span key={index}>{matchedText}</span>;

        const link = isExlink
          ? `${linkPrefix}${numberMatch[0]}`
          : `${window.location.href}/${numberMatch[0]}`;

        return (
          <Link
            key={index}
            href={link}
            style={{ color: 'blue', textDecoration: 'underline' }}
            target={isExlink ? '_blank' : '_self'}
            rel="noopener noreferrer"
          >
            {matchedText}
          </Link>
        );
      })}
    </>
  );
};

export function TableCellContent<T extends ItemType>({ column, item }: TableCellContentProps<T>) {
  if (column.render) {
    return <>{column.render(item[column.key] as number, item)}</>;
  }

  if (column.isLink) {
    const itemValue = String(item[column.key]);

    // Handle partial link pattern (e.g., #1000 in text)
    if (column.linkPattern) {
      return renderPartialLinks(itemValue, column.linkPattern, column.linkPrefix || '', column.isExlink || false);
    }

    // Handle full link
    const link = column.isExlink
      ? `${column.linkPrefix || ''}${itemValue}`
      : `${window.location.href}/${itemValue}${column.linkPrefix || ''}`;
    return (
      <Link href={link} style={{ color: 'blue', textDecoration: 'underline' }} target={column.isExlink ? '_blank' : '_self'} rel="noopener noreferrer">
        {itemValue}
      </Link>
    );
  }

  if (column.key === 'tag') {
    return <Tag label={String(item[column.key])} />;
  }

  return <>{renderContent(item[column.key], column.isImg)}</>;
}