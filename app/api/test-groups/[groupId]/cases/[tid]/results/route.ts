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

    // test_case_noごとに結果をマップ化
    const resultsMap: Record<string | number, unknown> = {};
    results.forEach((result: unknown) => {
      const r = result as Record<string, unknown>;
      const key = r.test_case_no as string | number;
      resultsMap[key] = r;
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

    // tt_test_contentsを基準にループ（未実施のテストケースも含める）
    testContents.forEach((content: unknown) => {
      const testContent = content as Record<string, unknown>;
      const testCaseNo = testContent.test_case_no as string | number;

      // このtest_case_noの現在の結果を取得
      const currentResult = resultsMap[testCaseNo] as Record<string, unknown> | undefined;

      // このテストケースの履歴を取得
      const testCaseHistory = (historyByTestCase[testCaseNo] || []) as Record<string, unknown>[];

      // 利用可能な場合、最新のエビデンスパスを取得
      const latestEvidence = evidencesByKey[testCaseNo] && evidencesByKey[testCaseNo].length > 0
        ? (evidencesByKey[testCaseNo][0] as Record<string, unknown>)
        : null;

      const evidencePath = latestEvidence
        ? latestEvidence.evidence_path
        : null;

      // 履歴レコードにテスト内容とエビデンスパスを追加
      const historyWithDetails = testCaseHistory.map((h) => {
        const historyCount = (h as Record<string, unknown>).history_count as number;
        // 履歴アイテムに対して、このhistory_countに一致するエビデンスを探す
        const historyEvidence = evidencesByKey[testCaseNo]
          ? evidencesByKey[testCaseNo].find(
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
          is_target: testContent.is_target,
          evidence: historyEvidencePath,
        };
      });

      let latestValidResult: Record<string, unknown>;

      if (!currentResult) {
        // 未実施の場合：tt_test_resultsにレコードがない
        latestValidResult = {
          test_case_no: testCaseNo,
          test_case: testContent.test_case || null,
          expected_value: testContent.expected_value || null,
          is_target: testContent.is_target,
          result: null,
          judgment: '未実施',
          software_version: null,
          hardware_version: null,
          comparator_version: null,
          execution_date: null,
          executor: null,
          note: null,
          evidence: null,
        };
      } else {
        // 結果がある場合
        const resultWithDetails = {
          ...currentResult,
          test_case: testContent.test_case || null,
          expected_value: testContent.expected_value || null,
          is_target: testContent.is_target,
          evidence: evidencePath,
        };

        // 現在の結果が"再実施対象外"の場合、履歴から有効な結果を探す
        const currentJudgment = (currentResult.judgment as string) || '';
        if (currentJudgment === '再実施対象外' && historyWithDetails.length > 0) {
          latestValidResult = resultWithDetails;
          for (let i = 0; i < historyWithDetails.length; i++) {
            const histResult = historyWithDetails[i] as Record<string, unknown>;
            const histJudgment = (histResult.judgment as string) || '';
            if (histJudgment !== '再実施対象外') {
              latestValidResult = histResult;
              break;
            }
          }
          // すべての履歴が"再実施対象外"の場合、現在の結果を保持（これも"再実施対象外"）
        } else {
          latestValidResult = resultWithDetails;
        }
      }

      // 履歴をhistory_countの昇順でソート
      const sortedHistory = [...historyWithDetails].sort((a, b) => {
        const countA = (a as Record<string, unknown>).history_count as number;
        const countB = (b as Record<string, unknown>).history_count as number;
        return countA - countB;
      });

      const historyCounts = sortedHistory.map((h) => (h as Record<string, unknown>).history_count as number);

      groupedResults[testCaseNo] = {
        latestValidResult,
        allHistory: sortedHistory,
        historyCounts,
      };
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

// POST /api/test-groups/[groupId]/cases/[tid]/results - テスト結果を登録・更新
export async function POST(
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
        'POST',
        `/api/test-groups/${groupId}/cases/${tid}/results`,
      );
    }

    // 権限をチェック
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'POST',
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
        'POST',
        `/api/test-groups/${groupId}/cases/${tid}/results`,
      );
    }

    // リクエストボディを取得
    const body = await req.json();
    const { testResults, deletedEvidences } = body;

    if (!Array.isArray(testResults)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${groupId}/cases/${tid}/results`,
      );
    }

    // トランザクション内で処理
    await prisma.$transaction(async (tx) => {
      // 削除対象のエビデンスを処理
      if (Array.isArray(deletedEvidences) && deletedEvidences.length > 0) {
        for (const evidence of deletedEvidences) {
          await tx.tt_test_evidences.updateMany({
            where: {
              test_group_id: groupId,
              tid: tid,
              test_case_no: evidence.testCaseNo,
              history_count: evidence.historyCount,
              evidence_no: evidence.evidenceNo,
            },
            data: {
              is_deleted: true,
              updated_at: new Date(),
              updated_by: user.id,
            },
          });
        }
      }

      // 各テストケースの結果を処理
      for (const result of testResults) {
        const testCaseNo = result.testCaseNo;

        // 判定が空または"未実施"の場合はスキップ
        if (!result.judgment || result.judgment === '未実施') {
          continue;
        }

        // 最大history_countを取得
        const maxHistory = await tx.tt_test_results_history.findFirst({
          where: {
            test_group_id: groupId,
            tid: tid,
            test_case_no: testCaseNo,
          },
          orderBy: {
            history_count: 'desc',
          },
        });

        const newHistoryCount = (maxHistory?.history_count ?? 0) + 1;

        // 実行日付の変換
        const executionDate = result.executionDate
          ? new Date(result.executionDate)
          : null;

        // 履歴テーブルに新しいレコードを作成
        await tx.tt_test_results_history.create({
          data: {
            test_group_id: groupId,
            tid: tid,
            test_case_no: testCaseNo,
            history_count: newHistoryCount,
            result: result.result || null,
            judgment: result.judgment,
            software_version: result.softwareVersion || null,
            hardware_version: result.hardwareVersion || null,
            comparator_version: result.comparatorVersion || null,
            execution_date: executionDate,
            executor: result.executor || null,
            note: result.note || null,
            version: 1, // デフォルト値
            created_at: new Date(),
            created_by: user.id,
            updated_at: new Date(),
            updated_by: user.id,
          },
        });

        // 現在の結果テーブルをupsert
        await tx.tt_test_results.upsert({
          where: {
            test_group_id_tid_test_case_no: {
              test_group_id: groupId,
              tid: tid,
              test_case_no: testCaseNo,
            },
          },
          create: {
            test_group_id: groupId,
            tid: tid,
            test_case_no: testCaseNo,
            result: result.result || null,
            judgment: result.judgment,
            software_version: result.softwareVersion || null,
            hardware_version: result.hardwareVersion || null,
            comparator_version: result.comparatorVersion || null,
            execution_date: executionDate,
            executor: result.executor || null,
            note: result.note || null,
            version: 1,
            created_at: new Date(),
            created_by: user.id,
            updated_at: new Date(),
            updated_by: user.id,
          },
          update: {
            result: result.result || null,
            judgment: result.judgment,
            software_version: result.softwareVersion || null,
            hardware_version: result.hardwareVersion || null,
            comparator_version: result.comparatorVersion || null,
            execution_date: executionDate,
            executor: result.executor || null,
            note: result.note || null,
            updated_at: new Date(),
            updated_by: user.id,
          },
        });

        // エビデンスのhistory_countを更新
        if (result.evidenceIds && Array.isArray(result.evidenceIds)) {
          for (const evidenceId of result.evidenceIds) {
            await tx.tt_test_evidences.updateMany({
              where: {
                id: evidenceId,
                test_group_id: groupId,
                tid: tid,
                test_case_no: testCaseNo,
              },
              data: {
                history_count: newHistoryCount,
                updated_at: new Date(),
                updated_by: user.id,
              },
            });
          }
        }
      }
    });

    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}/results`,
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: testResults.length,
    });

    return NextResponse.json(
      { success: true, message: 'Test results saved successfully' },
      { status: STATUS_CODES.CREATED }
    );
  } catch (error) {
    console.error('Error saving test results:', error);
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      `/api/test-groups/${groupId}/cases/${tid}/results`,
    );
  }
}