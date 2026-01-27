'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUploadField } from '@/components/ui/FileUploadField';
import ButtonGroup from '@/components/ui/buttonGroup';
import { FileInfo } from '@/utils/fileUtils';

export default function TestImportPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [testGroupId, setTestGroupId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: { target: { name: string; value: FileInfo[] } }) => {
    setFiles(e.target.value);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      alert('ファイルを選択してください');
      return;
    }
    if (!testGroupId) {
      alert('テストグループIDを入力してください');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/batch/test-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Key: files[0].key,
          testGroupId,
        }),
      });

      if (response.ok) {
        router.push('/importResult');
      } else {
        const data = await response.json();
        alert(data.error || 'インポートに失敗しました');
      }
    } catch {
      alert('インポートに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    history.back();
  };

  const buttons = [
    {
      label: isLoading ? '処理中...' : 'インポート',
      onClick: handleSubmit,
      disabled: isLoading,
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストインポート</h1>
      <div className="flex mt-4 pb-3 flex-col justify-start">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            テストグループID
          </label>
          <input
            type="text"
            value={testGroupId}
            onChange={(e) => setTestGroupId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="テストグループIDを入力"
          />
        </div>
        <FileUploadField
          label="テストファイル（zip形式）"
          name="testFile"
          value={files}
          onChange={handleFileChange}
          isCopyable={false}
        />
        <div className="mt-4">
          <ButtonGroup buttons={buttons} />
        </div>
      </div>
    </>
  );
}
