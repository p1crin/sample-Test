import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, hasTestRole } from '@/app/lib/auth';
import { query } from '@/app/lib/db';
// import { deleteFileFromS3 } from '@/app/lib/s3';
import { TestRole } from '@/types';

// DELETE /api/test-groups/[groupId]/cases/[tid]/evidences/[testCaseNo]/[historyCount]/[evidenceNo]
export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      groupId: string;
      tid: string;
      testCaseNo: string;
      historyCount: string;
      evidenceNo: string;
    }>;
  }
) {
  try {
    const user = await requireAuth(req);
    const {
      groupId: groupIdParam,
      tid,
      testCaseNo: testCaseNoParam,
      historyCount: historyCountParam,
      evidenceNo: evidenceNoParam,
    } = await params;

    const groupId = parseInt(groupIdParam, 10);
    const testCaseNo = parseInt(testCaseNoParam, 10);
    const historyCount = parseInt(historyCountParam, 10);
    const evidenceNo = parseInt(evidenceNoParam, 10);

    // Check permission (Executor or Designer role required)
    const isExecutor = await hasTestRole(user.id, groupId, TestRole.EXECUTOR);
    const isDesigner = await hasTestRole(user.id, groupId, TestRole.DESIGNER);

    if (!isExecutor && !isDesigner && user.user_role !== 0) {
      return NextResponse.json(
        { error: 'エビデンスを削除する権限がありません' },
        { status: 403 }
      );
    }

    // Get the evidence record to find the S3 key
    const evidenceResult = await query(
      `SELECT evidence_path FROM tt_test_evidences
       WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3
       AND history_count = $4 AND evidence_no = $5 AND is_deleted = FALSE`,
      [groupId, tid, testCaseNo, historyCount, evidenceNo]
    );

    const rows = evidenceResult.rows;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'エビデンスが見つかりません' },
        { status: 404 }
      );
    }

    const evidencePath = rows[0].evidence_path as string;

    // Delete from S3
    // await deleteFileFromS3(evidencePath);

    // Mark as deleted in database
    await query(
      `UPDATE tt_test_evidences
       SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE test_group_id = $1 AND tid = $2 AND test_case_no = $3
       AND history_count = $4 AND evidence_no = $5`,
      [groupId, tid, testCaseNo, historyCount, evidenceNo]
    );

    return NextResponse.json({
      message: 'エビデンスを削除しました',
    });
  } catch (error) {
    console.error(
      'DELETE /api/test-groups/[groupId]/cases/[tid]/evidences error:',
      error
    );

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'エビデンスの削除に失敗しました' },
      { status: 500 }
    );
  }
}