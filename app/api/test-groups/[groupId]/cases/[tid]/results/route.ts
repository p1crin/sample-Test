'use server';
import { canViewTestGroup, requireAuth } from "@/app/lib/auth";
import { prisma } from '@/app/lib/prisma';
import { STATUS_CODES } from "@/constants/statusCodes";
import { handleError } from "@/utils/errorHandler";
import { logAPIEndpoint, QueryTimer } from "@/utils/database-logger";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ groupId: string; tid: string }>;
}

// GET /api/test-groups/[groupId]/cases/[tid]/results - テスト結果を取得
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { groupId: groupIdStr, tid } = await params;
  const groupId = parseInt(groupIdStr, 10);

  try {
    const user = await requireAuth(req);
    // 権限チェック
    await canViewTestGroup(user.id, user.user_role, groupId);

    // tt_test_results_history からテスト結果履歴を取得
    const resultsHistory = await prisma.tt_test_results_history.findMany({
      where: {
        test_group_id: groupId,
        tid,
        is_deleted: false,
      },
      include: {
        tt_test_contents: true,
        tt_test_evidences: {
          where: { is_deleted: false },
        },
      },
      orderBy: [
        { history_count: 'asc' },
        { test_case_no: 'asc' },
      ],
    });

    // 最新の結果を取得（history_count が最大のもの）
    const maxHistoryCount = Math.max(...resultsHistory.map(r => r.history_count), 0);

    // history_count でグループ化
    const groupedByHistory = new Map<number, typeof resultsHistory>();
    resultsHistory.forEach(result => {
      if (!groupedByHistory.has(result.history_count)) {
        groupedByHistory.set(result.history_count, []);
      }
      groupedByHistory.get(result.history_count)!.push(result);
    });

    // 各history_count の結果を整形
    const formatResults = (results: typeof resultsHistory) => {
      return results.map(r => ({
        testCase: r.tt_test_contents?.test_case || '',
        expectedValue: r.tt_test_contents?.expected_value || '',
        result: r.result || '',
        judgment: r.judgment || '未着手',
        softwareVersion: r.software_version || '',
        hardwareVersion: r.hardware_version || '',
        comparatorVersion: r.comparator_version || '',
        executionDate: r.execution_date ? r.execution_date.toISOString().split('T')[0] : '',
        executor: r.executor || '',
        evidence: r.tt_test_evidences.map(e => ({
          name: e.evidence_name || '',
          id: e.evidence_path || '',
        })),
        note: r.note || '',
      }));
    };

    // 最新結果を決定（最新の判定が「再実施対象外」の場合は前の履歴を使用）
    let latestDisplayHistoryCount = maxHistoryCount;
    const latestResults = groupedByHistory.get(maxHistoryCount) || [];

    // 最新結果の判定をチェック
    if (latestResults.length > 0) {
      const hasExcludedJudgment = latestResults.some(r => r.judgment === '対象外');
      if (hasExcludedJudgment && maxHistoryCount > 1) {
        latestDisplayHistoryCount = maxHistoryCount - 1;
      }
    }

    // 履歴データを整形（降順で返す：最新から古い順）
    const historiesArray = Array.from(groupedByHistory.keys())
      .sort((a, b) => b - a)
      .map(historyCount => ({
        historyCount,
        results: formatResults(groupedByHistory.get(historyCount) || []),
      }));

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}/results`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
    });

    return NextResponse.json({
      success: true,
      data: {
        latestResult: {
          historyCount: latestDisplayHistoryCount,
          results: formatResults(groupedByHistory.get(latestDisplayHistoryCount) || []),
        },
        histories: historiesArray,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}/cases/${tid}/results`
    );
  }
}
