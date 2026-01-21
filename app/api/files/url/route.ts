import { requireAuth } from '@/app/lib/auth';
import { getFileUrl } from '@/app/lib/storage';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/files/url - ファイルの署名付きURL取得
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // リクエストボディからファイルパスを取得
    const body = await req.json();
    const { filePath } = body;

    if (!filePath) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files/url'
      );
    }

    // 署名付きURLを生成（S3の場合）またはそのままのパスを返す（ローカルの場合）
    const url = await getFileUrl(filePath);

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files/url',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          url,
        },
      },
      { status: STATUS_CODES.OK }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/files/url'
    );
  }
}