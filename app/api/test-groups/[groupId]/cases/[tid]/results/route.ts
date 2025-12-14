import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { query, getAllRows } from '@/app/lib/db';

// GET /api/test-groups/[groupId]/cases/[tid]/results - Get test results list
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

    // Get test results from current results table
    const resultsResult = await query(
      `SELECT *
       FROM tt_test_results
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no, version DESC`,
      [groupId, tid]
    );

    const results = getAllRows(resultsResult);

    // Get test results history
    const historyResult = await query(
      `SELECT *
       FROM tt_test_results_history
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no, history_count DESC`,
      [groupId, tid]
    );

    const history = getAllRows(historyResult);

    // Get test contents for all test_case_no
    const testContentsResult = await query(
      `SELECT test_case_no, test_case, expected_value
       FROM tt_test_contents
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no`,
      [groupId, tid]
    );

    const testContents = getAllRows(testContentsResult);

    // Create a map of test contents by test_case_no
    const testContentsMap = testContents.reduce((acc: Record<string, unknown>, content: unknown) => {
      const c = content as Record<string, unknown>;
      const key = c.test_case_no as string | number;
      acc[key] = c;
      return acc;
    }, {});

    // Get evidences for all test_case_no and history_counts
    const evidencesResult = await query(
      `SELECT *
       FROM tt_test_evidences
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no, history_count DESC, evidence_no ASC`,
      [groupId, tid]
    );

    const evidences = getAllRows(evidencesResult);

    // Group evidences by test_case_no
    const evidencesByKey: Record<string, unknown[]> = {};
    evidences.forEach((evidence: unknown) => {
      const e = evidence as Record<string, unknown>;
      const key = e.test_case_no as string | number;
      if (!evidencesByKey[key]) {
        evidencesByKey[key] = [];
      }
      evidencesByKey[key].push(evidence);
    });

    // Group history by test_case_no
    const historyByTestCase: Record<string | number, unknown[]> = {};
    history.forEach((h: unknown) => {
      const historyRecord = h as Record<string, unknown>;
      const key = historyRecord.test_case_no as string | number;
      if (!historyByTestCase[key]) {
        historyByTestCase[key] = [];
      }
      historyByTestCase[key].push(historyRecord);
    });

    // Build grouped results with history
    interface ResultWithHistory {
      latestValidResult: Record<string, unknown>;
      allHistory: Record<string, unknown>[];
      historyCounts: number[];
    }

    const groupedResults: Record<string, ResultWithHistory> = {};

    // Process current results
    results.forEach((result: unknown) => {
      const r = result as Record<string, unknown>;
      const key = r.test_case_no as string | number;

      if (!groupedResults[key]) {
        // Get test content for this test case
        const testContent = (testContentsMap[key] || {}) as Record<string, unknown>;

        // Get the latest evidence download URL if available
        const latestEvidence = evidencesByKey[key] && evidencesByKey[key].length > 0
          ? (evidencesByKey[key][0] as Record<string, unknown>)
          : null;

        const evidenceDownloadUrl = latestEvidence
          ? `/api/test-groups/${groupId}/cases/${tid}/evidences/${latestEvidence.test_case_no}/${latestEvidence.history_count}/${latestEvidence.evidence_no}?name=${encodeURIComponent(String(latestEvidence.evidence_name || 'evidence'))}`
          : null;

        // Add evidences and test content to result
        const resultWithDetails = {
          ...r,
          test_case: testContent.test_case || null,
          expected_value: testContent.expected_value || null,
          evidence: evidenceDownloadUrl,
        };

        // Get history for this test case (if any)
        const testCaseHistory = (historyByTestCase[key] || []) as Record<string, unknown>[];

        // Add test content and evidences to history records
        const historyWithDetails = testCaseHistory.map((h) => {
          const historyCount = (h as Record<string, unknown>).history_count as number;
          // For history items, look for evidence matching this history_count
          const historyEvidence = evidencesByKey[key]
            ? evidencesByKey[key].find(
                (e) => ((e as Record<string, unknown>).history_count as number) === historyCount
              )
            : null;

          const historyEvidenceDownloadUrl = historyEvidence
            ? `/api/test-groups/${groupId}/cases/${tid}/evidences/${(historyEvidence as Record<string, unknown>).test_case_no}/${(historyEvidence as Record<string, unknown>).history_count}/${(historyEvidence as Record<string, unknown>).evidence_no}?name=${encodeURIComponent(String((historyEvidence as Record<string, unknown>).evidence_name || 'evidence'))}`
            : null;

          return {
            ...h,
            test_case: testContent.test_case || null,
            expected_value: testContent.expected_value || null,
            evidence: historyEvidenceDownloadUrl,
          };
        });

        // Determine latest valid result (handling "再実施対象外" fallback)
        let latestValidResult: Record<string, unknown> = resultWithDetails;

        // If current result is "再実施対象外", try to find a valid result from history
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
          // If all history is "再実施対象外", keep the current result (which is also "再実施対象外")
        }

        // Sort history by history_count ascending (oldest first, newest last for display order)
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

    return NextResponse.json({ success: true, results: groupedResults });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('GET /api/test-groups/[groupId]/cases/[tid]/results error:', errorMessage);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'テスト結果の取得に失敗しました', details: errorMessage },
      { status: 500 }
    );
  }
}
