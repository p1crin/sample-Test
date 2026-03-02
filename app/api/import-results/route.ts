import { isAdmin, isTestDesignerUser, isTestManager, requireAuth } from "@/app/lib/auth";
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from "@/constants/errorMessages";
import { STATUS_CODES } from "@/constants/statusCodes";
import { Prisma } from "@/generated/prisma/client";
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { handleError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";

// GET /api/import-results -インポート結果一覧を取得
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);

  try {
    // ユーザーが管理者またはテスト管理者かどうかを確認
    // 一般ユーザーはテスト設計者タグを持つ場合のみ許可
    const isDesigner = !isAdmin(user) && !isTestManager(user)
      ? await isTestDesignerUser(user.id)
      : false;

    if (!isAdmin(user) && !isTestManager(user) && !isDesigner) {
      logAPIEndpoint({
        method: 'GET',
        endpoint: '/api/import-results',
        userId: user.id,
        statusCode: STATUS_CODES.FORBIDDEN,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.PERMISSION_DENIED,
      });
      return NextResponse.json(
        { error: ERROR_MESSAGES.PERMISSION_DENIED },
        { status: STATUS_CODES.FORBIDDEN }
      );
    }
    // クエリ文字列から検査パラメータを取得
    const { searchParams } = new URL(req.url);

    // ページネーションパラメータを取得
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // Prismaのwhere条件を構築
    const whereConditions: Prisma.tt_import_resultsWhereInput = {
      is_deleted: false,
    };
    // テスト管理者またはテスト設計者の場合はインポート種別を1(テストケース)に設定する。
    if (isTestManager(user) || isDesigner) {
      whereConditions.import_type = {
        equals: 1,
      };
    }

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/import-results',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
      queryParams: searchParams,
    })

    // ページネーション用に合計件数を取得
    const countTimer = new QueryTimer();
    const totalCount = await prisma.tt_import_results.count({
      where: whereConditions,
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_import_result',
      executionTime: countTimer.elapsed(),
      rowsReturned: 1,
      query: 'COUNT(*)',
      params: Object.entries(whereConditions),
    });

    // ページネーション付きでインポート結果一覧を取得
    const dataTimer = new QueryTimer();
    const importResult = await prisma.tt_import_results.findMany({
      where: whereConditions,
      orderBy: {
        created_at: 'desc',
      },
      skip: offset,
      take: limit
    });

    logDatabaseQuery({
      operation: 'SELECT',
      userId: user.id,
      executionTime: dataTimer.elapsed(),
      rowsReturned: importResult.length,
      query: 'findmany',
      params: [{ skip: offset, take: limit }],
    });

    logAPIEndpoint({
      method: 'GET',
      endpoint: 'api/import-results',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      queryParams: searchParams,
    });

    return NextResponse.json({ success: true, data: importResult, totalCount });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      '/api/import-results'
    );
  }
}