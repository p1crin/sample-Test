import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint } from '@/utils/database-logger';

// 型定義
interface DailyAggregateData {
  dailyOkCount: number; // その日消化件数（実績）
  dailyDefectCount: number; // その日不具合摘出件数（実績）
  dailyResolvedCount: number; // その日解決不具合数（実績）
  cumulativeOkCount: number; // その日時点の累計OK数
  cumulativeDefectCount: number; // その日時点の累計NG数（不具合摘出件数累計）
  cumulativeResolvedCount: number; // その日時点の累計解決件数
}

interface DailyOkCountRow {
  execution_date: string;
  daily_ok_count: number;
}

interface DailyDefectRow {
  first_ng_date: string;
  daily_new_defects: number;
}

interface DailyResolvedRow {
  resolved_date: string;
  daily_resolved_count: number;
}

// JSTの日付文字列を生成するヘルパー関数
const toJSTDateString = (date: Date): string => {
  // ISO形式（UTC）に変換後、日本のタイムゾーン(+09:00)を考慮して日付キーを生成
  // date-fns-tz等のライブラリを使用するのが理想的だが、ここでは簡易的に9時間分のミリ秒を調整
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return jstDate.toISOString().split('T')[0];
};

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
      // (エラーハンドリングは省略せず維持)
      statusCode = 400;
      // logAPIEndpoint({ /* ... */ });
      return NextResponse.json(
        { success: false, error: 'グループIDが無効です' },
        { status: 400 }
      );
    }

    // Check permission
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      // (権限チェックも省略せず維持)
      statusCode = 403;
      // logAPIEndpoint({ /* ... */ });
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
      // (グループ存在チェックも省略せず維持)
      statusCode = 404;
      // logAPIEndpoint({ /* ... */ });
      return NextResponse.json(
        { success: false, error: 'テストグループが見つかりません' },
        { status: 404 }
      );
    }

    // --- 1. 総テスト項目数の取得（分母）---
    const totalTestItems = await prisma.tt_test_contents.count({
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
    });

    // --- 2. 3つのシンプルなSQLクエリで日次データを取得 ---
    // 1. テスト消化件数（実績）：その日にOK（または参照OK）になった件数
    const dailyOkCounts = await prisma.$queryRaw<DailyOkCountRow[]>`
      SELECT
        TO_CHAR(execution_date, 'YYYY-MM-DD') as execution_date,
        COUNT(*) as daily_ok_count
      FROM tt_test_results_history
      WHERE test_group_id = ${groupId}
        AND (judgment = 'OK' OR judgment = '参照OK')
        AND is_deleted = false
      GROUP BY execution_date
      ORDER BY execution_date;
    `;

    // 2. 不具合摘出件数（実績）：そのテストケースで初めてNGが出た日の件数
    const dailyDefects = await prisma.$queryRaw<DailyDefectRow[]>`
      SELECT
        TO_CHAR(first_ng_date, 'YYYY-MM-DD') as first_ng_date,
        COUNT(*) as daily_new_defects
      FROM (
        SELECT
          tid,
          test_case_no,
          MIN(execution_date) as first_ng_date
        FROM tt_test_results_history
        WHERE test_group_id = ${groupId}
          AND judgment = 'NG'
          AND is_deleted = false
        GROUP BY tid, test_case_no
      ) AS first_ng_table
      GROUP BY first_ng_date
      ORDER BY first_ng_date;
    `;

    // 3. 解決不具合数：前回NGだったものが今回OKになった日
    const dailyResolved = await prisma.$queryRaw<DailyResolvedRow[]>`
      SELECT
        TO_CHAR(h_now.execution_date, 'YYYY-MM-DD') as resolved_date,
        COUNT(*) as daily_resolved_count
      FROM tt_test_results_history h_now
      JOIN tt_test_results_history h_prev ON
        h_now.tid = h_prev.tid AND
        h_now.test_case_no = h_prev.test_case_no AND
        h_now.test_group_id = h_prev.test_group_id
      WHERE h_now.test_group_id = ${groupId}
        AND (h_now.judgment = 'OK' OR h_now.judgment = '参照OK')
        AND h_prev.judgment = 'NG'
        AND h_now.history_count = h_prev.history_count + 1
        AND h_now.is_deleted = false
      GROUP BY h_now.execution_date
      ORDER BY h_now.execution_date;
    `;

    // --- 3. 日付範囲を決定 ---
    // テスト実施日範囲を取得（存在する場合）
    const allDates = [
      ...dailyOkCounts.map(r => r.execution_date),
      ...dailyDefects.map(r => r.first_ng_date),
      ...dailyResolved.map(r => r.resolved_date),
    ];

    let startDate: Date;
    let endDate: Date;

    if (allDates.length > 0) {
      const dates = allDates.map(d => new Date(d + 'T00:00:00Z'));
      startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      endDate = new Date(Math.max(...dates.map(d => d.getTime())));
    } else {
      // データがない場合は試験予定期間を使用
      startDate = testGroup.test_startdate ? new Date(testGroup.test_startdate) : new Date();
      endDate = testGroup.test_enddate ? new Date(testGroup.test_enddate) : new Date();
    }

    const today = new Date();
    const maxDate = endDate < today ? endDate : today;

    // --- 4. SQLクエリの結果をMapに変換（高速ルックアップ用）---
    // BigIntをNumberに変換
    const dailyOkMap = new Map<string, number>(
      dailyOkCounts.map(r => [r.execution_date, Number(r.daily_ok_count)])
    );
    const dailyDefectMap = new Map<string, number>(
      dailyDefects.map(r => [r.first_ng_date, Number(r.daily_new_defects)])
    );
    const dailyResolvedMap = new Map<string, number>(
      dailyResolved.map(r => [r.resolved_date, Number(r.daily_resolved_count)])
    );

    // --- 5. 日次データの集計（日付の連続性を担保、累計を計算）---
    const dailyAggregate: Record<string, DailyAggregateData> = {};
    let cumulativeOk = 0;
    let cumulativeDefect = 0;
    let cumulativeResolved = 0;

    // 開始日から最大日付までループ
    for (let d = new Date(startDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      const dateKey = toJSTDateString(d);

      const dailyOk = dailyOkMap.get(dateKey) || 0;
      const dailyDefect = dailyDefectMap.get(dateKey) || 0;
      const dailyResolved = dailyResolvedMap.get(dateKey) || 0;

      cumulativeOk += dailyOk;
      cumulativeDefect += dailyDefect;
      cumulativeResolved += dailyResolved;

      dailyAggregate[dateKey] = {
        dailyOkCount: dailyOk,
        dailyDefectCount: dailyDefect,
        dailyResolvedCount: dailyResolved,
        cumulativeOkCount: cumulativeOk,
        cumulativeDefectCount: cumulativeDefect,
        cumulativeResolvedCount: cumulativeResolved,
      };
    }


    // --- 6. 予測曲線と最終データの計算 ---
    const totalTestDays = Math.max(1, Math.ceil((maxDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const ngPlanCount = testGroup.ng_plan_count || 0;

    const dailyReportData = Object.entries(dailyAggregate).map(([dateKey, data]) => {
      const currentDate = new Date(dateKey + 'T00:00:00Z');
      const elapsedDays = Math.max(1, Math.ceil((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Formula parameters (S-Curve)
      const lambda = 0.35 * (31 / totalTestDays);
      const expTerm = Math.exp(-lambda * elapsedDays);

      // 予測曲線: テスト残件数(予測)
      const predictedRemainingTests = totalTestItems - (totalTestItems * (1 - expTerm) / (1 + 100 * expTerm));

      // 実績: テスト残件数(実績) = 総項目数 - その日までの累計OK数
      const actualRemainingTests = Math.max(0, totalTestItems - data.cumulativeOkCount);

      // 予測曲線: 不具合摘出数(予測)
      const predictedDefects = ngPlanCount * (1 - expTerm) / (1 + 100 * expTerm);

      // 実績: 不具合摘出数(実績累計) = その日までの累計NG数
      const actualDefects = data.cumulativeDefectCount;

      // 未解決不具合数 = 不具合摘出件数（実績累計）- 解決不具合数累計
      const unresolvedDefects = Math.max(0, data.cumulativeDefectCount - data.cumulativeResolvedCount);

      return {
        execution_date: dateKey,
        daily_ok_count: data.dailyOkCount,
        daily_defect_count: data.dailyDefectCount,
        daily_resolved_count: data.dailyResolvedCount,
        predicted_remaining_tests: Math.round(predictedRemainingTests * 10) / 10,
        actual_remaining_tests: actualRemainingTests,
        predicted_defects: Math.round(predictedDefects * 10) / 10,
        actual_defects: actualDefects,
        unresolved_defects: unresolvedDefects,
        test_startdate: testGroup.test_startdate,
        test_enddate: testGroup.test_enddate,
        ng_plan_count: ngPlanCount,
      };
    });

    // (ロギングと成功レスポンスは省略せず維持)
    statusCode = 200;
    // logAPIEndpoint({ /* ... */ });

    return NextResponse.json({
      success: true,
      data: dailyReportData,
    });
  } catch (error) {
    // (エラーハンドリングは省略せず維持)
    const isUnauthorized = error instanceof Error && error.message === 'Unauthorized';
    statusCode = isUnauthorized ? 401 : 500;
    // logAPIEndpoint({ /* ... */ });

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