import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

// GET /api/import-results/[importId]/errors - Get import errors
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  try {
    await requireAdmin(req);

    const { importId: importIdStr } = await params;
    const importId = parseInt(importIdStr);
    if (isNaN(importId)) {
      return NextResponse.json({ error: '無効なインポートIDです' }, { status: 400 });
    }

    const result = await query(
      `SELECT error_details, error_row, created_at
       FROM tt_import_result_errors
       WHERE import_result_id = $1 AND is_deleted = FALSE
       ORDER BY error_row ASC`,
      [importId]
    );

    return NextResponse.json({
      errors: result.rows,
    });
  } catch (error) {
    console.error('GET /api/import-results/[importId]/errors error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'エラー情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}
