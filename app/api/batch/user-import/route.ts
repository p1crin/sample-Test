import { NextRequest, NextResponse } from 'next/server';
import { BatchClient, SubmitJobCommand } from '@aws-sdk/client-batch';
import { requireAuth } from '@/app/lib/auth';
import { UserRole } from '@/types/database';
import { handleError } from '@/utils/errorHandler';
import { STATUS_CODES } from '@/constants/statusCodes';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { QueryTimer } from '@/utils/database-logger';

const batchClient = new BatchClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// POST /api/batch/user-import - ユーザインポートバッチを起動
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
        '/api/batch/user-import'
      );
    }

    const body = await req.json();
    const { s3Key } = body;

    // バリデーション
    if (!s3Key || typeof s3Key !== 'string') {
      return handleError(
        new Error('S3キーは必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/batch/user-import'
      );
    }

    // 環境変数チェック
    const jobDefinition = process.env.AWS_BATCH_USER_IMPORT_JOB_DEFINITION;
    const jobQueue = process.env.AWS_BATCH_JOB_QUEUE;
    const inputBucket = process.env.S3_IMPORT_BUCKET;
    const outputBucket = process.env.S3_IMPORT_BUCKET; // 同じバケットを使用
    const databaseUrl = process.env.DATABASE_URL;

    if (!jobDefinition || !jobQueue || !inputBucket || !outputBucket || !databaseUrl) {
      return handleError(
        new Error('AWS Batch設定が不完全です'),
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        apiTimer,
        'POST',
        '/api/batch/user-import'
      );
    }

    // ジョブ名を生成（タイムスタンプ付き）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jobName = `user-import-${timestamp}`;

    // AWS Batchジョブを起動
    const command = new SubmitJobCommand({
      jobName,
      jobQueue,
      jobDefinition,
      containerOverrides: {
        environment: [
          {
            name: 'DATABASE_URL',
            value: databaseUrl,
          },
          {
            name: 'INPUT_S3_BUCKET',
            value: inputBucket,
          },
          {
            name: 'INPUT_S3_KEY',
            value: s3Key,
          },
          {
            name: 'OUTPUT_S3_BUCKET',
            value: outputBucket,
          },
          {
            name: 'EXECUTOR_NAME',
            value: user.name,
          },
          {
            name: 'AWS_REGION',
            value: process.env.AWS_REGION || 'ap-northeast-1',
          },
        ],
      },
    });

    const response = await batchClient.send(command);

    return NextResponse.json({
      success: true,
      data: {
        jobId: response.jobId,
        jobName: response.jobName,
        s3Key,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/batch/user-import'
    );
  }
}