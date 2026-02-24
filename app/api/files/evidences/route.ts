import { requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { uploadFile, deleteFile, getFileUrl } from '@/app/lib/storage';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { formatDateTimeToTimestamp } from '@/utils/date-formatter';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/files/evidences - エビデンスファイルアップロード
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // FormDataからファイルとメタデータを取得
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const testGroupId = formData.get('testGroupId') as string;
    const tid = formData.get('tid') as string;
    const testCaseNo = formData.get('testCaseNo') as string;

    if (!file || !testGroupId || !tid || !testCaseNo) {
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

    if (isNaN(parsedTestGroupId) || isNaN(parsedTestCaseNo)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/evidences'
      );
    }

    // テストグループの存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: parsedTestGroupId, is_deleted: false },
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'POST',
        '/api/files/evidences'
      );
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

    // ファイル名生成
    const fileName = `evidence_${testCaseNo}_${formatDateTimeToTimestamp(new Date().toISOString())}_${file.name}`;

    // ストレージにアップロード（環境に応じてローカルまたはS3）
    const uploadResult = await uploadFile(
      file,
      `evidences/${testGroupId}/${tid}`,
      fileName,
      {
        originalName: file.name,
        testGroupId: testGroupId,
        tid: tid,
        testCaseNo: testCaseNo,
      }
    );

    // エビデンスをデータベースに記録（history_count は保存後にUPDATEで設定）
    const evidenceRecord = await prisma.tt_test_evidences.create({
      data: {
        test_group_id: parsedTestGroupId,
        tid: tid,
        test_case_no: parsedTestCaseNo,
        evidence_no: newfileNo,
        history_count: null,
        evidence_name: file.name,
        evidence_path: uploadResult.filePath,
      },
    });

    // サムネイル表示用のURLを生成（S3: 署名付きURL、ローカル: そのままのパス）
    const evidenceUrl = await getFileUrl(uploadResult.filePath);

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files/evidences',
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          evidenceId: evidenceRecord.evidence_no,
          fileNo: newfileNo,
          evidenceName: file.name,
          evidencePath: uploadResult.filePath,
          evidenceUrl: evidenceUrl,
          testCaseNo: parsedTestCaseNo,
        },
      },
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
    const { testGroupId, tid, testCaseNo, fileNo } = body;

    if (!testGroupId || !tid || testCaseNo === undefined || fileNo === undefined) {
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