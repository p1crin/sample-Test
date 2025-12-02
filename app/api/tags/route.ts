import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

// GET /api/tags - Get all tags
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    await requireAuth(req);

    const tags = await prisma.mt_tags.findMany({
      where: {
        is_deleted: false,
      },
      orderBy: {
        name: 'asc',
      },
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/tags',
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: tags.length,
    });

    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/tags',
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error('GET /api/tags error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'タグの取得に失敗しました' },
      { status: 500 }
    );
  }
}
