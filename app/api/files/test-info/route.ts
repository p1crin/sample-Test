import { requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { uploadFile, deleteFile } from '@/app/lib/storage';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/files/test-info - ファイルアップロード
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // FormDataからファイルとメタデータを取得
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const testGroupId = formData.get('testGroupId') as string;
    const tid = formData.get('tid') as string;
    const fileType = parseInt(formData.get('fileType') as string, 10); // 0: controlSpec, 1: dataFlow

    if (!file || !testGroupId || !tid || isNaN(fileType)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/test-info'
      );
    }

    // テストグループの存在確認と権限チェック
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: parseInt(testGroupId, 10), is_deleted: false },
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'POST',
        '/api/files/test-info'
      );
    }

    // 最大file_noを取得
    const maxFileNo = await prisma.tt_test_case_files.findFirst({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_type: fileType,
      },
      orderBy: {
        file_no: 'desc',
      },
    });

    const newFileNo = (maxFileNo?.file_no ?? 0) + 1;

    // ファイル名生成（タイムスタンプ + 元のファイル名）
    const fileTypePrefix = fileType === 0 ? 'control_spec' : 'data_flow';
    const fileName = `${fileTypePrefix}_${Date.now()}_${file.name}`;

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

    // データベースに記録
    const fileRecord = await prisma.tt_test_case_files.create({
      data: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_type: fileType,
        file_no: newFileNo,
        file_name: file.name,
        file_path: uploadResult.filePath,
      },
    });

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files/test-info',
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          fileNo: fileRecord.file_no,
          fileName: fileRecord.file_name,
          filePath: fileRecord.file_path,
          fileType: fileRecord.file_type,
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