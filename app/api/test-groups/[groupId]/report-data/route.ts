import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint, logDatabaseQuery } from '@/utils/database-logger';
import { STATUS_CODES } from '@/constants/statusCodes';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { Prisma } from '@/generated/prisma/client';
import { handleError } from '@/utils/errorHandler';
import { group } from 'console';

type AggregatedData = {
  first_layer: string;
  second_layer: string;
  total_items: number;
  completed_items: number;
  not_started_items: number;
  in_progress_items: number;
  ok_items: number;
  ng_items: number;
  excluded_items: number;
  ok_rate: number;
  progress_rate: number;
}

// GET /api/test-groups/[groupId]/report-data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.OK;
  const { groupId: groupIdParam } = await params;
  const groupId = parseInt(groupIdParam, 10);

  try {
    const user = await requireAuth(req);

    if (isNaN(groupId)) {
      statusCode = STATUS_CODES.BAD_REQUEST;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupIdParam}/report-data`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.INVALID_GROUP_ID,
      });
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_GROUP_ID },
        { status: STATUS_CODES.BAD_REQUEST }
      );
    }

    // 権限チェック
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      statusCode = STATUS_CODES.FORBIDDEN;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/report-data`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.PERMISSION_DENIED,
      });
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.PERMISSION_DENIED },
        { status: STATUS_CODES.FORBIDDEN }
      );
    }

    // テストグループ存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: groupId, is_deleted: false },
    });

    if (!testGroup) {
      statusCode = STATUS_CODES.NOT_FOUND;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/report-data`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.NOT_FOUND,
      });
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.NOT_FOUND },
        { status: STATUS_CODES.NOT_FOUND }
      );
    }

    // 第１層と第２層でグループ化された集計テスト結果を取得する
    const query = Prisma.sql`
      SELECT
        tc.first_layer,
        tc.second_layer,
        COUNT(tc.tid)::integer AS total_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::integer AS completed_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '未着手' OR (tr.judgment IS NULL AND ttc.is_target = TRUE) THEN 1 ELSE 0 END), 0)::integer AS not_started_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('保留', 'QA中') THEN 1 ELSE 0 END), 0)::integer AS in_progress_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::integer AS ok_items,
        COALESCE(SUM(CASE WHEN tr.judgment = 'NG' THEN 1 ELSE 0 END), 0)::integer AS ng_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '対象外' OR ttc.is_target = FALSE THEN 1 ELSE 0 END), 0)::integer AS excluded_items,
        CASE
          WHEN COUNT(tc.tid) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::float / NULLIF(COUNT(tc.tid) - COALESCE(SUM(CASE WHEN tr.judgment = '対象外' OR ttc.is_target = FALSE THEN 1 ELSE 0 END), 0)::float, 0)
          ELSE 0
        END AS ok_rate,
        CASE
          WHEN COUNT(tc.tid) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::float / NULLIF(COUNT(tc.tid) - COALESCE(SUM(CASE WHEN tr.judgment = '対象外' OR ttc.is_target = FALSE THEN 1 ELSE 0 END), 0)::float, 0)
          ELSE 0
        END AS progress_rate
      FROM
        tt_test_contents ttc
      LEFT JOIN
        tt_test_results tr
      ON
        ttc.test_group_id = tr.test_group_id AND ttc.tid = tr.tid AND ttc.test_case_no = tr.test_case_no
      LEFT JOIN
        tt_test_cases tc
      ON
        ttc.test_group_id = tc.test_group_id AND ttc.tid = tc.tid
      WHERE
        ttc.test_group_id = ${groupId}
        AND ttc.is_deleted = FALSE
      GROUP BY
        tc.first_layer, tc.second_layer
      ORDER BY
        tc.first_layer, tc.second_layer
    `;

    const aggregatedData: AggregatedData[] = await prisma.$queryRaw<AggregatedData[]>(query);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'repor_data',
      executionTime: apiTimer.elapsed(),
      rowsReturned: aggregatedData ? aggregatedData.length : 0,
      query: query.strings.join("?"),
      params: [{ groupId: groupId }],
    });

    statusCode = STATUS_CODES.OK;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/report-data`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: aggregatedData.length,
    });

    return NextResponse.json({
      success: true,
      data: aggregatedData,
    });
  } catch (error) {
    const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
    statusCode = isUnauthorized ? STATUS_CODES.UNAUTHORIZED : STATUS_CODES.INTERNAL_SERVER_ERROR;

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/report-data`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : ERROR_MESSAGES.DEFAULT,
    });

    return handleError(
      error as Error,
      statusCode,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}/report-data`
    )
  }
}