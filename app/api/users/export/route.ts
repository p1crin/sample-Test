import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { query } from '@/app/lib/db';

// GET /api/users/export - Export users to CSV
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    // Fetch all users with their tags
    const usersResult = await query(
      `SELECT
        u.id,
        u.email,
        u.user_role,
        u.department,
        u.company,
        ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL) as tags
       FROM mt_users u
       LEFT JOIN mt_user_tags ut ON u.id = ut.user_id
       LEFT JOIN mt_tags t ON ut.tag_id = t.id AND t.is_deleted = FALSE
       WHERE u.is_deleted = FALSE
       GROUP BY u.id, u.email, u.user_role, u.department, u.company
       ORDER BY u.id ASC`
    );

    const users = usersResult.rows;

    // Generate CSV content
    const headers = ['email', 'password', 'user_role', 'department', 'company', 'tags'];
    const csvRows = [headers.join(',')];

    for (const user of users) {
      const u = user as Record<string, unknown>;
      const row = [
        escapeCSVField(u.email as string),
        '', // Password is not exported for security reasons
        (u.user_role as string).toString(),
        escapeCSVField((u.department as string) || ''),
        escapeCSVField((u.company as string) || ''),
        escapeCSVField(u.tags && Array.isArray(u.tags) && u.tags.length > 0 ? (u.tags as string[]).join(',') : ''),
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="users_export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('GET /api/users/export error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'ユーザーのエクスポートに失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * Escape CSV field (handle commas, quotes, newlines)
 */
function escapeCSVField(field: string): string {
  if (!field) return '';

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}
