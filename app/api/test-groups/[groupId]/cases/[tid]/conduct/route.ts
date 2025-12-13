import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasTestRole } from '@/app/lib/auth';
import { transaction } from '@/app/lib/db';
import { TestRole } from '@/types';

interface TestResultSubmission {
  testCaseNo: number;
  result: string;
  judgment: string;
  softwareVersion: string;
  hardwareVersion: string;
  comparatorVersion: string;
  executionDate: string;
  executor: string;
  note: string;
  // Action: 'create' (initial), 'update' (modify existing), or 're-execute' (re-run)
  action: 'create' | 'update' | 're-execute';
  // Evidence file paths (local storage paths)
  evidencePaths?: string[];
}

// POST /api/test-groups/[groupId]/cases/[tid]/conduct
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

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
    const results: TestResultSubmission[] = body.results || [];

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'テスト結果が指定されていません' },
        { status: 400 }
      );
    }

    await transaction(async (client) => {
      for (const testResult of results) {
        const {
          testCaseNo,
          result,
          judgment,
          softwareVersion,
          hardwareVersion,
          comparatorVersion,
          executionDate,
          executor,
          note,
          action,
          evidencePaths,
        } = testResult;

        if (action === 'create') {
          // INSERT into tt_test_results (version = 1)
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
              softwareVersion || null,
              hardwareVersion || null,
              comparatorVersion || null,
              executionDate || null,
              executor || null,
              note || null,
              1, // version
            ]
          );

          // INSERT into tt_test_results_history (history_count = 1)
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
              1, // history_count
              result || null,
              judgment || null,
              softwareVersion || null,
              hardwareVersion || null,
              comparatorVersion || null,
              executionDate || null,
              executor || null,
              note || null,
              1, // version
            ]
          );
        } else if (action === 'update') {
          // UPDATE tt_test_results (keep same version)
          const versionResult = await client.query(
            `SELECT version FROM tt_test_results
             WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3`,
            [groupId, tid, testCaseNo]
          );

          const currentVersion = versionResult.rows[0]?.version || 1;

          await client.query(
            `UPDATE tt_test_results
             SET result = $1, judgment = $2, software_version = $3, hardware_version = $4,
                 comparator_version = $5, execution_date = $6, executor = $7, note = $8,
                 updated_at = CURRENT_TIMESTAMP
             WHERE test_group_id = $9 AND tid = $10 AND test_case_no = $11`,
            [
              result || null,
              judgment || null,
              softwareVersion || null,
              hardwareVersion || null,
              comparatorVersion || null,
              executionDate || null,
              executor || null,
              note || null,
              groupId,
              tid,
              testCaseNo,
            ]
          );

          // UPDATE tt_test_results_history (same history_count, same version)
          const historyResult = await client.query(
            `SELECT history_count FROM tt_test_results_history
             WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3
             ORDER BY history_count DESC LIMIT 1`,
            [groupId, tid, testCaseNo]
          );

          if (historyResult.rows.length > 0) {
            const historyCount = historyResult.rows[0].history_count;

            await client.query(
              `UPDATE tt_test_results_history
               SET result = $1, judgment = $2, software_version = $3, hardware_version = $4,
                   comparator_version = $5, execution_date = $6, executor = $7, note = $8,
                   updated_at = CURRENT_TIMESTAMP
               WHERE test_group_id = $9 AND tid = $10 AND test_case_no = $11
               AND history_count = $12`,
              [
                result || null,
                judgment || null,
                softwareVersion || null,
                hardwareVersion || null,
                comparatorVersion || null,
                executionDate || null,
                executor || null,
                note || null,
                groupId,
                tid,
                testCaseNo,
                historyCount,
              ]
            );
          }
        } else if (action === 're-execute') {
          // UPDATE tt_test_results
          const versionResult = await client.query(
            `SELECT version FROM tt_test_results
             WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3`,
            [groupId, tid, testCaseNo]
          );

          const currentVersion = versionResult.rows[0]?.version || 1;

          await client.query(
            `UPDATE tt_test_results
             SET result = $1, judgment = $2, software_version = $3, hardware_version = $4,
                 comparator_version = $5, execution_date = $6, executor = $7, note = $8,
                 updated_at = CURRENT_TIMESTAMP
             WHERE test_group_id = $9 AND tid = $10 AND test_case_no = $11`,
            [
              result || null,
              judgment || null,
              softwareVersion || null,
              hardwareVersion || null,
              comparatorVersion || null,
              executionDate || null,
              executor || null,
              note || null,
              groupId,
              tid,
              testCaseNo,
            ]
          );

          // Get next history_count
          const maxHistoryResult = await client.query(
            `SELECT MAX(history_count) as max_count FROM tt_test_results_history
             WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3`,
            [groupId, tid, testCaseNo]
          );

          const nextHistoryCount = (maxHistoryResult.rows[0]?.max_count || 0) + 1;

          // INSERT into tt_test_results_history with new history_count
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
              nextHistoryCount,
              result || null,
              judgment || null,
              softwareVersion || null,
              hardwareVersion || null,
              comparatorVersion || null,
              executionDate || null,
              executor || null,
              note || null,
              currentVersion,
            ]
          );
        }

        // Save evidence files if provided
        if (evidencePaths && Array.isArray(evidencePaths) && evidencePaths.length > 0) {
          // Get current or next history_count for evidence
          let historyCount: number;

          if (action === 'create' || action === 'update') {
            // For create/update, use existing history_count
            const historyResult = await client.query(
              `SELECT history_count FROM tt_test_results_history
               WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3
               ORDER BY history_count DESC LIMIT 1`,
              [groupId, tid, testCaseNo]
            );
            historyCount = historyResult.rows[0]?.history_count || 1;
          } else {
            // For re-execute, use the new history_count we just created
            const maxHistoryResult = await client.query(
              `SELECT MAX(history_count) as max_count FROM tt_test_results_history
               WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3`,
              [groupId, tid, testCaseNo]
            );
            historyCount = maxHistoryResult.rows[0]?.max_count || 1;
          }

          // Insert evidence records
          for (let i = 0; i < evidencePaths.length; i++) {
            const evidencePath = evidencePaths[i];
            const fileName = evidencePath.split('/').pop() || `evidence_${i + 1}`;

            await client.query(
              `INSERT INTO tt_test_evidences
               (test_group_id, tid, test_case_no, history_count, evidence_no, evidence_name, evidence_path)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (test_group_id, tid, test_case_no, history_count, evidence_no)
               DO UPDATE SET evidence_name = $6, evidence_path = $7, updated_at = CURRENT_TIMESTAMP`,
              [groupId, tid, testCaseNo, historyCount, i + 1, fileName, evidencePath]
            );
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'テスト結果を登録しました',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('POST /api/test-groups/[groupId]/cases/[tid]/conduct error:', errorMessage);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'テスト結果の登録に失敗しました', details: errorMessage },
      { status: 500 }
    );
  }
}
