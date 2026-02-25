'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUploadField } from '@/components/ui/FileUploadField';
import ButtonGroup from '@/components/ui/buttonGroup';
import { FileInfo } from '@/utils/fileUtils';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import clientLogger from '@/utils/client-logger';
import { apiPost } from '@/utils/apiClient';
import Loading from '@/components/ui/loading';

export function UserImportExecuteContainer() {
  const router = useRouter();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errors, setErrors] = useState('');

  const handleFileChange = (e: { target: { name: string; value: FileInfo[] } }) => {
    setFiles(e.target.value);
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setErrors('ファイルを選択してください');
      return;
    }
    setIsLoading(true);
    try {
      clientLogger.info('ユーザインポート実施画面', 'インポート処理開始');

      // Step1: プリサインドURLを取得
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadUrlResult = await apiPost<any>('/api/batch/upload-url', {
        fileName: files[0].name,
        importType: 'user',
      });
      if (!uploadUrlResult.success) {
        setModalMessage('アップロードURLの取得に失敗しました');
        setIsModalOpen(true);
        return;
      }
      const { uploadUrl, key } = uploadUrlResult.data;

      // Step2: S3にファイルをアップロード
      const file = files[0];
      const byteCharacters = atob(file.base64!);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: 'text/csv' });
      const s3UploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'text/csv' },
      });
      if (!s3UploadResponse.ok) {
        setModalMessage('ファイルのアップロードに失敗しました');
        setIsModalOpen(true);
        return;
      }

      // Step3: バッチジョブを起動
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPost<any>('/api/batch/user-import', {
        s3Key: key,
      });
      if (result.success) {
        router.push('/importResult');
      } else {
        setModalMessage('インポートに失敗しました');
        setIsModalOpen(true);
      }
    } catch {
      setModalMessage('インポートに失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    history.back();
  };

  const buttons = [
    {
      label: isLoading ? 'インポート中...' : 'インポート',
      onClick: () => {
        clientLogger.info('ユーザインポート実施画面', 'インポートボタン押下');
        handleSubmit();
      },
      disabled: isLoading,
    },
    {
      label: '戻る',
      onClick: () => {
        clientLogger.info('ユーザインポート実施画面', '戻るボタン押下');
        handleCancel();
      },
      isCancel: true,
    },
  ];

  return (
    <>
      <div className="pb-2 w-4/5 grid gap-4 grid-cols-1">
        <FileUploadField
          label="ユーザファイル（csv形式）"
          name="userFile"
          value={files}
          onChange={handleFileChange}
          isCopyable={false}
          isMultiple={false}
          error={errors}
        />
      </div>
      <div className="mt-4 w-12/13">
        <ButtonGroup buttons={buttons} />
      </div>
      <Modal open={isLoading} onClose={() => setIsLoading(false)} isUnclosable={true}>
        <div className="flex justify-center">
          <Loading
            isLoading={true}
            message="インポート中..."
            size="md"
          />
        </div>
      </Modal>
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </>
  );
}
