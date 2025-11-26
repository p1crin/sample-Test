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

    // Get test results grouped by test_case_no
    const resultsResult = await query(
      `SELECT *
       FROM tt_test_results
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no, version DESC`,
      [groupId, tid]
    );

    const results = getAllRows(resultsResult);

    // Get test contents for all test_case_no
    const testContentsResult = await query(
      `SELECT test_case_no, test_item, expected_value
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

    // Get evidences for all test_case_no
    const evidencesResult = await query(
      `SELECT *
       FROM tt_test_evidences
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no, history_count, evidence_no`,
      [groupId, tid]
    );

    const evidences = getAllRows(evidencesResult);

    // Group evidences by test_case_no and history_count
    const evidencesByKey = evidences.reduce((acc: Record<string, unknown[]>, evidence: unknown) => {
      const e = evidence as Record<string, unknown>;
      const key = `${e.test_case_no}_${e.history_count}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      (acc[key] as unknown[]).push(evidence);
      return acc;
    }, {});

    // Group by test_case_no
    const groupedResults = results.reduce((acc: Record<string, unknown[]>, result: unknown) => {
      const r = result as Record<string, unknown>;
      const key = r.test_case_no as string | number;
      if (!acc[key]) {
        acc[key] = [];
      }

      // Get test content for this test case
      const testContent = (testContentsMap[r.test_case_no as string | number] || {}) as Record<string, unknown>;

      // Add evidences and test content to result
      const evidenceKey = `${r.test_case_no}_1`; // Use history_count 1 for latest
      const resultWithDetails = {
        ...r,
        test_item: testContent.test_item || null,
        expected_value: testContent.expected_value || null,
        evidences: evidencesByKey[evidenceKey] || [],
      };

      (acc[key] as unknown[]).push(resultWithDetails);
      return acc;
    }, {});

    return NextResponse.json({ results: groupedResults });
  } catch (error) {
    console.error('GET /api/test-groups/[groupId]/cases/[tid]/results error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テスト結果の取得に失敗しました' },
      { status: 500 }
    );
  }
}
