import { isAdmin, isTestManager, requireAuth } from "@/app/lib/auth";
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from "@/constants/errorMessages";
import { STATUS_CODES } from "@/constants/statusCodes";
import { Prisma } from "@/generated/prisma/client";
import { ImportType } from "@/types/database";
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { handleError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ importResultId: string }>;
}
// GET /api/imort-results/[importResultId] - インポート結果詳細情報を取得
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);
  const { importResultId } = await params;

  try {
    // ユーザーが管理者またはテスト管理者かどうかを確認
    if (!isAdmin(user) && !isTestManager(user)) {
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

    // Prismaのwhere条件を構築
    const whereConditions: Prisma.tt_import_resultsWhereInput = {
      id: parseInt(importResultId, 10),
      is_deleted: false,
    };

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/import-results',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
    })

    // インポート結果を取得
    const dataTimer = new QueryTimer();
    const importResultInfo = await prisma.tt_import_results.findFirst({
      where: whereConditions,
      orderBy: {
        updated_at: 'desc',
      },
    });
    // 取得した種別がユーザかつユーザがテスト管理者の場合権限エラー
    if (importResultInfo?.import_type === ImportType.USER && !isAdmin(user)) {
      throw new Error('Forbidden: Admin access required');
    }
    logDatabaseQuery({
      operation: 'SELECT',
      userId: user.id,
      executionTime: dataTimer.elapsed(),
      rowsReturned: 1,
      query: 'findFirst',
      params: Object.entries(whereConditions)
    });

    logAPIEndpoint({
      method: 'GET',
      endpoint: 'api/import-results',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
    });
    return NextResponse.json({ success: true, data: importResultInfo })
  } catch (error) {
    return handleError(error as Error, apiTimer, 'GET', `/api/import-results/${parseInt(importResultId)}`);
  }
}