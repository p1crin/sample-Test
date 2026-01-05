import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint } from '@/utils/database-logger';

// 型定義
interface DailyReportRow {
    execution_date: string; // YYYY-MM-DD形式の日付
    daily_defect_count: number; // その日の不具合摘出数（実績）
    predicted_remaining_tests: number; // テスト残件数(予測) - JavaScriptで計算
    actual_remaining_tests: number; // テスト残件数(実績)
    predicted_defects: number; // 不具合摘出数(予測) - JavaScriptで計算
    actual_defects: number; // 不具合摘出数(累計)
    unresolved_defects: number; // 未解決不具合数
}

// S-Curve formula parameters (予測曲線の計算用パラメータ)
const LAMBDA_BASE = 0.35;      // Curve steepness coefficient (曲線の傾き係数)
const REFERENCE_DAYS = 31;     // Standard month for normalization (正規化用の標準月日数)
const DECAY_FACTOR = 100;      // Exponential decay sensitivity (指数減衰の感度)


// GET /api/test-groups/[groupId]/daily-report-data - Get daily report data for graph
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const apiTimer = new QueryTimer();
    let statusCode = 200;
    let user;

    try {
        user = await requireAuth(req);
        const { groupId: groupIdParam } = await params;
        const groupId = parseInt(groupIdParam, 10);

        if (isNaN(groupId)) {
            statusCode = 400;
            logAPIEndpoint({
                method: 'GET',
                endpoint: '/api/test-groups/[groupId]/daily-report-data',
                userId: user.id,
                statusCode,
                executionTime: apiTimer.elapsed(),
                error: 'Invalid group ID',
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
                endpoint: '/api/test-groups/[groupId]/daily-report-data',
                userId: user.id,
                statusCode,
                executionTime: apiTimer.elapsed(),
                error: 'Insufficient permissions',
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
                endpoint: '/api/test-groups/[groupId]/daily-report-data',
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

        // --- 1. 総テスト項目数の取得（分母）---
        // is_target=true のみを対象とする
        const totalTestItems = await prisma.tt_test_contents.count({
            where: {
                test_group_id: groupId,
                is_target: true,
                is_deleted: false,
            },
        });

        // --- 2. 統合クエリで日次データを取得 ---
        const dailyReportRows = await prisma.$queryRaw<DailyReportRow[]>`
      WITH calendar AS (
        -- 1. 期間内の全日付を生成
        SELECT generate_series(
          COALESCE(${testGroup.test_startdate}, CURRENT_DATE)::timestamp,
          LEAST(COALESCE(${testGroup.test_enddate}, CURRENT_DATE)::timestamp, CURRENT_DATE::timestamp),
          '1 day'::interval
        )::date AS report_date
      ),
      total_count AS (
        -- 2. 全テスト項目数を取得（is_target=true のみ対象）
        SELECT COUNT(*) as total_items
        FROM tt_test_contents
        WHERE test_group_id = ${groupId} AND is_target = true AND is_deleted = false
      ),
      first_ok_dates AS (
        -- 3. 各テストが「初めてOK」になった日を特定（残件計算用、is_target=true のみ対象）
        SELECT h.tid, h.test_case_no, MIN(h.execution_date) as first_ok_date
        FROM tt_test_results_history h
        INNER JOIN tt_test_contents c ON
          h.test_group_id = c.test_group_id AND
          h.tid = c.tid AND
          h.test_case_no = c.test_case_no
        WHERE h.test_group_id = ${groupId}
          AND h.judgment IN ('OK', '参照OK')
          AND c.is_target = true
          AND h.is_deleted = false
          AND c.is_deleted = false
        GROUP BY h.tid, h.test_case_no
      ),
      daily_stats AS (
        -- 4. 日ごとの実績集計
        SELECT
          h.execution_date::date AS execution_date,
          -- 不具合摘出数（実績）：NGの件数をカウント（同じテストが複数回NG判定されたら複数件）
          COUNT(*) FILTER (WHERE h.judgment = 'NG') AS daily_ng_count,
          -- その日に「初めてOK」になった数（残件を減らすための数）
          (SELECT COUNT(*) FROM first_ok_dates f WHERE f.first_ok_date = h.execution_date::date) AS daily_first_ok_count
        FROM tt_test_results_history h
        WHERE h.test_group_id = ${groupId} AND h.is_deleted = false
        GROUP BY h.execution_date::date
      )
      SELECT
        TO_CHAR(c.report_date, 'YYYY-MM-DD')::text as execution_date,
        COALESCE(d.daily_ng_count, 0)::double precision as daily_defect_count,
        0::double precision as predicted_remaining_tests,
        ((SELECT total_items FROM total_count) - COALESCE(SUM(COALESCE(d.daily_first_ok_count, 0)) OVER (ORDER BY c.report_date), 0))::double precision as actual_remaining_tests,
        0::double precision as predicted_defects,
        COALESCE(SUM(COALESCE(d.daily_ng_count, 0)) OVER (ORDER BY c.report_date), 0)::double precision as actual_defects,
        (
          SELECT COUNT(*)::double precision
          FROM (
            SELECT DISTINCT ON (h2.tid, h2.test_case_no) h2.tid, h2.test_case_no, h2.judgment
            FROM tt_test_results_history h2
            INNER JOIN tt_test_contents c2 ON
              h2.test_group_id = c2.test_group_id AND
              h2.tid = c2.tid AND
              h2.test_case_no = c2.test_case_no
            WHERE h2.test_group_id = ${groupId}
              AND h2.is_deleted = false
              AND c2.is_deleted = false
              AND c2.is_target = true
              AND h2.execution_date::date <= c.report_date
            ORDER BY h2.tid, h2.test_case_no, h2.execution_date DESC, h2.history_count DESC
          ) AS latest
          WHERE latest.judgment = 'NG'
        ) as unresolved_defects
      FROM calendar c
      LEFT JOIN daily_stats d ON c.report_date = d.execution_date
      ORDER BY c.report_date;
    `;


        // --- 3. 予測曲線計算（S-Curve）---
        const ngPlanCount = testGroup.ng_plan_count || 0;
        const testStartDate = testGroup.test_startdate ? new Date(testGroup.test_startdate) : new Date();
        const testEndDate = testGroup.test_enddate ? new Date(testGroup.test_enddate) : new Date();
        const today = new Date();
        const maxDate = testEndDate < today ? testEndDate : today;

        const totalTestDays = Math.max(1, Math.ceil((maxDate.getTime() - testStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const dailyReportData = dailyReportRows.map((row) => {
            const currentDate = new Date(row.execution_date + 'T00:00:00Z');
            const elapsedDays = Math.max(1, Math.ceil((currentDate.getTime() - testStartDate.getTime()) / (1000 * 60 * 60 * 24)));

            // Formula parameters (S-Curve)
            const lambda = LAMBDA_BASE * (REFERENCE_DAYS / totalTestDays);
            const expTerm = Math.exp(-lambda * elapsedDays);

            // 予測曲線: テスト残件数(予測)
            const predictedRemainingTests = totalTestItems - (totalTestItems * (1 - expTerm) / (1 + DECAY_FACTOR * expTerm));

            // 予測曲線: 不具合摘出数(予測)
            const predictedDefects = ngPlanCount * (1 - expTerm) / (1 + DECAY_FACTOR * expTerm);

            return {
                execution_date: row.execution_date,
                daily_defect_count: row.daily_defect_count,
                predicted_remaining_tests: Math.round(predictedRemainingTests * 10) / 10,
                actual_remaining_tests: row.actual_remaining_tests,
                predicted_defects: Math.round(predictedDefects * 10) / 10,
                actual_defects: row.actual_defects,
                unresolved_defects: row.unresolved_defects,
                test_startdate: testGroup.test_startdate,
                test_enddate: testGroup.test_enddate,
                ng_plan_count: ngPlanCount,
            };
        });

        statusCode = 200;
        logAPIEndpoint({
            method: 'GET',
            endpoint: '/api/test-groups/[groupId]/daily-report-data',
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
        const errorMessage = error instanceof Error ? error.message : String(error);

        logAPIEndpoint({
            method: 'GET',
            endpoint: '/api/test-groups/[groupId]/daily-report-data',
            userId: user?.id,
            statusCode,
            executionTime: apiTimer.elapsed(),
            error: errorMessage,
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