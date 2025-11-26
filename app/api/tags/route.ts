import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { query, getAllRows } from '@/app/lib/db';

// GET /api/tags - Get all tags
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const result = await query(
      `SELECT id, name FROM mt_tags WHERE is_deleted = FALSE ORDER BY name`
    );

    const tags = getAllRows(result);

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('GET /api/tags error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'タグの取得に失敗しました' },
      { status: 500 }
    );
  }
}
