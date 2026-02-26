import { apiPost } from '@/utils/apiClient';
import clientLogger from "@/utils/client-logger";
import { FileInfo, getUniqueFileNames, isImage, processClipboardItems, processFileList } from '@/utils/fileUtils';
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
  onChange: (e: { target: { name: string; value: FileInfo[] } }, deletedFile?: FileInfo) => void;
  /** ファイルアップロード処理（オプション）- 設定された場合、ファイル選択時に即座にアップロード */
  onFileUpload?: (file: FileInfo) => Promise<FileInfo>;
  /** プレースホルダーのテキスト (オプション) */
  placeholder?: string;
  /** コピペ可能/不可能 (オプション) */
  isCopyable?: boolean;
  /** エラーメッセージ (オプション) */
  error?: string;
  /** 複数指定可能（オプション) */
  isMultiple?: boolean;
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
  onFileUpload,
  placeholder,
  isCopyable = true,
  error,
  isMultiple = true
}) => {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
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

  // S3パスの場合に署名付きURLを取得
  useEffect(() => {
    const fetchFileUrls = async () => {
      const newFileUrls: Record<string, string> = {};

      for (const file of files) {
        // file.pathが存在し、まだURLを取得していない場合
        if (file.path && !fileUrls[file.path]) {
          // ローカルパス（/で始まる）の場合はそのまま使用
          if (file.path.startsWith('/')) {
            newFileUrls[file.path] = file.path;
          } else {
            // S3パスの場合は署名付きURLを取得
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const data = await apiPost<any>('/api/files/url', { filePath: file.path });
              newFileUrls[file.path] = data.data.url;
            } catch (err) {
              clientLogger.error('FileUploadField', 'ファイルの取得に失敗しました。', { ererror: err instanceof Error ? err.message : String(err) })
            }
          }
        }
      }

      if (Object.keys(newFileUrls).length > 0) {
        setFileUrls(prev => ({ ...prev, ...newFileUrls }));
      }
    };

    fetchFileUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  /**
   * ペーストイベントのハンドラー
   */
  const handlePaste = async (pasteEvent: React.ClipboardEvent) => {
    const items = pasteEvent.clipboardData.items;
    if (items.length === 0 || items[0].kind !== 'file') return;

    let newFiles = await processClipboardItems(items);

    // isMultipleがfalseの場合、最初のファイルのみを処理する
    if (!isMultiple && newFiles.length > 0) {
      newFiles = [newFiles[0]];
    }

    // アップロード処理が設定されている場合は各ファイルをアップロード
    // 注: 順次アップロードすることで、file_noの競合（race condition）を防ぐ
    let processedFiles = newFiles;
    if (onFileUpload) {
      setUploading(true);
      try {
        processedFiles = [];
        for (const file of newFiles) {
          const uploadedFile = await onFileUpload(file);
          processedFiles.push(uploadedFile);
        }
      } catch (err) {
        setUploading(false);
        clientLogger.error('FileUploadField', 'ファイルのアップロードに失敗しました', { error: err instanceof Error ? err.message : String(err) });
        return;
      }
      setUploading(false);
    }

    const finalFiles = isMultiple ? [...files, ...processedFiles] : processedFiles;
    const uniqueFiles = getUniqueFileNames(finalFiles);

    setFiles(uniqueFiles);
    onChange({ target: { name, value: uniqueFiles } });
  };

  /**
   * ファイル選択のハンドラー
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    let newFiles = await processFileList(fileList);

    // isMultipleがfalseの場合、最初のファイルのみを処理する
    if (!isMultiple && newFiles.length > 0) {
      newFiles = [newFiles[0]];
    }

    // アップロード処理が設定されている場合は各ファイルをアップロード
    // 注: 順次アップロードすることで、file_noの競合（race condition）を防ぐ
    let processedFiles = newFiles;
    if (onFileUpload) {
      setUploading(true);
      try {
        processedFiles = [];
        for (const file of newFiles) {
          const uploadedFile = await onFileUpload(file);
          processedFiles.push(uploadedFile);
        }
      } catch (err) {
        setUploading(false);
        clientLogger.error('FileUploadField', 'ファイルのアップロードに失敗しました', { error: err instanceof Error ? err.message : String(err) });
        // inputをリセットして同じファイルを再度選択できるようにする
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      setUploading(false);
    }

    const finalFiles = isMultiple ? [...files, ...processedFiles] : processedFiles;
    const uniqueFiles = getUniqueFileNames(finalFiles);

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
    const deletedFile = files[index]; // 削除対象のファイル情報を保持
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onChange({ target: { name, value: newFiles } }, deletedFile);
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
              disabled={uploading}
            >
              {uploading ? 'アップロード中...' : 'ファイルを選択'}
            </Button>
            <input
              type="file"
              multiple={isMultiple}
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={uploading}
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
              {file.path && fileUrls[file.path] && isImage(file.path) ? (
                <img
                  src={fileUrls[file.path]}
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