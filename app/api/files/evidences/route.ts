import { requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { uploadFile, deleteFile } from '@/app/lib/storage';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { formatDateTimeToTimestamp } from '@/utils/date-formatter';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

/**
 * エビデンスのDB登録共通処理
 */
async function registerEvidence(
  parsedTestGroupId: number,
  tid: string,
  parsedTestCaseNo: number,
  parsedHistoryCount: number,
  originalFileName: string,
  filePath: string,
) {
  // テストグループの存在確認
  const testGroup = await prisma.tt_test_groups.findUnique({
    where: { id: parsedTestGroupId, is_deleted: false },
  });

  if (!testGroup) {
    return null;
  }

  // 最大evidence_noを取得（全history_count対象）
  const maxEvidence = await prisma.tt_test_evidences.findFirst({
    where: {
      test_group_id: parsedTestGroupId,
      tid: tid,
      test_case_no: parsedTestCaseNo,
    },
    orderBy: {
      evidence_no: 'desc',
    },
  });

  const newfileNo = (maxEvidence?.evidence_no ?? 0) + 1;

  // エビデンスをデータベースに記録（is_deleted=true: 登録成功時にfalseへ変更する削除フラグ）
  const evidenceRecord = await prisma.tt_test_evidences.create({
    data: {
      test_group_id: parsedTestGroupId,
      tid: tid,
      test_case_no: parsedTestCaseNo,
      history_count: parsedHistoryCount,
      evidence_no: newfileNo,
      evidence_name: originalFileName,
      evidence_path: filePath,
      is_deleted: true,
    },
  });

  return {
    evidenceId: evidenceRecord.evidence_no,
    fileNo: newfileNo,
    evidenceName: originalFileName,
    evidencePath: filePath,
    testCaseNo: parsedTestCaseNo,
    historyCount: parsedHistoryCount,
  };
}

// POST /api/files/evidences - エビデンスファイルアップロード
// JSON (s3Key指定) または FormData (ローカルアップロード) の両方をサポート
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // === Presigned URLフロー: S3に直接アップロード済み、DB登録のみ ===
      const body = await req.json();
      const { s3Key, originalFileName, testGroupId, tid, testCaseNo, historyCount } = body;

      if (!s3Key || !originalFileName || !testGroupId || !tid || testCaseNo === undefined || historyCount === undefined) {
        return handleError(
          new Error(ERROR_MESSAGES.BAD_REQUEST),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          '/api/files/evidences'
        );
      }

      const parsedTestGroupId = parseInt(String(testGroupId), 10);
      const parsedTestCaseNo = parseInt(String(testCaseNo), 10);
      const parsedHistoryCount = parseInt(String(historyCount), 10);

      if (isNaN(parsedTestGroupId) || isNaN(parsedTestCaseNo) || isNaN(parsedHistoryCount)) {
        return handleError(
          new Error(ERROR_MESSAGES.BAD_REQUEST),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          '/api/files/evidences'
        );
      }

      const result = await registerEvidence(
        parsedTestGroupId, tid, parsedTestCaseNo, parsedHistoryCount,
        originalFileName, s3Key
      );

      if (!result) {
        return handleError(
          new Error(ERROR_MESSAGES.NOT_FOUND),
          STATUS_CODES.NOT_FOUND,
          apiTimer,
          'POST',
          '/api/files/evidences'
        );
      }

      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/files/evidences',
        userId: user.id,
        statusCode: STATUS_CODES.CREATED,
        executionTime: apiTimer.elapsed(),
        dataSize: 1,
      });

      return NextResponse.json(
        { success: true, data: result },
        { status: STATUS_CODES.CREATED }
      );
    }

    // === 従来のFormDataフロー（ローカル開発環境用） ===
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const testGroupId = formData.get('testGroupId') as string;
    const tid = formData.get('tid') as string;
    const testCaseNo = formData.get('testCaseNo') as string;
    const historyCount = formData.get('historyCount') as string;

    if (!file || !testGroupId || !tid || !testCaseNo || !historyCount) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/evidences'
      );
    }

    const parsedTestGroupId = parseInt(testGroupId, 10);
    const parsedTestCaseNo = parseInt(testCaseNo, 10);
    const parsedHistoryCount = parseInt(historyCount, 10);

    if (isNaN(parsedTestGroupId) || isNaN(parsedTestCaseNo) || isNaN(parsedHistoryCount)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/evidences'
      );
    }

    // ファイル名生成
    const fileName = `evidence_${testCaseNo}_${historyCount}_${formatDateTimeToTimestamp(new Date().toISOString())}_${file.name}`;

    // ストレージにアップロード（環境に応じてローカルまたはS3）
    const uploadResult = await uploadFile(
      file,
      `evidences/${testGroupId}/${tid}`,
      fileName,
      {
        testGroupId: testGroupId,
        tid: tid,
        testCaseNo: testCaseNo,
        historyCount: historyCount,
      }
    );

    const result = await registerEvidence(
      parsedTestGroupId, tid, parsedTestCaseNo, parsedHistoryCount,
      file.name, uploadResult.filePath
    );

    if (!result) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'POST',
        '/api/files/evidences'
      );
    }

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files/evidences',
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: STATUS_CODES.CREATED }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/files/evidences'
    );
  }
}

// DELETE /api/files/evidences - エビデンスファイル削除
export async function DELETE(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // リクエストボディから削除対象のエビデンス情報を取得
    const body = await req.json();
    const { testGroupId, tid, testCaseNo, historyCount, fileNo } = body;

    if (!testGroupId || !tid || testCaseNo === undefined || historyCount === undefined || fileNo === undefined) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        '/api/files/evidences'
      );
    }

    // データベースからエビデンス情報を取得
    const evidenceRecord = await prisma.tt_test_evidences.findFirst({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        test_case_no: parseInt(testCaseNo, 10),
        history_count: parseInt(historyCount, 10),
        evidence_no: parseInt(fileNo, 10),
      },
    });

    if (!evidenceRecord) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        '/api/files/evidences'
      );
    }

    // ストレージから物理ファイルを削除（環境に応じてローカルまたはS3）
    if (evidenceRecord.evidence_path) {
      await deleteFile(evidenceRecord.evidence_path);
    }

    // データベースから削除
    await prisma.tt_test_evidences.deleteMany({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        test_case_no: parseInt(testCaseNo, 10),
        history_count: parseInt(historyCount, 10),
        evidence_no: parseInt(fileNo, 10),
      },
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: '/api/files/evidences',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Evidence file deleted successfully',
      },
      { status: STATUS_CODES.OK }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      '/api/files/evidences'
    );
  }
}
