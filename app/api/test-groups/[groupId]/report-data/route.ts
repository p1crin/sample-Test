import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { query, getAllRows } from '@/app/lib/db';

// GET /api/test-groups/[groupId]/report-data - Get report data
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
    }

    // Get test group info
    const groupResult = await query(
      `SELECT * FROM tt_test_groups WHERE id = $1 AND is_deleted = FALSE`,
      [groupId]
    );

    if (groupResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'テストグループが見つかりません' },
        { status: 404 }
      );
    }

    const testGroup = groupResult.rows[0];

    // Get all test cases
    const casesResult = await query(
      `SELECT * FROM tt_test_cases
       WHERE test_group_id = $1 AND is_deleted = FALSE
       ORDER BY tid`,
      [groupId]
    );
    const testCases = getAllRows(casesResult);

    // Get all test contents
    const contentsResult = await query(
      `SELECT * FROM tt_test_contents
       WHERE test_group_id = $1 AND is_deleted = FALSE
       ORDER BY tid, test_case_no`,
      [groupId]
    );
    const testContents = getAllRows(contentsResult);

    // Get all latest test results
    const resultsResult = await query(
      `SELECT DISTINCT ON (test_group_id, tid, test_case_no) *
       FROM tt_test_results
       WHERE test_group_id = $1 AND is_deleted = FALSE
       ORDER BY test_group_id, tid, test_case_no, version DESC`,
      [groupId]
    );
    const testResults = getAllRows(resultsResult);

    // Calculate statistics
    const totalTestContents = testContents.length;
    const testedCount = testResults.length;
    const untestedCount = totalTestContents - testedCount;

    const okCount = testResults.filter((r: unknown) => (r as Record<string, unknown>).judgment === 'OK').length;
    const ngCount = testResults.filter((r: unknown) => (r as Record<string, unknown>).judgment === 'NG').length;
    const notApplicableCount = testResults.filter((r: unknown) => (r as Record<string, unknown>).judgment === '再実施対象外').length;

    const passRate = totalTestContents > 0
      ? Math.round((okCount / totalTestContents) * 100 * 10) / 10
      : 0;

    const progress = totalTestContents > 0
      ? Math.round((testedCount / totalTestContents) * 100 * 10) / 10
      : 0;

    // Build report data
    const reportData = {
      testGroup,
      statistics: {
        totalTestCases: testCases.length,
        totalTestContents,
        testedCount,
        untestedCount,
        okCount,
        ngCount,
        notApplicableCount,
        passRate,
        progress,
      },
      testCases: testCases.map((tc: unknown) => {
        const tc_typed = tc as Record<string, unknown>;
        const contents = testContents.filter((content: unknown) => (content as Record<string, unknown>).tid === tc_typed.tid);
        const results = testResults.filter((result: unknown) => (result as Record<string, unknown>).tid === tc_typed.tid);

        return {
          ...tc_typed,
          contents,
          results,
        };
      }),
    };

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('GET /api/test-groups/[groupId]/report-data error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'レポートデータの取得に失敗しました' },
      { status: 500 }
    );
  }
}
