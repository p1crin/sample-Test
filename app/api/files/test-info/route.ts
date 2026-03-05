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
 * テストファイルのDB登録共通処理
 */
async function registerTestFile(
  parsedTestGroupId: number,
  tid: string,
  fileType: number,
  originalFileName: string,
  filePath: string,
  isDynamic: boolean,
) {
  // テストグループの存在確認と権限チェック
  const testGroup = await prisma.tt_test_groups.findUnique({
    where: { id: parsedTestGroupId, is_deleted: false },
  });

  if (!testGroup) {
    return null;
  }

  // 最大file_noを取得
  const maxFileNo = await prisma.tt_test_case_files.findFirst({
    where: {
      test_group_id: parsedTestGroupId,
      tid: tid,
      file_type: fileType,
    },
    orderBy: {
      file_no: 'desc',
    },
  });

  const newFileNo = (maxFileNo?.file_no ?? 0) + 1;

  // データベースに記録
  const fileRecord = await prisma.tt_test_case_files.create({
    data: {
      test_group_id: parsedTestGroupId,
      tid: tid,
      file_type: fileType,
      file_no: newFileNo,
      file_name: originalFileName,
      file_path: filePath,
      is_deleted: isDynamic,
    },
  });

  return {
    fileNo: fileRecord.file_no,
    fileName: fileRecord.file_name,
    filePath: fileRecord.file_path,
    fileType: fileRecord.file_type,
  };
}

// POST /api/files/test-info - ファイルアップロード
// JSON (s3Key指定) または FormData (ローカルアップロード) の両方をサポート
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // === Presigned URLフロー: S3に直接アップロード済み、DB登録のみ ===
      const body = await req.json();
      const { s3Key, originalFileName, testGroupId, tid, fileType, isDynamic } = body;

      if (!s3Key || !originalFileName || !testGroupId || !tid || fileType === undefined) {
        return handleError(
          new Error(ERROR_MESSAGES.BAD_REQUEST),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          '/api/files/test-info'
        );
      }

      const parsedFileType = parseInt(String(fileType), 10);
      if (isNaN(parsedFileType)) {
        return handleError(
          new Error(ERROR_MESSAGES.BAD_REQUEST),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          '/api/files/test-info'
        );
      }

      const result = await registerTestFile(
        parseInt(String(testGroupId), 10), tid, parsedFileType,
        originalFileName, s3Key, !!isDynamic
      );

      if (!result) {
        return handleError(
          new Error(ERROR_MESSAGES.NOT_FOUND),
          STATUS_CODES.NOT_FOUND,
          apiTimer,
          'POST',
          '/api/files/test-info'
        );
      }

      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/files/test-info',
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
    const fileType = parseInt(formData.get('fileType') as string, 10);
    // isDynamic=true の場合は is_deleted=true（動的アップロード＝更新成功時に確定する）
    // isDynamic=false/省略 の場合は is_deleted=false（送信時アップロード＝即確定）
    const isDynamic = formData.get('isDynamic') === 'true';

    if (!file || !testGroupId || !tid || isNaN(fileType)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/test-info'
      );
    }

    // ファイル名生成（タイムスタンプ + 元のファイル名）
    const fileTypePrefix = fileType === 0 ? 'control_spec' : 'data_flow';
    const fileName = `${fileTypePrefix}_${formatDateTimeToTimestamp(new Date().toISOString())}_${file.name}`;

    // ストレージにアップロード（環境に応じてローカルまたはS3）
    const uploadResult = await uploadFile(
      file,
      `test-cases/${testGroupId}/${tid}`,
      fileName,
      {
        testGroupId: testGroupId,
        tid: tid,
        fileType: String(fileType),
      }
    );

    const result = await registerTestFile(
      parseInt(testGroupId, 10), tid, fileType,
      file.name, uploadResult.filePath, isDynamic
    );

    if (!result) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'POST',
        '/api/files/test-info'
      );
    }

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files/test-info',
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
      '/api/files/test-info'
    );
  }
}

// DELETE /api/files/test-info - ファイル削除
export async function DELETE(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // リクエストボディから削除対象のファイル情報を取得
    const body = await req.json();
    const { testGroupId, tid, fileNo, fileType } = body;

    if (!testGroupId || !tid || fileNo === undefined || fileType === undefined) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        '/api/files/test-info'
      );
    }

    // データベースからファイル情報を取得
    const fileRecord = await prisma.tt_test_case_files.findFirst({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_no: fileNo,
        file_type: fileType,
      },
    });

    if (!fileRecord) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        '/api/files/test-info'
      );
    }

    // ストレージから物理ファイルを削除（環境に応じてローカルまたはS3）
    if (fileRecord.file_path) {
      await deleteFile(fileRecord.file_path);
    }

    // データベースから削除
    await prisma.tt_test_case_files.deleteMany({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_no: fileNo,
        file_type: fileType,
      },
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: '/api/files/test-info',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'File deleted successfully',
      },
      { status: STATUS_CODES.OK }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      '/api/files/test-info'
    );
  }
}
