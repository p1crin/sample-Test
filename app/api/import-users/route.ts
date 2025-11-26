import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { importUsersFromCSV } from '@/app/lib/import-users';
import { query } from '@/app/lib/db';

// POST /api/import-users - Import users from CSV
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = await req.json();
    const { csvContent, fileName } = body;

    if (!csvContent) {
      return NextResponse.json({ error: 'CSVコンテンツが必要です' }, { status: 400 });
    }

    // Create import result record (In Progress)
    const importResult = await query(
      `INSERT INTO tt_import_results
       (file_name, import_date, import_status, executor_name, import_type, count, created_at, updated_at)
       VALUES ($1, CURRENT_DATE, 1, $2, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [fileName || 'users.csv', admin.email]
    );

    const importId = importResult.rows[0].id;

    try {
      // Import users
      const result = await importUsersFromCSV(csvContent, admin.email);

      // Update import result (Completed or Error)
      const finalStatus = result.errorCount === 0 ? 3 : 0; // 3 = Completed, 0 = Error
      await query(
        `UPDATE tt_import_results
         SET import_status = $1, count = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [finalStatus, result.successCount, importId]
      );

      // Insert error records
      if (result.errors.length > 0) {
        for (const error of result.errors) {
          await query(
            `INSERT INTO tt_import_result_errors
             (import_result_id, error_details, error_row, created_at, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [importId, error.message, error.row]
          );
        }
      }

      return NextResponse.json({
        message: 'ユーザーインポートが完了しました',
        importId,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
      });
    } catch (importError) {
      // Update import result to Error status
      await query(
        'UPDATE tt_import_results SET import_status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [importId]
      );

      throw importError;
    }
  } catch (error) {
    console.error('POST /api/import-users error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ユーザーインポートに失敗しました' },
      { status: 500 }
    );
  }
}
