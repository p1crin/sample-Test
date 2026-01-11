import React, { useState } from 'react';
import Tag from '@/components/ui/tag';
import { Column } from './DataGrid';
import Link from 'next/link';
import { Modal } from '../ui/modal';

type TableCellContentProps<T> = {
  column: Column<T>;
  item: T;
};
type ItemType = {
  [key: string]: unknown;
};

const RenderFileLink = ({ file, index }: { file: string | null, index: number }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  if (!file) return null;

  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file);

  const handleClick = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if (isImage) {
      setModalImage(file);
      setModalOpen(true);
    } else {
      window.open(file, '_blank');
    }
  };

  return (
    <>
      <a
        href={file}
        key={index}
        onClick={handleClick}
        style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer', display: 'block' }}
      >
        {file.split('/').pop()}
      </a>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} showCloseButton={true}>
        {modalImage && <img src={modalImage} alt="modal image" width={800} height={600} />}
      </Modal>
    </>
  );
};

const renderContent = (value: unknown, isImg?: boolean) => {
  if (Array.isArray(value)) {
    return (
      <>
        {value.map((item, index) => (
          isImg ? <RenderFileLink file={item as string} index={index} key={index} /> : <span key={index}>{item as string}</span>
        ))}
      </>
    );
  }

  return isImg ? <RenderFileLink file={value as string} index={0} key={0} /> : <span>{value as string}</span>;
};

// 正規表現に従って部分的にリンクをレンダリングする関数
const renderPartialLinks = (text: string, pattern: RegExp, linkPrefix: string, isExlink: boolean) => {
  // パターンで分割し、マッチを抽出
  const parts: (string | RegExpMatchArray)[] = [];
  let lastIndex = 0;
  let match;

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
        const matchedText = part[0];
        // マッチから数字を抽出（例："#1000"→"1000"）
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

// TableCellContentコンポーネント
export function TableCellContent<T extends ItemType>({ column, item }: TableCellContentProps<T>) {
  if (column.render) {
    return <>{column.render(item[column.key] as number, item)}</>;
  }

  if (column.isLink) {
    const itemValue = String(item[column.key]);

    // 部分リンクパターンを処理
    if (column.linkPattern) {
      return renderPartialLinks(itemValue, column.linkPattern, column.linkPrefix || '', column.isExlink || false);
    }

    const link = column.isExlink
      ? `${column.linkPrefix || ''}${itemValue}`
      : `${window.location.href}/${itemValue}${column.linkPrefix || ''}`;
    return (
      <Link href={link} style={{ color: 'blue', textDecoration: 'underline' }} target={column.isExlink ? '_blank' : '_self'} rel="noopener noreferrer">
        {itemValue}
      </Link>
    );
  }

  if (column.key === 'tags') {
    return <Tag label={String(item[column.key])} />;
  }

  return <>{renderContent(item[column.key], column.isImg)}</>;
}