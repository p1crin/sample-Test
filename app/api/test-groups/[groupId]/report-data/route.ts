import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint } from '@/utils/database-logger';

// GET /api/test-groups/[groupId]/report-data - Get aggregated test results by first_layer and second_layer
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const apiTimer = new QueryTimer();
    let statusCode = 200;

    try {
        const user = await requireAuth(req);
        const { groupId: groupIdParam } = await params;
        const groupId = parseInt(groupIdParam, 10);

        if (isNaN(groupId)) {
            statusCode = 400;
            logAPIEndpoint({
                method: 'GET',
                endpoint: `/api/test-groups/${groupIdParam}/report-data`,
                userId: user.id,
                statusCode,
                executionTime: apiTimer.elapsed(),
                error: 'Invalid groupId parameter',
            });
            return NextResponse.json(
                { success: false, error: 'グループIDが無効です' },
                { status: 400 }
            );
        }

        // Check permission
        const canView = await canViewTestGroup(user.id, user.user_role, groupId);
        if (!canView) {
            statusCode = 403;
            logAPIEndpoint({
                method: 'GET',
                endpoint: `/api/test-groups/${groupId}/report-data`,
                userId: user.id,
                statusCode,
                executionTime: apiTimer.elapsed(),
                error: 'Permission denied',
            });
            return NextResponse.json(
                { success: false, error: 'アクセス権限がありません' },
                { status: 403 }
            );
        }

        // Verify test group exists
        const testGroup = await prisma.tt_test_groups.findUnique({
            where: { id: groupId },
            select: { id: true, is_deleted: true },
        });

        if (!testGroup || testGroup.is_deleted) {
            statusCode = 404;
            logAPIEndpoint({
                method: 'GET',
                endpoint: `/api/test-groups/${groupId}/report-data`,
                userId: user.id,
                statusCode,
                executionTime: apiTimer.elapsed(),
                error: 'Test group not found',
            });
            return NextResponse.json(
                { success: false, error: 'テストグループが見つかりません' },
                { status: 404 }
            );
        }

        // Get aggregated test results grouped by first_layer and second_layer
        // Using raw query since Prisma doesn't support complex aggregations well
        const aggregatedData = await prisma.$queryRaw`
      SELECT
        tc.first_layer,
        tc.second_layer,
        COUNT(*)::integer AS total_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::integer AS completed_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '未着手' THEN 1 ELSE 0 END), 0)::integer AS not_started_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('保留', 'QA中') THEN 1 ELSE 0 END), 0)::integer AS in_progress_items,
        COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::integer AS ok_items,
        COALESCE(SUM(CASE WHEN tr.judgment = 'NG' THEN 1 ELSE 0 END), 0)::integer AS ng_items,
        COALESCE(SUM(CASE WHEN tr.judgment = '対象外' THEN 1 ELSE 0 END), 0)::integer AS excluded_items,
        CASE
          WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK') THEN 1 ELSE 0 END), 0)::float / COUNT(*)
          ELSE 0
        END AS ok_rate,
        CASE
          WHEN COUNT(*) > 0 THEN COALESCE(SUM(CASE WHEN tr.judgment IN ('OK', '参照OK', 'NG') THEN 1 ELSE 0 END), 0)::float / COUNT(*)
          ELSE 0
        END AS progress_rate
      FROM
        tt_test_results tr
      JOIN
        tt_test_cases tc
      ON
        tr.test_group_id = tc.test_group_id AND tr.tid = tc.tid
      WHERE
        tr.test_group_id = ${groupId}
        AND tr.is_deleted = FALSE
        AND tc.is_deleted = FALSE
      GROUP BY
        tc.first_layer, tc.second_layer
      ORDER BY
        tc.first_layer, tc.second_layer
    `;

        statusCode = 200;
        logAPIEndpoint({
            method: 'GET',
            endpoint: `/api/test-groups/${groupId}/report-data`,
            userId: user.id,
            statusCode,
            executionTime: apiTimer.elapsed(),
            dataSize: (aggregatedData as unknown[]).length,
        });

        return NextResponse.json({
            success: true,
            data: aggregatedData,
        });
    } catch (error) {
        const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
        statusCode = isUnauthorized ? 401 : 500;

        logAPIEndpoint({
            method: 'GET',
            endpoint: '/api/test-groups/[groupId]/report-data',
            statusCode,
            executionTime: apiTimer.elapsed(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (isUnauthorized) {
            return NextResponse.json(
                { success: false, error: '認証が必要です' },
                { status: 401 }
            );
        }

        console.error('GET /api/test-groups/[groupId]/report-data error:', error);
        return NextResponse.json(
            { success: false, error: 'レポートデータの取得に失敗しました' },
            { status: 500 }
        );
    }
}