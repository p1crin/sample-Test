import { NextRequest, NextResponse } from 'next/server';
import { BatchClient, DescribeJobsCommand } from '@aws-sdk/client-batch';
import { requireAuth } from '@/app/lib/auth';
import { UserRole } from '@/types/database';
import { handleError } from '@/utils/errorHandler';
import { STATUS_CODES } from '@/constants/statusCodes';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { QueryTimer } from '@/utils/database-logger';

const batchClient = new BatchClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

// GET /api/batch/status/[jobId] - AWS Batchジョブのステータスを取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);
  const { jobId } = await params;

  try {

    // システム管理者のみ許可
    if (user.user_role !== UserRole.ADMIN) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/batch/status/${jobId}`
      );
    }

    if (!jobId) {
      return handleError(
        new Error('ジョブIDは必須です'),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        `/api/batch/status/${jobId}`
      );
    }

    // AWS Batchからジョブステータスを取得
    const command = new DescribeJobsCommand({
      jobs: [jobId],
    });

    const response = await batchClient.send(command);

    if (!response.jobs || response.jobs.length === 0) {
      return handleError(
        new Error('ジョブが見つかりません'),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'GET',
        `/api/batch/status/${jobId}`
      );
    }

    const job = response.jobs[0];

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.jobId,
        jobName: job.jobName,
        status: job.status,
        statusReason: job.statusReason,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        stoppedAt: job.stoppedAt,
        container: job.container
          ? {
            exitCode: job.container.exitCode,
            reason: job.container.reason,
            logStreamName: job.container.logStreamName,
          }
          : undefined,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/batch/status/${jobId}`
    );
  }
}