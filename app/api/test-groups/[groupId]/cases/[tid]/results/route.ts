import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint, logDatabaseQuery } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { JUDGMENT_OPTIONS } from '@/constants/constants';

// エビデンス詳細情報の型
type EvidenceDetail = {
  path: string;
  fileNo: number;
  name: string;
};

// テスト内容の型
type TestContent = {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  test_case: string | null;
  expected_value: string | null;
  is_target: boolean;
};

// テストエビデンスの型
type TestEvidence = {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  history_count: number;
  evidence_no: number;
  evidence_name: string | null;
  evidence_path: string | null;
};

// テスト結果の型
type TestResult = {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  result: string | null;
  judgment: string | null;
  software_version: string | null;
  hardware_version: string | null;
  comparator_version: string | null;
  execution_date: Date | null;
  executor: string | null;
  note: string | null;
};

// テスト結果履歴の型
type TestResultHistory = TestResult & {
  history_count: number;
};

// 履歴レコードの拡張型
type HistoryWithDetails = TestResultHistory & {
  test_case: string | null;
  expected_value: string | null;
  is_target: boolean;
  evidence: EvidenceDetail[];
};

// グループ化された結果の型
type GroupedResult = {
  latestValidResult: {
    test_case_no: number;
    test_case: string | null;
    expected_value: string | null;
    is_target: boolean;
    result: string | null;
    judgment: string | null;
    software_version: string | null;
    hardware_version: string | null;
    comparator_version: string | null;
    execution_date: Date | null;
    executor: string | null;
    note: string | null;
    evidence: EvidenceDetail[];
  };
  allHistory: HistoryWithDetails[];
  historyCounts: number[];
};

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
        `api/test-groups/${groupId}/cases/${tid}/results`,
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
    const testContentsMap: Record<number, TestContent> = {};
    for (const content of testContents) {
      testContentsMap[content.test_case_no] = content as TestContent;
    }

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
    const evidencesByKey: Record<number, TestEvidence[]> = {};
    for (const evidence of evidences) {
      const e = evidence as TestEvidence;
      if (!evidencesByKey[e.test_case_no]) {
        evidencesByKey[e.test_case_no] = [];
      }
      evidencesByKey[e.test_case_no].push(e);
    }

    // test_case_noごとに履歴をグループ化
    const historyByTestCase: Record<number, TestResultHistory[]> = {};
    for (const h of history) {
      const historyRecord = h as TestResultHistory;
      if (!historyByTestCase[historyRecord.test_case_no]) {
        historyByTestCase[historyRecord.test_case_no] = [];
      }
      historyByTestCase[historyRecord.test_case_no].push(historyRecord);
    }

    // 履歴付きのグループ化された結果を構築
    const groupedResults: Record<number, GroupedResult> = {};

    // 現在の結果を処理
    for (const result of results) {
      const r = result as TestResult;
      const key = r.test_case_no;

      if (!groupedResults[key]) {
        // このテストケースのテスト内容を取得
        const testContent = testContentsMap[key] || { test_case: null, expected_value: null, is_target: true };

        // このテストケースの履歴を取得（ある場合）
        const testCaseHistory = historyByTestCase[key] || [];

        // 結果履歴テーブルから最大のhistory_countを取得し、それに紐づくエビデンスを取得
        let currentEvidences: TestEvidence[] = [];
        if (testCaseHistory.length > 0) {
          // 結果履歴テーブルから最大のhistory_countを見つける
          const maxHistoryCount = Math.max(
            ...testCaseHistory.map((h) => h.history_count)
          );
          // その最大のhistory_countに紐づくエビデンスを取得
          currentEvidences = evidencesByKey[key]
            ? evidencesByKey[key].filter((e) => e.history_count === maxHistoryCount)
            : [];
        }

        const evidenceDetails: EvidenceDetail[] = currentEvidences.map(e => ({
          path: e.evidence_path || '',
          fileNo: e.evidence_no,
          name: e.evidence_name || '',
        }));

        // 履歴レコードにテスト内容とエビデンスパスを追加
        const historyWithDetails: HistoryWithDetails[] = testCaseHistory.map((h) => {
          // 履歴アイテムに対して、このhistory_countに一致するエビデンスを全て取得
          const historyEvidences = evidencesByKey[key]
            ? evidencesByKey[key].filter((e) => e.history_count === h.history_count)
            : [];

          const historyEvidenceDetails: EvidenceDetail[] = historyEvidences.map(e => ({
            path: e.evidence_path || '',
            fileNo: e.evidence_no,
            name: e.evidence_name || '',
          }));

          return {
            ...h,
            test_case: testContent.test_case || null,
            expected_value: testContent.expected_value || null,
            is_target: testContent.is_target,
            evidence: historyEvidenceDetails,
          };
        });

        // 最新データへのマージ
        type LatestResult = {
          test_case_no: number;
          result: string | null;
          judgment: string | null;
          software_version: string | null;
          hardware_version: string | null;
          comparator_version: string | null;
          execution_date: Date | null;
          executor: string | null;
          note: string | null;
          evidence: EvidenceDetail[];
        };

        let latestValidResult: LatestResult = {
          test_case_no: r.test_case_no,
          result: r.result,
          judgment: r.judgment,
          software_version: r.software_version,
          hardware_version: r.hardware_version,
          comparator_version: r.comparator_version,
          execution_date: r.execution_date,
          executor: r.executor,
          note: r.note,
          evidence: evidenceDetails,
        };

        // 現在の結果が"再実施対象外"の場合、履歴から有効な結果を探す
        const currentJudgment = r.judgment || '';
        if (currentJudgment === '再実施対象外' && historyWithDetails.length > 0) {
          for (const histResult of historyWithDetails) {
            const histJudgment = histResult.judgment || '';
            if (histJudgment !== '再実施対象外') {
              latestValidResult = {
                test_case_no: histResult.test_case_no,
                result: histResult.result,
                judgment: histResult.judgment,
                software_version: histResult.software_version,
                hardware_version: histResult.hardware_version,
                comparator_version: histResult.comparator_version,
                execution_date: histResult.execution_date,
                executor: histResult.executor,
                note: histResult.note,
                evidence: histResult.evidence,
              };
              break;
            }
          }
          // すべての履歴が"再実施対象外"の場合、現在の結果を保持（これも"再実施対象外"）
        }

        // 履歴をhistory_countの昇順でソート（表示順序のために最も古いものを最初に、最新のものを最後に）
        const sortedHistory = [...historyWithDetails].sort((a, b) => a.history_count - b.history_count);

        const historyCounts = sortedHistory.map((h) => h.history_count);

        groupedResults[key] = {
          latestValidResult: {
            test_case_no: latestValidResult.test_case_no,
            test_case: testContent.test_case || null,
            expected_value: testContent.expected_value || null,
            is_target: testContent.is_target,
            result: latestValidResult.result,
            judgment: latestValidResult.judgment,
            software_version: latestValidResult.software_version,
            hardware_version: latestValidResult.hardware_version,
            comparator_version: latestValidResult.comparator_version,
            execution_date: latestValidResult.execution_date,
            executor: latestValidResult.executor,
            note: latestValidResult.note,
            evidence: evidenceDetails, // 常に最新のエビデンス詳細情報を使用
          },
          allHistory: sortedHistory,
          historyCounts,
        };
      }
    }

    // test_contentにデータがあり、他のテーブルにデータがない場合の処理
    for (const content of testContents) {
      const c = content as TestContent;
      if (!groupedResults[c.test_case_no]) {
        groupedResults[c.test_case_no] = {
          latestValidResult: {
            test_case_no: c.test_case_no,
            test_case: c.test_case || null,
            expected_value: c.expected_value || null,
            is_target: c.is_target,
            result: null,
            judgment: null,
            software_version: null,
            hardware_version: null,
            comparator_version: null,
            execution_date: null,
            executor: null,
            note: null,
            evidence: [],
          },
          allHistory: [],
          historyCounts: [],
        };
      }
    }

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
      error as Error,
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
    const { newTestResultData, historyDataList } = body;
    if (newTestResultData && !Array.isArray(newTestResultData.testResult)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${groupId}/cases/${tid}/results`,
      );
    }
    if (historyDataList && !Array.isArray(historyDataList)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${groupId}/cases/${tid}/results`,
      );
    }

    // トランザクション内で処理
    const result = await prisma.$transaction(async (tx) => {
      const fileCount = 0;
      // historyDataListの処理
      if (historyDataList) {
        for (const historyList of historyDataList) {
          const historyCountForUpdate = historyList.historyCount;

          for (const history of historyList.testResult) {
            const { test_case_no, ...rest } = history;

            // 履歴テーブルの更新
            await tx.tt_test_results_history.updateMany({
              where: {
                test_group_id: groupId,
                tid: tid,
                test_case_no: test_case_no,
                history_count: historyCountForUpdate,
              },
              data: {
                result: rest.result || null,
                judgment: rest.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
                software_version: rest.softwareVersion || null,
                hardware_version: rest.hardwareVersion || null,
                comparator_version: rest.comparatorVersion || null,
                execution_date: rest.executionDate ? new Date(rest.executionDate) : null,
                executor: rest.executor,
                note: rest.note,
                updated_at: new Date(),
              },
            });
          }
        }
        logDatabaseQuery({
          operation: 'UPDATE',
          table: 'tt_test_results_history',
          rowsAffected: historyDataList.length,
          query: 'update',
          params: [
            {
              testGroup: groupId,
              tid: tid,
            }
          ],
          executionTime: apiTimer.elapsed(),
        });
        // historyCountが最大のものを探す
        const latestHistory = historyDataList.reduce((max: { historyCount: number; }, current: { historyCount: number; }) =>
          current.historyCount > max.historyCount ? current : max
          , { historyCount: 0 }
        );

        if (latestHistory && latestHistory.testResult) {
          for (const resultToUpdate of latestHistory.testResult) {
            const { test_case_no, ...rest } = resultToUpdate;
            const executionDate = rest.executionDate ? new Date(rest.executionDate) : null;

            await tx.tt_test_results.update({
              where: {
                test_group_id_tid_test_case_no: {
                  test_group_id: groupId,
                  tid: tid,
                  test_case_no: test_case_no,
                },
              },
              data: {
                result: rest.result || null,
                judgment: rest.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
                software_version: rest.softwareVersion || null,
                hardware_version: rest.hardwareVersion || null,
                comparator_version: rest.comparatorVersion || null,
                execution_date: executionDate,
                executor: rest.executor,
                note: rest.note,
                updated_at: new Date(),
              },
            });
          }

          logDatabaseQuery({
            operation: 'UPDATE',
            table: 'tt_test_results',
            rowsAffected: latestHistory.testResult.length,
            query: 'update from history',
            params: [
              {
                testGroup: groupId,
                tid: tid,
                historyCount: latestHistory.historyCount,
              }
            ],
            executionTime: apiTimer.elapsed(),
          });
        }
      }

      // newTestResultDataの処理
      if (newTestResultData) {
        for (const result of newTestResultData.testResult) {
          const testCaseNo = result.test_case_no;
          const newHistoryCount = newTestResultData.historyCount;
          // 実行日付の変換
          const executionDate = result.executionDate
            ? new Date(result.executionDate)
            : null;

          // テスト結果テーブルを更新
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
              judgment: result.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
              software_version: result.softwareVersion || null,
              hardware_version: result.hardwareVersion || null,
              comparator_version: result.comparatorVersion || null,
              execution_date: executionDate || null,
              executor: result.executor || null,
              note: result.note,
            },
            update: {
              result: result.result,
              judgment: result.judgment,
              software_version: result.softwareVersion,
              hardware_version: result.hardwareVersion,
              comparator_version: result.comparatorVersion,
              execution_date: executionDate,
              executor: result.executor,
              note: result.note,
            }
          });
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
            },
          });
        }
        logDatabaseQuery({
          operation: 'UPSERT',
          table: 'tt_test_results',
          rowsAffected: newTestResultData.length,
          query: 'update',
          params: [
            {
              testGroup: groupId,
              tid: tid,
            }
          ],
          executionTime: apiTimer.elapsed(),
        });
        logDatabaseQuery({
          operation: 'INSERT',
          table: 'tt_test_results_history',
          rowsAffected: newTestResultData.length,
          query: 'insert',
          params: [
            {
              testGroup: groupId,
              tid: tid,
            }
          ],
          executionTime: apiTimer.elapsed(),
        });
        logDatabaseQuery({
          operation: 'INSERT',
          table: 'tx.tt_test_evidences',
          rowsAffected: fileCount,
          query: 'insert',
          params: [
            {
              testGroup: groupId,
              tid: tid,
            },
          ],
          executionTime: apiTimer.elapsed(),
        });
      }
    });

    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}/results`,
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      { success: true, data: result },
      { status: STATUS_CODES.CREATED }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      `/api/test-groups/${groupId}/cases/${tid}/results`,
    );
  }
}