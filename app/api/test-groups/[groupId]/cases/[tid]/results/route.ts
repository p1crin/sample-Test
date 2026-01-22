import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint, logDatabaseQuery } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { JUDGMENT_OPTIONS } from '@/constants/constants';

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

        // このテストケースの履歴を取得（ある場合）
        const testCaseHistory = (historyByTestCase[key] || []) as Record<string, unknown>[];

        // 結果履歴テーブルから最大のhistory_countを取得し、それに紐づくエビデンスを取得
        let currentEvidences: unknown[] = [];
        if (testCaseHistory.length > 0) {
          // 結果履歴テーブルから最大のhistory_countを見つける
          const maxHistoryCount = Math.max(
            ...testCaseHistory.map((h) => (h as Record<string, unknown>).history_count as number)
          );
          // その最大のhistory_countに紐づくエビデンスを取得
          currentEvidences = evidencesByKey[key]
            ? evidencesByKey[key].filter(
                (e) => ((e as Record<string, unknown>).history_count as number) === maxHistoryCount
              )
            : [];
        }

        const evidencePaths = currentEvidences.map(e =>
          (e as Record<string, unknown>).evidence_path as string
        );

        // 結果にエビデンスパスとテスト内容を追加
        const resultWithDetails = {
          ...r,
          test_case: testContent.test_case || null,
          expected_value: testContent.expected_value || null,
          is_target: testContent.is_target,
          evidence: evidencePaths,
        };

        // 履歴レコードにテスト内容とエビデンスパスを追加
        const historyWithDetails = testCaseHistory.map((h) => {
          const historyCount = (h as Record<string, unknown>).history_count as number;
          // 履歴アイテムに対して、このhistory_countに一致するエビデンスを全て取得
          const historyEvidences = evidencesByKey[key]
            ? evidencesByKey[key].filter(
              (e) => ((e as Record<string, unknown>).history_count as number) === historyCount
            )
            : [];

          const historyEvidencePaths = historyEvidences.map(e =>
            (e as Record<string, unknown>).evidence_path as string
          );

          return {
            ...h,
            test_case: testContent.test_case || null,
            expected_value: testContent.expected_value || null,
            is_target: testContent.is_target,
            evidence: historyEvidencePaths,
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
          latestValidResult: {
            test_case_no: latestValidResult.test_case_no,
            test_case: testContent.test_case || null,
            expected_value: testContent.expected_value || null,
            is_target: testContent.is_target,
            result: latestValidResult.result || null,
            judgment: latestValidResult.judgment || null,
            software_version: latestValidResult.software_version || null,
            hardware_version: latestValidResult.hardware_version || null,
            comparator_version: latestValidResult.comparator_version || null,
            execution_date: latestValidResult.execution_date || null,
            executor: latestValidResult.executor || null,
            note: latestValidResult.note || null,
            evidence: evidencePaths, // 常に最新のエビデンス（history_count === 0）を使用
          },
          allHistory: sortedHistory,
          historyCounts,
        };
      }
    });

    // test_contentにデータがあり、他のテーブルにデータがない場合の処理
    testContents.forEach((content: unknown) => {
      const c = content as Record<string, unknown>;
      const key = c.test_case_no as string | number;
      if (!groupedResults[key]) {
        groupedResults[key] = {
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
      let fileCount = 0;
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

          // TODO:エビデンステーブルにレコードを追加
          // let fileNumber = 0;
          // for (const file of result.evidence) {
          //   await tx.tt_test_evidences.create({
          //     data: {
          //       test_group_id: groupId,
          //       tid: tid,
          //       test_case_no: testCaseNo,
          //       history_count: newHistoryCount,
          //       evidence_no: fileNumber,
          //       evidence_name: file,
          //       evidence_path: `/uploads/test-cases/${groupId}/${tid}/${file}`
          //     }
          //   });
          //   fileNumber++;
          //   fileCount++;
          // }
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

        // historyDataListの処理
        if (historyDataList) {
          fileCount = 0;
          for (const historyList of historyDataList) {
            for (const history of historyList.testResult) {
              let fileNo = 0;
              const { historyCount, test_case_no, ...rest } = history;
              // 履歴テーブルの更新
              await tx.tt_test_results_history.updateMany({
                where: {
                  test_group_id: groupId,
                  tid: tid,
                  test_case_no: test_case_no,
                  history_count: historyCount,
                },
                data: {
                  result: rest.result,
                  judgment: rest.judgment,
                  software_version: rest.softwareVersion,
                  hardware_version: rest.hardwareVersion,
                  comparator_version: rest.comparatorVersion,
                  execution_date: rest.executionDate ? new Date(rest.executionDate) : null,
                  executor: rest.executor,
                  updated_at: new Date(),
                },
              });
              // for (const file of rest.evidence) {
              //   // エビデンステーブルの更新
              //   await tx.tt_test_evidences.updateMany({
              //     where: {
              //       test_group_id: groupId,
              //       tid: tid,
              //       test_case_no: test_case_no,
              //       history_count: historyCount,
              //       evidence_no: fileNo,
              //     },
              //     data: {

              //     }
              //   });
              // }
            }
          }
        }
        logDatabaseQuery({
          operation: 'UPDATE',
          table: 'tt_test_results_history',
          rowsAffected: 1,
          query: 'update',
          params: [
            {
              testGroup: groupId,
              tid: tid,
            }
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