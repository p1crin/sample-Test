import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth } from '@/app/lib/auth';
import { UserRole } from '@/types/database';
import { handleError } from '@/utils/errorHandler';
import { STATUS_CODES } from '@/constants/statusCodes';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { QueryTimer } from '@/utils/database-logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// POST /api/batch/upload-url - CSVアップロード用のプリサインドURLを生成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);

  try {
    // システム管理者のみ許可
    if (user.user_role !== UserRole.ADMIN) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'POST',
        '/api/batch/upload-url'
      );
    }

    const body = await req.json();
    const { fileName, importType } = body;

    // バリデーション
    if (!fileName || typeof fileName !== 'string') {
      return handleError(
        new Error('ファイル名は必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/upload-url'
      );
    }

    if (!importType || (importType !== 'user' && importType !== 'test')) {
      return handleError(
        new Error('インポートタイプは "user" または "test" である必要があります'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/upload-url'
      );
    }

    // ファイル種別チェック（userインポート: CSV、testインポート: ZIP）
    if (importType === 'user' && !fileName.toLowerCase().endsWith('.csv')) {
      return handleError(
        new Error('ユーザインポートにはCSVファイルのみアップロード可能です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/upload-url'
      );
    }
    if (importType === 'test' && !fileName.toLowerCase().endsWith('.zip')) {
      return handleError(
        new Error('テストインポートにはZIPファイルのみアップロード可能です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/upload-url'
      );
    }

    const bucket = process.env.INPUT_S3_BUCKET;
    if (!bucket) {
      return handleError(
        new Error('S3バケットが設定されていません'),
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        apiTimer,
        'POST',
        '/api/batch/upload-url'
      );
    }

    // S3キーを生成（タイムスタンプ付き）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${importType}-import/${timestamp}_${sanitizedFileName}`;

    // プリサインドURLを生成（15分間有効）
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900, // 15分
    });

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl,
        key,
        bucket,
        expiresIn: 900,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/batch/upload-url'
    );
  }
}