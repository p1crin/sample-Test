'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import Loading from '@/components/ui/loading';
import { apiPost, apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';

type ImportResult = {
  id: number;
  file_name: string | null;
  import_status: number | null;
  executor_name: string | null;
  import_type: number | null;
  count: number | null;
  message: string | null;
  created_at: Date;
  updated_at: Date;
};

type JobStatus = {
  jobId: string;
  jobName: string;
  status: string;
  statusReason?: string;
  createdAt?: number;
  startedAt?: number;
  stoppedAt?: number;
};

const UserImportContainer: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isJobRunning, setIsJobRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // インポート結果履歴を取得
  useEffect(() => {
    const fetchImportResults = async () => {
      try {
        setIsLoadingResults(true);
        const result = await apiGet<{ data: ImportResult[]; totalCount: number }>(
          '/api/import-results?import_type=1&limit=20'
        );
        if (result.success && result.data) {
          setImportResults(result.data.data);
        }
      } catch (error) {
        clientLogger.error('ユーザインポート画面', 'インポート結果取得エラー', { error });
      } finally {
        setIsLoadingResults(false);
      }
    };

    if (session?.user) {
      fetchImportResults();
    }
  }, [session]);

  // ジョブステータスをポーリング
  useEffect(() => {
    if (!currentJobId || !isJobRunning) return;

    const interval = setInterval(async () => {
      try {
        const result = await apiGet<{ data: JobStatus }>(`/api/batch/status/${currentJobId}`);
        if (result.success && result.data) {
          setJobStatus(result.data);

          // 終了状態をチェック
          if (['SUCCEEDED', 'FAILED'].includes(result.data.status)) {
            setIsJobRunning(false);
            clearInterval(interval);

            // インポート結果を再取得
            const resultsResponse = await apiGet<{ data: ImportResult[]; totalCount: number }>(
              '/api/import-results?import_type=1&limit=20'
            );
            if (resultsResponse.success && resultsResponse.data) {
              setImportResults(resultsResponse.data.data);
            }

            // 完了メッセージを表示
            if (result.data.status === 'SUCCEEDED') {
              setModalMessage('ユーザインポートが正常に完了しました');
            } else {
              setModalMessage('ユーザインポートが失敗しました');
            }
            setIsModalOpen(true);
          }
        }
      } catch (error) {
        clientLogger.error('ユーザインポート画面', 'ジョブステータス取得エラー', { error });
      }
    }, 5000); // 5秒ごとにポーリング

    return () => clearInterval(interval);
  }, [currentJobId, isJobRunning]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setModalMessage('CSVファイルを選択してください');
        setIsModalOpen(true);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadAndImport = async () => {
    if (!selectedFile) {
      setModalMessage('CSVファイルを選択してください');
      setIsModalOpen(true);
      return;
    }

    try {
      setIsUploading(true);
      clientLogger.info('ユーザインポート画面', 'CSVアップロード開始', { fileName: selectedFile.name });

      // 1. プリサインドURLを取得
      const urlResult = await apiPost<{
        data: { uploadUrl: string; key: string; bucket: string };
      }>('/api/batch/upload-url', {
        fileName: selectedFile.name,
        importType: 'user',
      });

      if (!urlResult.success || !urlResult.data) {
        throw new Error('アップロードURL取得に失敗しました');
      }

      const { uploadUrl, key } = urlResult.data;

      // 2. S3にファイルをアップロード
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': 'text/csv',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('ファイルアップロードに失敗しました');
      }

      clientLogger.info('ユーザインポート画面', 'CSVアップロード完了', { key });

      // 3. バッチジョブを起動
      const jobResult = await apiPost<{ data: { jobId: string; jobName: string } }>(
        '/api/batch/user-import',
        {
          s3Key: key,
        }
      );

      if (!jobResult.success || !jobResult.data) {
        throw new Error('バッチジョブ起動に失敗しました');
      }

      clientLogger.info('ユーザインポート画面', 'バッチジョブ起動', {
        jobId: jobResult.data.jobId,
      });

      setCurrentJobId(jobResult.data.jobId);
      setIsJobRunning(true);
      setModalMessage('インポートジョブを起動しました。処理完了までお待ちください。');
      setIsModalOpen(true);
      setSelectedFile(null);

      // ファイル入力をリセット
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      clientLogger.error('ユーザインポート画面', 'インポートエラー', { error });
      setModalMessage(
        error instanceof Error ? error.message : 'インポート処理に失敗しました'
      );
      setIsModalOpen(true);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusLabel = (status: number | null): string => {
    switch (status) {
      case 0:
        return '実施中';
      case 1:
        return '成功';
      case 2:
        return 'エラー';
      default:
        return '不明';
    }
  };

  const getStatusColor = (status: number | null): string => {
    switch (status) {
      case 0:
        return 'text-blue-600';
      case 1:
        return 'text-green-600';
      case 2:
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ユーザインポート</h1>

      {/* アップロードセクション */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">CSVファイルをアップロード</h2>

        <div className="mb-4">
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isUploading || isJobRunning}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">選択中: {selectedFile.name}</p>
          )}
        </div>

        <Button
          onClick={handleUploadAndImport}
          disabled={!selectedFile || isUploading || isJobRunning}
          className="w-full sm:w-auto"
        >
          {isUploading ? 'アップロード中...' : 'アップロードしてインポート実行'}
        </Button>

        {/* ジョブステータス表示 */}
        {isJobRunning && jobStatus && (
          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
            <h3 className="font-semibold mb-2">ジョブ実行中</h3>
            <p className="text-sm">ジョブID: {jobStatus.jobId}</p>
            <p className="text-sm">ステータス: {jobStatus.status}</p>
            {jobStatus.statusReason && (
              <p className="text-sm">詳細: {jobStatus.statusReason}</p>
            )}
          </div>
        )}
      </div>

      {/* インポート結果履歴 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">インポート履歴</h2>

        {isLoadingResults ? (
          <Loading isLoading={true} message="読み込み中..." size="md" />
        ) : importResults.length === 0 ? (
          <p className="text-gray-500">インポート履歴がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    実行日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ファイル名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    実行者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    件数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    メッセージ
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {importResults.map((result) => (
                  <tr key={result.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(result.created_at).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.file_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.executor_name || '-'}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getStatusColor(
                        result.import_status
                      )}`}
                    >
                      {getStatusLabel(result.import_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.count ?? '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                      <div className="whitespace-pre-wrap break-words">
                        {result.message || '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8 whitespace-pre-wrap">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default UserImportContainer;
