import { FileInfo, getUniqueFileNames, processClipboardItems, processFileList } from '@/utils/fileUtils';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './button';

/**
 * ファイルアップロードフィールドのプロパティ
 */
export interface FileUploadFieldProps {
  /** ラベルのテキスト */
  label: string;
  /** 入力フィールドの名前 */
  name: string;
  /** 入力フィールドの値 (カンマ区切りのファイル名またはFileInfo配列) */
  value: string | FileInfo[];
  /** ファイルが変更されたときに呼び出される関数 */
  onChange: (e: { target: { name: string; value: FileInfo[] } }) => void;
  /** プレースホルダーのテキスト (オプション) */
  placeholder?: string;
  /** コピペ可能/不可能 (オプション) */
  isCopyable?: boolean;
  /** エラーメッセージ (オプション) */
  error?: string;
}

const LABLE_STYLE = "flex items-center text-sm";
const INPUT_FILE_FORM_STYLE = "flex w-full h-10 rounded border border-[#cccccc] bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-2 focus-visible:border-[#2684ff] resize-none";

/**
 * ファイルアップロードフィールドコンポーネント
 */
export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  isCopyable = true,
  error
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初期値の設定: 文字列の場合はファイル名の配列として扱う
  useEffect(() => {
    if (typeof value === 'string' && value) {
      const fileNames = value.split(', ');
      setFiles(fileNames.map(name => ({ name, id: Math.random().toString(36).substr(2, 9) })));
    } else if (Array.isArray(value)) {
      setFiles(value);
    }
  }, [value]);

  /**
   * ペーストイベントのハンドラー
   */
  const handlePaste = async (pasteEvent: React.ClipboardEvent) => {
    const items = pasteEvent.clipboardData.items;
    if (items.length === 0 || items[0].kind !== 'file') return;

    const newFiles = await processClipboardItems(items);
    const uniqueFiles = getUniqueFileNames([...files, ...newFiles]);

    setFiles(uniqueFiles);
    onChange({ target: { name, value: uniqueFiles } });
  };

  /**
   * ファイル選択のハンドラー
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = await processFileList(fileList);
    const uniqueFiles = getUniqueFileNames([...files, ...newFiles]);

    setFiles(uniqueFiles);
    onChange({ target: { name, value: uniqueFiles } });

    // inputをリセットして同じファイルを再度選択できるようにする
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * ファイル削除のハンドラー
   */
  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onChange({ target: { name, value: newFiles } });
  };

  const defaultPlaceholder = isCopyable
    ? 'ファイルを選択またはキャプチャーを貼り付けてください。'
    : 'ファイルを選択してください。';

  return (
    <div>
      {/* ファイル選択エリア */}
      <div className='flex flex-cols space-x-4 items-center justify-end'>
        <label className={LABLE_STYLE}>{label}</label>
        <div className='w-67/100 flex flex-cols space-x-3'>
          <textarea
            id='content'
            name='content'
            value=''
            placeholder={placeholder || defaultPlaceholder}
            onPaste={isCopyable ? handlePaste : undefined}
            className={INPUT_FILE_FORM_STYLE}
            readOnly
          />
          <div className='flex justify-center'>
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="whitespace-nowrap"
            >
              ファイルを選択
            </Button>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* ファイルプレビューエリア */}
      <div className='flex justify-end'>
        <div className="flex flex-wrap w-67/100">
          {files.map((file, index) => (
            <div
              key={file.id}
              className="relative m-2 flex items-center justify-between border border-gray-300 p-2 rounded-sm"
              style={{ minHeight: '48px', maxHeight: '96px', width: '200px' }}
            >
              {file.path ? (
                <img
                  src={file.path}
                  alt={file.name}
                  className="object-contain h-full"
                  style={{ maxWidth: '100px' }}
                />
              ) : file.base64 && file.type?.includes('image/') ? (
                <img
                  src={`data:${file.type};base64,${file.base64}`}
                  alt={file.name}
                  className="object-contain h-full"
                  style={{ maxWidth: '100px' }}
                />
              ) : (
                <span className="text-sm truncate">{file.name}</span>
              )}

              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="right-2 top-2 h-6 w-6 rounded-lg border bg-white text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <p className="text-red-600 text-xs mt-1 ml-auto mr-0 w-67/100">{error}</p>
      )}
    </div>
  );
};

export default FileUploadField;