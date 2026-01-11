import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint, logDatabaseQuery } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';


// GET /api/test-groups/[groupId]/cases/[tid]/results - テスト結果リストを取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);
  const { groupId: groupIdParam, tid } = await params;
  const groupId = parseInt(groupIdParam, 10);
  try {
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

    // 権限をチェック
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/cases/${tid}/results`,
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

    // 現在の結果テーブルからテスト結果を取得
    const resultsTimer = new QueryTimer();
    const results = await prisma.tt_test_results.findMany({
      where: {
        test_group_id: groupId,
        tid: tid,
        is_deleted: false,
      },
      orderBy: [
        { test_case_no: 'asc' },
        { version: 'desc' },
      ],
    });
    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_results',
      executionTime: resultsTimer.elapsed(),
      rowsReturned: results.length,
      query: 'findMany',
      params: [{ test_group_id: groupId, tid: tid, is_deleted: false }],
    });

    // テスト結果の履歴を取得
    const historyTimer = new QueryTimer();
    const history = await prisma.tt_test_results_history.findMany({
      where: {
        test_group_id: groupId,
        tid: tid,
        is_deleted: false,
      },
      orderBy: [
        { test_case_no: 'asc' },
        { history_count: 'desc' },
      ],
    });
    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_results_history',
      executionTime: historyTimer.elapsed(),
      rowsReturned: history.length,
      query: 'findMany',
      params: [{ test_group_id: groupId, tid: tid, is_deleted: false }],
    });

    // 全てのtest_case_noに対するテスト内容を取得
    const testContentsTimer = new QueryTimer();
    const testContents = await prisma.tt_test_contents.findMany({
      where: {
        test_group_id: groupId,
        tid: tid,
        is_deleted: false,
      },
      orderBy: { test_case_no: 'asc' },
    });
    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_contents',
      executionTime: testContentsTimer.elapsed(),
      rowsReturned: testContents.length,
      query: 'findMany',
      params: [{ test_group_id: groupId, tid: tid, is_deleted: false }],
    });

    // test_case_noごとのテスト内容のマップを作成
    const testContentsMap = testContents.reduce((acc: Record<string, unknown>, content: unknown) => {
      const c = content as Record<string, unknown>;
      const key = c.test_case_no as string | number;
      acc[key] = c;
      return acc;
    }, {});

    // 全てのtest_case_noとhistory_countsに対するエビデンスを取得
    const evidencesTimer = new QueryTimer();
    const evidences = await prisma.tt_test_evidences.findMany({
      where: {
        test_group_id: groupId,
        tid: tid,
        is_deleted: false,
      },
      orderBy: [
        { test_case_no: 'asc' },
        { history_count: 'desc' },
        { evidence_no: 'asc' },
      ],
    });
    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_evidences',
      executionTime: evidencesTimer.elapsed(),
      rowsReturned: evidences.length,
      query: 'findMany',
      params: [{ test_group_id: groupId, tid: tid, is_deleted: false }],
    });

    // test_case_noごとにエビデンスをグループ化
    const evidencesByKey: Record<string, unknown[]> = {};
    evidences.forEach((evidence: unknown) => {
      const e = evidence as Record<string, unknown>;
      const key = e.test_case_no as string | number;
      if (!evidencesByKey[key]) {
        evidencesByKey[key] = [];
      }
      evidencesByKey[key].push(evidence);
    });

    // test_case_noごとに履歴をグループ化
    const historyByTestCase: Record<string | number, unknown[]> = {};
    history.forEach((h: unknown) => {
      const historyRecord = h as Record<string, unknown>;
      const key = historyRecord.test_case_no as string | number;
      if (!historyByTestCase[key]) {
        historyByTestCase[key] = [];
      }
      historyByTestCase[key].push(historyRecord);
    });

    // 履歴付きのグループ化された結果を構築
    interface ResultWithHistory {
      latestValidResult: Record<string, unknown>;
      allHistory: Record<string, unknown>[];
      historyCounts: number[];
    }

    const groupedResults: Record<string, ResultWithHistory> = {};

    // 現在の結果を処理
    results.forEach((result: unknown) => {
      const r = result as Record<string, unknown>;
      const key = r.test_case_no as string | number;

      if (!groupedResults[key]) {
        // このテストケースのテスト内容を取得
        const testContent = (testContentsMap[key] || {}) as Record<string, unknown>;

        // 利用可能な場合、最新のエビデンスパスを取得
        const latestEvidence = evidencesByKey[key] && evidencesByKey[key].length > 0
          ? (evidencesByKey[key][0] as Record<string, unknown>)
          : null;

        const evidencePath = latestEvidence
          ? latestEvidence.evidence_path
          : null;

        // 結果にエビデンスパスとテスト内容を追加
        const resultWithDetails = {
          ...r,
          test_case: testContent.test_case || null,
          expected_value: testContent.expected_value || null,
          evidence: evidencePath,
        };

        // このテストケースの履歴を取得（ある場合）
        const testCaseHistory = (historyByTestCase[key] || []) as Record<string, unknown>[];

        // 履歴レコードにテスト内容とエビデンスパスを追加
        const historyWithDetails = testCaseHistory.map((h) => {
          const historyCount = (h as Record<string, unknown>).history_count as number;
          // 履歴アイテムに対して、このhistory_countに一致するエビデンスを探す
          const historyEvidence = evidencesByKey[key]
            ? evidencesByKey[key].find(
              (e) => ((e as Record<string, unknown>).history_count as number) === historyCount
            )
            : null;

          const historyEvidencePath = historyEvidence
            ? (historyEvidence as Record<string, unknown>).evidence_path
            : null;

          return {
            ...h,
            test_case: testContent.test_case || null,
            expected_value: testContent.expected_value || null,
            evidence: historyEvidencePath,
          };
        });

        // 最新データへのマージ
        let latestValidResult: Record<string, unknown> = resultWithDetails;

        // 現在の結果が"再実施対象外"の場合、履歴から有効な結果を探す
        const currentJudgment = (r.judgment as string) || '';
        if (currentJudgment === '再実施対象外' && historyWithDetails.length > 0) {
          for (let i = 0; i < historyWithDetails.length; i++) {
            const histResult = historyWithDetails[i] as Record<string, unknown>;
            const histJudgment = (histResult.judgment as string) || '';
            if (histJudgment !== '再実施対象外') {
              latestValidResult = histResult;
              break;
            }
          }
          // すべての履歴が"再実施対象外"の場合、現在の結果を保持（これも"再実施対象外"）
        }

        // 履歴をhistory_countの昇順でソート（表示順序のために最も古いものを最初に、最新のものを最後に）
        const sortedHistory = [...historyWithDetails].sort((a, b) => {
          const countA = (a as Record<string, unknown>).history_count as number;
          const countB = (b as Record<string, unknown>).history_count as number;
          return countA - countB;
        });

        const historyCounts = sortedHistory.map((h) => (h as Record<string, unknown>).history_count as number);

        groupedResults[key] = {
          latestValidResult,
          allHistory: sortedHistory,
          historyCounts,
        };
      }
    });

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}/results`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: Object.keys(groupedResults).length,
    });

    return NextResponse.json({ success: true, results: groupedResults });
  } catch (error) {
    return handleError(
      new Error(ERROR_MESSAGES.GET_FALED),
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}/cases/${tid}/results`,
    );
  }
}