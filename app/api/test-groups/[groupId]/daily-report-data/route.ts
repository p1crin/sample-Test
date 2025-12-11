import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint } from '@/utils/database-logger';

// GET /api/test-groups/[groupId]/daily-report-data - Get daily report data for graph
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
        endpoint: `/api/test-groups/${groupIdParam}/daily-report-data`,
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
        endpoint: `/api/test-groups/${groupId}/daily-report-data`,
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
      select: { id: true, test_startdate: true, test_enddate: true, ng_plan_count: true, is_deleted: true },
    });

    if (!testGroup || testGroup.is_deleted) {
      statusCode = 404;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/daily-report-data`,
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

    // Get all test results to calculate daily aggregates
    const testResults = await prisma.tt_test_results.findMany({
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
      select: {
        execution_date: true,
        judgment: true,
      },
      orderBy: {
        execution_date: 'asc',
      },
    });

    // Get total test items count
    const totalTestItems = await prisma.tt_test_contents.count({
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
    });

    // Get OK count for actual remaining tests calculation
    const okCount = testResults.filter((r) => r.judgment === 'OK' || r.judgment === '参照OK').length;

    // Get total NG count for unresolved defects
    const totalNgCount = testResults.filter((r) => r.judgment === 'NG').length;

    // Get latest test results for each test to find unresolved defects
    const unresolved = await prisma.tt_test_results.groupBy({
      by: ['tid', 'test_case_no'],
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
      _max: {
        version: true,
      },
    });

    const unresolvedDefectsData = await Promise.all(
      unresolved.map(async (u) => {
        const latestResult = await prisma.tt_test_results.findFirst({
          where: {
            test_group_id: groupId,
            tid: u.tid,
            test_case_no: u.test_case_no,
            version: u._max.version,
          },
          select: {
            judgment: true,
          },
        });
        return latestResult?.judgment === 'NG' ? 1 : 0;
      })
    );

    const unresolvedDefectsCount = unresolvedDefectsData.reduce((a, b) => a + b, 0);

    // Aggregate by execution date
    const dailyAggregate: Record<string, { ngCount: number; executionDate: Date }> = {};

    testResults.forEach((result) => {
      const dateKey = result.execution_date ? result.execution_date.toISOString().split('T')[0] : 'unknown';
      if (!dailyAggregate[dateKey]) {
        dailyAggregate[dateKey] = {
          ngCount: 0,
          executionDate: result.execution_date || new Date(),
        };
      }
      if (result.judgment === 'NG') {
        dailyAggregate[dateKey].ngCount += 1;
      }
    });

    // Calculate dynamic values
    const startDate = testGroup.test_startdate ? new Date(testGroup.test_startdate) : new Date();
    const endDate = testGroup.test_enddate ? new Date(testGroup.test_enddate) : new Date();
    const totalTestDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const ngPlanCount = testGroup.ng_plan_count || 0;

    // Convert aggregate to array with dynamic calculations
    const dailyReportData = Object.entries(dailyAggregate).map(([dateKey, data]) => {
      const currentDate = new Date(dateKey);
      const elapsedDays = Math.max(1, Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Formula parameters
      const lambda = 0.35 * (31 / totalTestDays);

      // テスト残件数(予測) = 総項目数 - 総項目数 * (1 - e^(-lambda * 経過日数)) / (1 + 100 * e^(-lambda * 経過日数))
      const expTerm = Math.exp(-lambda * elapsedDays);
      const predictedRemainingTests = totalTestItems - (totalTestItems * (1 - expTerm) / (1 + 100 * expTerm));

      // テスト残件数(実績) = 総項目数 - OK数
      const actualRemainingTests = totalTestItems - okCount;

      // 不具合摘出数(予測) = 不具合摘出予定数 * (1 - e^(-lambda * 経過日数)) / (1 + 100 * e^(-lambda * 経過日数))
      const predictedDefects = ngPlanCount * (1 - expTerm) / (1 + 100 * expTerm);

      // 不具合摘出数(実績) = 累計のNG数
      const actualDefects = totalNgCount;

      return {
        execution_date: dateKey,
        ng_count: data.ngCount,
        predicted_remaining_tests: predictedRemainingTests,
        actual_remaining_tests: actualRemainingTests,
        predicted_defects: predictedDefects,
        actual_defects: actualDefects,
        unresolved_defects: unresolvedDefectsCount,
        test_startdate: testGroup.test_startdate,
        test_enddate: testGroup.test_enddate,
        ng_plan_count: ngPlanCount,
      };
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/daily-report-data`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: dailyReportData.length,
    });

    return NextResponse.json({
      success: true,
      data: dailyReportData,
    });
  } catch (error) {
    const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
    statusCode = isUnauthorized ? 401 : 500;

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/test-groups/[groupId]/daily-report-data',
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

    console.error('GET /api/test-groups/[groupId]/daily-report-data error:', error);
    return NextResponse.json(
      { success: false, error: '日時レポートデータの取得に失敗しました' },
      { status: 500 }
    );
  }
}
