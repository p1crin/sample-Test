import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { requireAuth } from '@/app/lib/auth';
import { UserRole } from '@/types/database';
import { handleError } from '@/utils/errorHandler';
import { STATUS_CODES } from '@/constants/statusCodes';
import { QueryTimer } from '@/utils/database-logger';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

interface UploadPart {
  partNumber: number;
  etag: string;
}

// POST /api/batch/multipart-upload/complete - マルチパートアップロードを完了
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
        '/api/batch/multipart-upload/complete'
      );
    }

    const body = await req.json();
    const { key, uploadId, parts } = body;

    if (!key || typeof key !== 'string') {
      return handleError(
        new Error('keyは必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/complete'
      );
    }
    if (!uploadId || typeof uploadId !== 'string') {
      return handleError(
        new Error('uploadIdは必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/complete'
      );
    }
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return handleError(
        new Error('partsは必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/complete'
      );
    }

    const bucket = process.env.INPUT_S3_BUCKET;
    if (!bucket) {
      return handleError(
        new Error('S3バケットが設定されていません'),
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        apiTimer,
        'POST',
        '/api/batch/multipart-upload/complete'
      );
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part: UploadPart) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    });
    await s3Client.send(command);

    return NextResponse.json({
      success: true,
      data: { key },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/batch/multipart-upload/complete'
    );
  }
}
