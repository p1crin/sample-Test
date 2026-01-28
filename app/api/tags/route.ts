import { withAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { NextResponse } from 'next/server';

// GET /api/tags - Get all tags
export const GET = withAuth(async (req, user) => {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.OK;

  try {
    const tags = await prisma.mt_tags.findMany({
      where: {
        is_deleted: false,
      },
      orderBy: {
        name: 'asc',
      },
    });

    statusCode = STATUS_CODES.OK;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/tags',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: tags.length,
    });

    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/tags',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.TAG_FETCH_FAILED },
      { status: STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
});