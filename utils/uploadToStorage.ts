/**
 * ストレージアップロードユーティリティ
 *
 * S3環境ではPresigned URLを使ってブラウザから直接S3にアップロードし、
 * ECSサーバーのメモリを消費しない。
 * ローカル開発環境では従来のFormDataアップロードにフォールバックする。
 */

import { apiPost } from '@/utils/apiClient';
import { FileInfo } from '@/utils/fileUtils';
import clientLogger from '@/utils/client-logger';

interface UploadUrlResponse {
  success: boolean;
  data: {
    uploadUrl: string | null;
    s3Key: string | null;
    fileName: string;
    directory: string;
  };
}

interface UploadParams {
  uploadType: 'evidence' | 'test-info';
  file: FileInfo;
  testGroupId: number | string;
  tid: string;
  testCaseNo?: number | string;
  historyCount?: number | string;
  fileType?: number;
  /** 動的アップロード: trueの場合はis_deleted=trueで登録（更新成功時に確定する） */
  isDynamic?: boolean;
}

/**
 * FileInfoからFileオブジェクトを取得または生成する
 * rawFileがある場合はそれを使用し、なければbase64から復元する
 */
function getFileObject(file: FileInfo): File | null {
  if (file.rawFile) {
    return file.rawFile;
  }

  // rawFileがない場合はbase64から復元
  if (file.base64 && file.type) {
    const byteString = atob(file.base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([uint8Array], { type: file.type });
    return new File([blob], file.name, { type: file.type });
  }

  return null;
}

/**
 * ファイルをストレージにアップロードし、DBレコード登録用APIを呼ぶ
 *
 * 1. /api/files/upload-url から署名付きURLを取得
 * 2. S3の場合: ブラウザから直接S3にPUT → /api/files/{type} にs3Keyで登録
 *    ローカルの場合: 従来のFormDataで /api/files/{type} に送信
 * 3. アップロード結果（path, fileNo等）を含むFileInfoを返す
 */
export async function uploadFileToStorage(params: UploadParams): Promise<FileInfo> {
  const { uploadType, file, testGroupId, tid, testCaseNo, historyCount, fileType, isDynamic } = params;

  const fileObject = getFileObject(file);
  if (!fileObject) {
    throw new Error(`ファイルデータが不正です: ${file.name}`);
  }

  const contentType = file.type || fileObject.type || 'application/octet-stream';

  // Step 1: 署名付きURL取得
  const urlResponse = await apiPost<UploadUrlResponse>('/api/files/upload-url', {
    uploadType,
    originalFileName: file.name,
    contentType,
    testGroupId,
    tid,
    testCaseNo,
    historyCount,
    fileType,
  });

  if (!urlResponse.success) {
    throw new Error('署名付きURLの取得に失敗しました');
  }

  const { uploadUrl, s3Key, fileName, directory } = urlResponse.data;

  if (uploadUrl && s3Key) {
    // S3環境: ブラウザから直接S3にアップロード
    clientLogger.info('uploadToStorage', 'S3直接アップロード開始', { fileName, s3Key });

    const putResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: fileObject,
    });

    if (!putResponse.ok) {
      throw new Error(`S3アップロード失敗 (status: ${putResponse.status})`);
    }

    clientLogger.info('uploadToStorage', 'S3直接アップロード成功', { s3Key });

    // DB登録API呼び出し（s3Keyのみ送信、ファイルは送らない）
    const apiEndpoint = uploadType === 'evidence' ? '/api/files/evidences' : '/api/files/test-info';
    const registerResponse = await apiPost<{ success: boolean; data: { fileNo?: number; evidenceId?: number; filePath?: string; evidencePath?: string; fileType?: number } }>(
      apiEndpoint,
      {
        s3Key,
        originalFileName: file.name,
        testGroupId,
        tid,
        ...(uploadType === 'evidence' ? { testCaseNo, historyCount } : { fileType, isDynamic }),
      }
    );

    if (!registerResponse.success) {
      throw new Error('ファイル情報のDB登録に失敗しました');
    }

    const resultData = registerResponse.data;
    return {
      ...file,
      path: resultData.filePath || resultData.evidencePath,
      fileNo: resultData.fileNo || resultData.evidenceId,
      fileType: resultData.fileType,
    };
  } else {
    // ローカル開発環境: 従来のFormDataアップロード
    clientLogger.info('uploadToStorage', 'FormDataアップロード（ローカル環境）', { fileName });

    const formData = new FormData();
    formData.append('file', fileObject);
    formData.append('testGroupId', String(testGroupId));
    formData.append('tid', tid);

    if (uploadType === 'evidence') {
      formData.append('testCaseNo', String(testCaseNo));
      formData.append('historyCount', String(historyCount));
    } else {
      formData.append('fileType', String(fileType));
      if (isDynamic) {
        formData.append('isDynamic', 'true');
      }
    }

    const apiEndpoint = uploadType === 'evidence' ? '/api/files/evidences' : '/api/files/test-info';

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`アップロード失敗 (status: ${response.status}, response: ${responseText})`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await response.json() as any;

    if (!result.success) {
      throw new Error('アップロードに失敗しました');
    }

    return {
      ...file,
      path: result.data.filePath || result.data.evidencePath,
      fileNo: result.data.fileNo || result.data.evidenceId,
      fileType: result.data.fileType,
    };
  }
}
