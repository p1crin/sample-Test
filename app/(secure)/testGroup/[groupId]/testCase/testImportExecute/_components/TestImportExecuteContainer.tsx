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

// マルチパートアップロードのチャンクサイズ（50MB）
const MULTIPART_CHUNK_SIZE = 50 * 1024 * 1024;

export function TestImportExecuteContainer({ groupId }: { groupId: string }) {
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
      clientLogger.info('テストインポート実施画面', 'インポート処理開始');

      const file = files[0];
      const rawFile = file.rawFile;
      if (!rawFile) {
        setModalMessage('ファイルの読み込みに失敗しました');
        setIsModalOpen(true);
        return;
      }

      const fileSize = rawFile.size;
      let s3Key: string;

      if (fileSize <= MULTIPART_CHUNK_SIZE) {
        // 小さいファイル: シングルPUTアップロード
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uploadUrlResult = await apiPost<any>('/api/batch/upload-url', {
          fileName: file.name,
          importType: 'test',
        });
        if (!uploadUrlResult.success) {
          setModalMessage('アップロードURLの取得に失敗しました');
          setIsModalOpen(true);
          return;
        }
        const { uploadUrl, key } = uploadUrlResult.data;
        s3Key = key;

        const s3UploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: rawFile,
          headers: { 'Content-Type': 'application/zip' },
        });
        if (!s3UploadResponse.ok) {
          setModalMessage('ファイルのアップロードに失敗しました');
          setIsModalOpen(true);
          return;
        }
      } else {
        // 大きいファイル: マルチパートアップロード（S3の5GB制限を回避）
        const partCount = Math.ceil(fileSize / MULTIPART_CHUNK_SIZE);

        // Step1: マルチパートアップロードを開始して各パートのURLを取得
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const initiateResult = await apiPost<any>('/api/batch/multipart-upload/initiate', {
          fileName: file.name,
          importType: 'test',
          partCount,
        });
        if (!initiateResult.success) {
          setModalMessage('アップロードURLの取得に失敗しました');
          setIsModalOpen(true);
          return;
        }
        const { uploadId, key, partUrls } = initiateResult.data;
        s3Key = key;

        // Step2: 各パートを順番にアップロード
        const parts: { partNumber: number; etag: string }[] = [];
        for (let i = 0; i < partCount; i++) {
          const start = i * MULTIPART_CHUNK_SIZE;
          const end = Math.min(start + MULTIPART_CHUNK_SIZE, fileSize);
          const chunk = rawFile.slice(start, end);

          const partResponse = await fetch(partUrls[i], {
            method: 'PUT',
            body: chunk,
          });
          if (!partResponse.ok) {
            setModalMessage('ファイルのアップロードに失敗しました');
            setIsModalOpen(true);
            return;
          }

          const etag = partResponse.headers.get('ETag');
          if (!etag) {
            setModalMessage('アップロードの検証に失敗しました');
            setIsModalOpen(true);
            return;
          }
          parts.push({ partNumber: i + 1, etag });
        }

        // Step3: マルチパートアップロードを完了
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const completeResult = await apiPost<any>('/api/batch/multipart-upload/complete', {
          key,
          uploadId,
          parts,
        });
        if (!completeResult.success) {
          setModalMessage('ファイルのアップロードに失敗しました');
          setIsModalOpen(true);
          return;
        }
      }

      // バッチジョブを起動
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPost<any>('/api/batch/test-import', {
        s3Key,
        testGroupId: groupId,
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
        clientLogger.info('テストインポート実施画面', 'インポートボタン押下');
        handleSubmit();
      },
      disabled: isLoading,
    },
    {
      label: '戻る',
      onClick: () => {
        clientLogger.info('テストインポート実施画面', '戻るボタン押下');
        handleCancel();
      },
      isCancel: true,
    },
  ];

  return (
    <>
      <div className="pb-2 w-4/5 grid gap-4 grid-cols-1">
        <FileUploadField
          label="テストファイル（zip形式）"
          name="testFile"
          value={files}
          onChange={(e) => handleFileChange({ target: { name: 'testFile', value: e.target.value } })}
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
