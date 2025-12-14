import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { query, getAllRows } from '@/app/lib/db';
import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import type { JudgmentOption } from '@/constants/constants';

// GET /api/test-groups/[groupId]/cases/[tid]/conduct-data
// Get test case information with current test results for conducting new tests
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
    }

    // Get test case
    const testCaseResult = await query(
      `SELECT * FROM tt_test_cases
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE`,
      [groupId, tid]
    );

    const testCases = getAllRows(testCaseResult);
    if (testCases.length === 0) {
      return NextResponse.json({ error: 'テストケースが見つかりません' }, { status: 404 });
    }

    // Get test contents (individual test items)
    const testContentsResult = await query(
      `SELECT * FROM tt_test_contents
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no ASC`,
      [groupId, tid]
    );

    const testContents = getAllRows(testContentsResult);

    // Get current test results
    const currentResultsResult = await query(
      `SELECT * FROM tt_test_results
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no ASC`,
      [groupId, tid]
    );

    const currentResults = getAllRows(currentResultsResult);

    // Get test results history
    const historyResult = await query(
      `SELECT * FROM tt_test_results_history
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no ASC, history_count DESC`,
      [groupId, tid]
    );

    const history = getAllRows(historyResult);

    // Build combined data with history grouped
    interface HistoryGroup {
      historyCount: number;
      isLatest: boolean;
      items: TestCaseResultRow[];
    }

    // Group history by history_count
    const historyByCount: Record<number, TestCaseResultRow[]> = {};
    let maxHistoryCount = 0;

    testContents.forEach((content: unknown) => {
      const c = content as Record<string, unknown>;
      const testCaseNo = c.test_case_no as number;

      // Check if this test case should be skipped
      const currentResult = currentResults.find(
        (r) => ((r as Record<string, unknown>).test_case_no as number) === testCaseNo
      ) as Record<string, unknown> | undefined;

      const isSkipped = (currentResult?.judgment as string) === '対象外';

      // Find all history for this test case
      const testCaseHistory = history.filter(
        (h) => ((h as Record<string, unknown>).test_case_no as number) === testCaseNo
      );

      // For each history entry, add it to the appropriate count group
      testCaseHistory.forEach((h: unknown) => {
        const hist = h as Record<string, unknown>;
        const hc = hist.history_count as number;
        maxHistoryCount = Math.max(maxHistoryCount, hc);

        if (!historyByCount[hc]) {
          historyByCount[hc] = [];
        }

        historyByCount[hc].push({
          testCaseNo: testCaseNo,
          testCase: (c.test_case as string) || '',
          expectedValue: (c.expected_value as string) || '',
          result: (hist.result as string) || '',
          judgment: (hist.judgment as string as JudgmentOption) || '',
          softwareVersion: (hist.software_version as string) || '',
          hardwareVersion: (hist.hardware_version as string) || '',
          comparatorVersion: (hist.comparator_version as string) || '',
          executionDate: (hist.execution_date as string) || '',
          executor: (hist.executor as string) || '',
          evidence: null,
          note: (hist.note as string) || '',
        });
      });

      // If current result exists and isn't in history, add it with the current version
      if (currentResult && testCaseHistory.length === 0) {
        const hc = 1; // First execution
        maxHistoryCount = Math.max(maxHistoryCount, hc);

        if (!historyByCount[hc]) {
          historyByCount[hc] = [];
        }

        historyByCount[hc].push({
          testCaseNo: testCaseNo,
          testCase: (c.test_case as string) || '',
          expectedValue: (c.expected_value as string) || '',
          result: (currentResult.result as string) || '',
          judgment: (currentResult.judgment as string as JudgmentOption) || '',
          softwareVersion: (currentResult.software_version as string) || '',
          hardwareVersion: (currentResult.hardware_version as string) || '',
          comparatorVersion: (currentResult.comparator_version as string) || '',
          executionDate: (currentResult.execution_date as string) || '',
          executor: (currentResult.executor as string) || '',
          evidence: null,
          note: (currentResult.note as string) || '',
        });
      }
    });

    // Create history groups sorted by history_count descending
    const historyGroups: HistoryGroup[] = Object.entries(historyByCount)
      .map(([count, items]) => {
        const historyCount = parseInt(count, 10);
        return {
          historyCount,
          isLatest: historyCount === maxHistoryCount,
          items, // Already sorted by database query (ORDER BY test_case_no ASC)
        };
      })
      .sort((a, b) => b.historyCount - a.historyCount);

    return NextResponse.json({
      success: true,
      testCase: testCases[0],
      historyGroups,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('GET /api/test-groups/[groupId]/cases/[tid]/conduct-data error:', errorMessage);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'データ取得に失敗しました', details: errorMessage },
      { status: 500 }
    );
  }
}
