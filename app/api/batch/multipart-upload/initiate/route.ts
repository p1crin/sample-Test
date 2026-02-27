import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAuth } from '@/app/lib/auth';
import { UserRole } from '@/types/database';
import { handleError } from '@/utils/errorHandler';
import { STATUS_CODES } from '@/constants/statusCodes';
import { QueryTimer } from '@/utils/database-logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const PART_URL_EXPIRES_IN = 3600; // 1時間
const MAX_PARTS = 10000;

// POST /api/batch/multipart-upload/initiate - マルチパートアップロードを開始し各パートのプリサインドURLを生成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);

  try {
    if (user.user_role !== UserRole.ADMIN) {
      return handleError(
        new Error('権限がありません'),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }

    const body = await req.json();
    const { fileName, importType, partCount } = body;

    if (!fileName || typeof fileName !== 'string') {
      return handleError(
        new Error('ファイル名は必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }

    if (!importType || (importType !== 'user' && importType !== 'test')) {
      return handleError(
        new Error('インポートタイプは "user" または "test" である必要があります'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }

    if (!partCount || typeof partCount !== 'number' || partCount < 1 || partCount > MAX_PARTS) {
      return handleError(
        new Error(`パート数は1〜${MAX_PARTS}の範囲で指定してください`),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }

    if (importType === 'user' && !fileName.toLowerCase().endsWith('.csv')) {
      return handleError(
        new Error('ユーザインポートにはCSVファイルのみアップロード可能です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }
    if (importType === 'test' && !fileName.toLowerCase().endsWith('.zip')) {
      return handleError(
        new Error('テストインポートにはZIPファイルのみアップロード可能です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }

    const bucket = process.env.INPUT_S3_BUCKET;
    if (!bucket) {
      return handleError(
        new Error('S3バケットが設定されていません'),
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/initiate'
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${importType}-import/${timestamp}_${sanitizedFileName}`;
    const contentType = importType === 'test' ? 'application/zip' : 'text/csv';

    // マルチパートアップロードを開始
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });
    const { UploadId } = await s3Client.send(createCommand);

    // 各パートのプリサインドURLを生成
    const partUrls = await Promise.all(
      Array.from({ length: partCount }, (_, i) => i + 1).map(async (partNumber) => {
        const uploadPartCommand = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId,
          PartNumber: partNumber,
        });
        return getSignedUrl(s3Client, uploadPartCommand, { expiresIn: PART_URL_EXPIRES_IN });
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        uploadId: UploadId,
        key,
        partUrls,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/batch/multipart-upload/initiate'
    );
  }
}
