import { canViewTestGroup, requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { Prisma } from '@/generated/prisma/client';
import { QueryTimer, logAPIEndpoint, logDatabaseQuery } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// 予測曲線の計算用パラメータ
const LAMBDA_BASE = 0.35;      // 曲線の傾き係数
const REFERENCE_DAYS = 31;     // 正規化用の標準月日数
const DECAY_FACTOR = 100;      // 指数減衰の感度

type DailyReportData = {
  execution_date: string;
  daily_defect_count: number;
  actual_remaining_tests: number;
  cumulative_defect_count: number;
  unresolved_defects: number;
};

// GET /api/test-groups/[groupId]/daily-report-data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.OK;
  let user;

  try {
    user = await requireAuth(req);
    const { groupId: groupIdParam } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // 形式チェック
    if (isNaN(groupId)) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_GROUP_ID),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/daily-report-data`,
      );
    }

    // 権限チェック
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/daily-report-data`,
      );
    }

    // テストグループ存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: groupId, is_deleted: false },
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/daily-report-data`,
      );
    }

    // テスト結果履歴存在確認
    const testHistory = await prisma.tt_test_results_history.count({
      where: { test_group_id: groupId, is_deleted: false },
    });

    // 結果履歴がなかったらあとの処理は無駄なのでスキップ
    if (testHistory === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // --- 1. 総テスト項目数の取得（分母）---
    const totalTestItems = await prisma.tt_test_contents.count({
      where: {
        test_group_id: groupId,
        is_target: true,
        is_deleted: false,
      },
    });

    // --- 2. 日次データを取得 ---
    const query = Prisma.sql`
      SELECT
        target_date as execution_date,
        COALESCE(daily_ng_count, 0) as daily_defect_count,
        ${totalTestItems} - ok as actual_remaining_tests,
        SUM(COALESCE(daily_ng_count, 0)) OVER (ORDER by target_date) as cumulative_defect_count,
        ng::integer as unresolved_defects
      FROM
        daily_report(${groupId}::INTEGER) as daily_report
      LEFT JOIN
        (
          SELECT
            execution_date,
            COUNT(case when judgment = 'NG' then 1 else null end) as daily_ng_count
          FROM
            tt_test_results_history
          WHERE
            test_group_id = ${groupId}::INTEGER
            AND is_deleted = false
          GROUP BY
            execution_date
        ) on
        execution_date = daily_report.target_date
    `
    const dailyReportData: DailyReportData[] = await prisma.$queryRaw(query);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'daily_report',
      executionTime: apiTimer.elapsed(),
      rowsReturned: dailyReportData ? dailyReportData.length : 0,
      query: query.strings.join("?"),
      params: [{ groupId: groupId }],
    });

    const dailyReportDataConverted = dailyReportData.map((row: DailyReportData) => {
      return {
        execution_date: row.execution_date,
        daily_defect_count: Number(row.daily_defect_count),
        actual_remaining_tests: Number(row.actual_remaining_tests),
        cumulative_defect_count: Number(row.cumulative_defect_count),
        unresolved_defects: Number(row.unresolved_defects),
      };
    });
    // --- 3. 日付範囲を決定 ---
    const allDates = dailyReportDataConverted.map((r: { execution_date: string; }) => r.execution_date);

    let startDate: Date;
    let endDate: Date;

    if (allDates.length > 0) {
      const dates = allDates.map((d: string) => new Date(d));
      startDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
      endDate = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
    } else {
      // データがない場合は試験予定期間を使用
      startDate = testGroup.test_startdate ? new Date(testGroup.test_startdate) : new Date();
      endDate = testGroup.test_enddate ? new Date(testGroup.test_enddate) : new Date();
    }

    const today = new Date();
    const maxDate = endDate < today ? endDate : today;

    // --- 4. 予測曲線と最終データの計算 ---
    const totalTestDays = Math.max(1, Math.ceil((maxDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const ngPlanCount = testGroup.ng_plan_count || 0;

    const finalReportData = dailyReportDataConverted.map((data: DailyReportData) => {
      const currentDate = new Date(data.execution_date);
      const elapsedDays = Math.max(1, Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      // 予測曲線用パラメータ
      const lambda = LAMBDA_BASE * (REFERENCE_DAYS / totalTestDays);

      const expTerm = Math.exp(-lambda * elapsedDays);

      // 予測曲線: テスト残件数(予測)
      const predictedRemainingTests = totalTestItems - (totalTestItems * (1 - expTerm) / (1 + DECAY_FACTOR * expTerm));

      // 予測曲線: 不具合摘出数(予測)
      const predictedDefects = ngPlanCount * (1 - expTerm) / (1 + DECAY_FACTOR * expTerm);

      return {
        execution_date: data.execution_date,
        daily_defect_count: data.daily_defect_count,
        actual_remaining_tests: data.actual_remaining_tests,
        cumulative_defect_count: data.cumulative_defect_count,
        unresolved_defects: data.unresolved_defects,
        predicted_remaining_tests: Math.round(predictedRemainingTests * 10) / 10,
        predicted_defects: Math.round(predictedDefects * 10) / 10,
        test_startdate: testGroup.test_startdate,
        test_enddate: testGroup.test_enddate,
        ng_plan_count: ngPlanCount,
      };
    });

    statusCode = STATUS_CODES.OK;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/test-groups/[groupId]/daily-report-data',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: finalReportData.length,
    });

    return NextResponse.json({
      success: true,
      data: finalReportData,
    });
  } catch (error) {
    const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
    statusCode = isUnauthorized ? STATUS_CODES.UNAUTHORIZED : STATUS_CODES.INTERNAL_SERVER_ERROR;
    return handleError(
      error as Error,
      statusCode,
      apiTimer,
      'GET',
      `/api/test-groups/[groupId]/daily-report-data`,
    );
  }
}