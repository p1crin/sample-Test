'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUploadField } from '@/components/ui/FileUploadField';
import ButtonGroup from '@/components/ui/buttonGroup';
import { FileInfo } from '@/utils/fileUtils';

export default function UserImportPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileInfo[]>([]);

  const handleFileChange = (e: { target: { name: string; value: FileInfo[] } }) => {
    setFiles(e.target.value);
  };

  const handleSubmit = () => {
    if (files.length > 0) {
      console.log('ユーザインポート実行:', files);
      router.push('/importResult');
    } else {
      console.log('ファイルが選択されていません');
    }
  };

  const handleCancel = () => {
    history.back();
  };

  const buttons = [
    {
      label: 'インポート',
      onClick: handleSubmit,
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">ユーザインポート</h1>
      <div className="flex mt-4 pb-3 flex-col justify-start">
        <FileUploadField
          label="ユーザファイル（csv形式）"
          name="userFile"
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
