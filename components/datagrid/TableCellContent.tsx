import Tag from '@/components/ui/tag';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Modal } from '../ui/modal';
import { Column } from './DataGrid';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';

type TableCellContentProps<T> = {
  column: Column<T>;
  item: T;
};
type ItemType = {
  [key: string]: unknown;
};

const RenderFileLink = ({ file, index }: { file: string | FileInfo | null, index: number }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('');

  if (!file) return null;

  // FileInfo型の場合はpathプロパティを使用
  const filePath = typeof file === 'string' ? file : (file.path || file.name);
  const fileName = typeof file === 'string' ? file.split('/').pop() : file.name;
  const fileType = typeof file === 'string' ? null : file.type;

  // S3パスの場合に署名付きURLを取得
  useEffect(() => {
    const fetchFileUrl = async () => {
      if (!filePath) return;

      // ローカルパス（/で始まる）の場合はそのまま使用
      if (filePath.startsWith('/')) {
        setFileUrl(filePath);
      } else {
        // S3パスの場合は署名付きURLを取得
        try {
          const response = await fetch('/api/files/url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filePath: filePath }),
          });

          if (response.ok) {
            const data = await response.json();
            setFileUrl(data.data.url);
          } else {
            // 失敗した場合は元のパスを使用
            setFileUrl(filePath);
          }
        } catch (error) {
          clientLogger.error('TableCellContent', 'ファイルURLの取得失敗', { error });
          // エラーの場合は元のパスを使用
          setFileUrl(filePath);
        }
      }
    };

    fetchFileUrl();
  }, [filePath]);

  // 画像判定: fileTypeがある場合はそれを使用、なければ拡張子で判定
  const isImage = fileType
    ? fileType.startsWith('image/')
    : /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filePath);

  const handleClick = (e: { preventDefault: () => void; }) => {
    e.preventDefault();
    if (isImage) {
      setModalImage(fileUrl || filePath);
      setModalOpen(true);
    } else {
      window.open(fileUrl || filePath, '_blank');
    }
  };

  // URLが取得できていない場合は読み込み中を表示
  if (!fileUrl) {
    return <span style={{ color: 'gray' }}>読み込み中...</span>;
  }

  return (
    <>
      <a
        href={fileUrl}
        key={index}
        onClick={handleClick}
        style={{ color: 'blue', textDecoration: 'underline', cursor: 'pointer', display: 'block' }}
      >
        {fileName}
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
          isImg ? <RenderFileLink file={item as string | FileInfo} index={index} key={index} /> : <span key={index}>{item as string}</span>
        ))}
      </>
    );
  }

  return isImg ? <RenderFileLink file={value as string | FileInfo} index={0} key={0} /> : <span>{value as string}</span>;
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