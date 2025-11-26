import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

// GET /api/import-results - Get import history
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const result = await query(
      `SELECT id, file_name, import_date, import_status, executor_name, import_type, count, created_at
       FROM tt_import_results
       WHERE is_deleted = FALSE
       ORDER BY created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({
      imports: result.rows,
    });
  } catch (error) {
    console.error('GET /api/import-results error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'インポート履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
