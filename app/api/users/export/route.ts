import { requireAdmin } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { NextRequest, NextResponse } from 'next/server';

// GET /api/users/export - ユーザエクスポート
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  const user = await requireAdmin(req);
  try {
    const queryTimer = new QueryTimer();

    // 全ユーザーとそのタグを取得
    const users = await prisma.mt_users.findMany({
      select: {
        id: true,
        email: true,
        user_role: true,
        department: true,
        company: true,
        is_deleted: true,
        name: true,
        mt_user_tags: {
          select: {
            mt_tags: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_users',
      executionTime: queryTimer.elapsed(),
      rowsReturned: users.length,
      query: 'findMany',
      params: [],
    });

    // CSVコンテンツを生成
    const headers = ['ID', 'ID(メールアドレス)', '氏名', 'パスワード', '部署', '会社名', '権限', 'タグ', 'ステータス'];
    const csvRows = [headers.join(',')];

    for (const user of users) {
      const tags = user.mt_user_tags.map(tag => tag.mt_tags.name).filter(Boolean).join(';');
      const row = [
        user.id.toString(),
        escapeCSVField(user.email),
        escapeCSVField(user.name || ''),
        '', // セキュリティのためパスワードはエクスポートしない
        escapeCSVField(user.department || ''),
        escapeCSVField(user.company || ''),
        user.user_role.toString(),
        escapeCSVField(tags),
        user.is_deleted ? '1' : '0',
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = '\uFEFF' + csvRows.join('\n'); // BOMを追加

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/users/export',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: users.length,
    });

    // CSVをダウンロード可能なファイルとして返す
    return new NextResponse(csvContent, {
      status: STATUS_CODES.OK,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment;`,
      },
    });
  } catch (error) {
    console.error('GET /api/users/export error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      logAPIEndpoint({
        method: 'GET',
        endpoint: '/api/users/export',
        userId: user.id,
        statusCode: STATUS_CODES.UNAUTHORIZED,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
      });
      return NextResponse.json({ error: ERROR_MESSAGES.UNAUTHORIZED }, { status: STATUS_CODES.UNAUTHORIZED });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      logAPIEndpoint({
        method: 'GET',
        endpoint: '/api/users/export',
        userId: user.id,
        statusCode: STATUS_CODES.FORBIDDEN,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
      });
      return NextResponse.json({ error: ERROR_MESSAGES.PERMISSION_DENIED }, { status: STATUS_CODES.FORBIDDEN });
    }

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/users/export',
      userId: user.id,
      statusCode: STATUS_CODES.INTERNAL_SERVER_ERROR,
      executionTime: apiTimer.elapsed(),
      dataSize: 0,
    });

    return NextResponse.json(
      { error: 'ユーザのエクスポートに失敗しました' },
      { status: STATUS_CODES.INTERNAL_SERVER_ERROR }
    );
  }
}

/**
 * CSVフィールドをエスケープ（カンマ、引用符、改行を処理）
 */
function escapeCSVField(field: string): string {
  if (!field) return '';

  // フィールドにカンマ、引用符、改行が含まれている場合、引用符で囲み、引用符をエスケープ
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }

  return field;
}