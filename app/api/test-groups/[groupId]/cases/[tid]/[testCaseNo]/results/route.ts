import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasTestRole } from '@/app/lib/auth';
import { transaction } from '@/app/lib/db';
import { TestRole } from '@/app/types/database';

// POST /api/test-groups/[groupId]/cases/[tid]/[testCaseNo]/results - Register test result
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string; testCaseNo: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid, testCaseNo: testCaseNoParam } = await params;
    const groupId = parseInt(groupIdParam, 10);
    const testCaseNo = parseInt(testCaseNoParam, 10);

    // Check permission (Executor or Designer role required)
    const isExecutor = await hasTestRole(user.id, groupId, TestRole.EXECUTOR);
    const isDesigner = await hasTestRole(user.id, groupId, TestRole.DESIGNER);

    if (!isExecutor && !isDesigner && user.user_role !== 0) {
      return NextResponse.json(
        { error: 'テスト結果を登録する権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      result,
      judgment,
      software_version,
      hardware_version,
      comparator_version,
      execution_date,
      executor,
      note,
      evidence_urls,
    } = body;

    let newVersion = 1;

    await transaction(async (client) => {
      // Check if result already exists for this test case
      const existingResult = await client.query(
        `SELECT version FROM tt_test_results
         WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3`,
        [groupId, tid, testCaseNo]
      );

      if (existingResult.rows.length > 0) {
        // Update existing result and increment version
        newVersion = (existingResult.rows[0].version || 0) + 1;

        await client.query(
          `UPDATE tt_test_results
           SET result = $1, judgment = $2, software_version = $3, hardware_version = $4,
               comparator_version = $5, execution_date = $6, executor = $7, note = $8,
               version = $9, updated_at = CURRENT_TIMESTAMP
           WHERE test_group_id = $10 AND tid = $11 AND test_case_no = $12`,
          [
            result || null,
            judgment || null,
            software_version || null,
            hardware_version || null,
            comparator_version || null,
            execution_date || null,
            executor || null,
            note || null,
            newVersion,
            groupId,
            tid,
            testCaseNo,
          ]
        );
      } else {
        // Insert new test result
        await client.query(
          `INSERT INTO tt_test_results
           (test_group_id, tid, test_case_no, result, judgment, software_version,
            hardware_version, comparator_version, execution_date, executor, note, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            groupId,
            tid,
            testCaseNo,
            result || null,
            judgment || null,
            software_version || null,
            hardware_version || null,
            comparator_version || null,
            execution_date || null,
            executor || null,
            note || null,
            newVersion,
          ]
        );
      }

      // Save evidence files if provided
      if (evidence_urls && Array.isArray(evidence_urls) && evidence_urls.length > 0) {
        // Get next history count
        const historyResult = await client.query(
          `SELECT MAX(history_count) as max_count FROM tt_test_results_history
           WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3`,
          [groupId, tid, testCaseNo]
        );

        const historyCount = (historyResult.rows[0]?.max_count || 0) + 1;

        // First, insert into history table
        await client.query(
          `INSERT INTO tt_test_results_history
           (test_group_id, tid, test_case_no, history_count, result, judgment,
            software_version, hardware_version, comparator_version, execution_date,
            executor, note, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            groupId,
            tid,
            testCaseNo,
            historyCount,
            result || null,
            judgment || null,
            software_version || null,
            hardware_version || null,
            comparator_version || null,
            execution_date || null,
            executor || null,
            note || null,
            newVersion,
          ]
        );

        // Then insert evidence files
        for (let i = 0; i < evidence_urls.length; i++) {
          const evidenceUrl = evidence_urls[i];
          const fileName = evidenceUrl.split('/').pop() || `evidence_${i + 1}`;

          await client.query(
            `INSERT INTO tt_test_evidences
             (test_group_id, tid, test_case_no, history_count, evidence_no, evidence_name, evidence_path)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [groupId, tid, testCaseNo, historyCount, i + 1, fileName, evidenceUrl]
          );
        }
      }
    });

    return NextResponse.json({
      message: 'テスト結果を登録しました',
      version: newVersion,
    });
  } catch (error) {
    console.error('POST /api/test-groups/[groupId]/cases/[tid]/[testCaseNo]/results error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テスト結果の登録に失敗しました' },
      { status: 500 }
    );
  }
}
