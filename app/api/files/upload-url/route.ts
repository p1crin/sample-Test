import { requireAuth } from '@/app/lib/auth';
import { generateUploadUrl } from '@/app/lib/storage';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { formatDateTimeToTimestamp } from '@/utils/date-formatter';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ファイル名を生成するヘルパー
 */
function generateFileName(
  uploadType: 'evidence' | 'test-info',
  originalFileName: string,
  options: { testCaseNo?: string; historyCount?: string; fileType?: number }
): string {
  const timestamp = formatDateTimeToTimestamp(new Date().toISOString());

  if (uploadType === 'evidence') {
    return `evidence_${options.testCaseNo}_${options.historyCount}_${timestamp}_${originalFileName}`;
  }

  const fileTypePrefix = options.fileType === 0 ? 'control_spec' : 'data_flow';
  return `${fileTypePrefix}_${timestamp}_${originalFileName}`;
}

/**
 * ストレージディレクトリを生成するヘルパー
 */
function getDirectory(
  uploadType: 'evidence' | 'test-info',
  testGroupId: string,
  tid: string
): string {
  if (uploadType === 'evidence') {
    return `evidences/${testGroupId}/${tid}`;
  }
  return `test-cases/${testGroupId}/${tid}`;
}

// POST /api/files/upload-url - ファイルアップロード用の署名付きURLを生成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    const body = await req.json();
    const {
      uploadType,
      originalFileName,
      contentType,
      testGroupId,
      tid,
      testCaseNo,
      historyCount,
      fileType,
    } = body;

    // バリデーション
    if (!uploadType || !originalFileName || !contentType || !testGroupId || !tid) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/upload-url'
      );
    }

    if (uploadType !== 'evidence' && uploadType !== 'test-info') {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/upload-url'
      );
    }

    if (uploadType === 'evidence' && (!testCaseNo || historyCount === undefined)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/upload-url'
      );
    }

    if (uploadType === 'test-info' && (fileType === undefined || isNaN(Number(fileType)))) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/upload-url'
      );
    }

    const directory = getDirectory(uploadType, String(testGroupId), tid);
    const fileName = generateFileName(uploadType, originalFileName, {
      testCaseNo: String(testCaseNo),
      historyCount: String(historyCount),
      fileType: Number(fileType),
    });

    const metadata: Record<string, string> = {
      testGroupId: String(testGroupId),
      tid: tid,
    };

    if (uploadType === 'evidence') {
      metadata.testCaseNo = String(testCaseNo);
      metadata.historyCount = String(historyCount);
    } else {
      metadata.fileType = String(fileType);
    }

    // 署名付きURL生成を試みる（ローカル環境ではnullが返る）
    const result = await generateUploadUrl(directory, fileName, contentType, metadata);

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files/upload-url',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: result?.uploadUrl ?? null,
        s3Key: result?.s3Key ?? null,
        fileName,
        directory,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/files/upload-url'
    );
  }
}
