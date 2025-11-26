import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup, canEditTestCases } from '@/app/lib/auth';
import { query, getAllRows, getSingleRow, transaction } from '@/app/lib/db';

// GET /api/test-groups/[groupId]/cases/[tid] - Get test case detail
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

    // Get test case detail
    const testCaseResult = await query(
      `SELECT * FROM tt_test_cases
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE`,
      [groupId, tid]
    );

    const testCase = getSingleRow(testCaseResult);
    if (!testCase) {
      return NextResponse.json({ error: 'テストケースが見つかりません' }, { status: 404 });
    }

    // Get test contents
    const contentsResult = await query(
      `SELECT * FROM tt_test_contents
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY test_case_no`,
      [groupId, tid]
    );
    const testContents = getAllRows(contentsResult);

    // Get test case files
    const filesResult = await query(
      `SELECT * FROM tt_test_case_files
       WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
       ORDER BY created_at`,
      [groupId, tid]
    );
    const testCaseFiles = getAllRows(filesResult);

    return NextResponse.json({
      testCase,
      testContents,
      testCaseFiles,
    });
  } catch (error) {
    console.error('GET /api/test-groups/[groupId]/cases/[tid] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストケースの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PUT /api/test-groups/[groupId]/cases/[tid] - Update test case
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission (Designer role required)
    const canEdit = await canEditTestCases(user, groupId);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'テストケースを編集する権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      first_layer,
      second_layer,
      third_layer,
      fourth_layer,
      purpose,
      request_id,
      check_items,
      test_procedure,
      contents,
    } = body;

    // Validation
    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json(
        { error: 'テストケース内容は最低1つ必要です' },
        { status: 400 }
      );
    }

    if (contents.some((tc: unknown) => !(tc as Record<string, unknown>).test_case)) {
      return NextResponse.json(
        { error: 'すべてのテストケース内容を入力してください' },
        { status: 400 }
      );
    }

    await transaction(async (client) => {
      // Update test case
      await client.query(
        `UPDATE tt_test_cases
         SET first_layer = $1, second_layer = $2, third_layer = $3, fourth_layer = $4,
             purpose = $5, request_id = $6, check_items = $7, test_procedure = $8,
             updated_at = CURRENT_TIMESTAMP
         WHERE test_group_id = $9 AND tid = $10 AND is_deleted = FALSE`,
        [
          first_layer || null,
          second_layer || null,
          third_layer || null,
          fourth_layer || null,
          purpose || null,
          request_id || null,
          check_items || null,
          test_procedure || null,
          groupId,
          tid,
        ]
      );

      // Delete existing test contents
      await client.query(
        `DELETE FROM tt_test_contents
         WHERE test_group_id = $1 AND tid = $2`,
        [groupId, tid]
      );

      // Insert new test contents
      if (contents && contents.length > 0) {
        for (const content of contents) {
          await client.query(
            `INSERT INTO tt_test_contents
             (test_group_id, tid, test_case_no, test_case, expected_value, is_target)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              groupId,
              tid,
              content.test_case_no,
              content.test_case,
              content.expected_value || null,
              content.is_target !== undefined ? content.is_target : true,
            ]
          );
        }
      }

    });

    return NextResponse.json({ message: 'テストケースを更新しました' });
  } catch (error) {
    console.error('PUT /api/test-groups/[groupId]/cases/[tid] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストケースの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/test-groups/[groupId]/cases/[tid] - Delete test case (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission (Designer role required)
    const canEdit = await canEditTestCases(user, groupId);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'テストケースを削除する権限がありません' },
        { status: 403 }
      );
    }

    await transaction(async (client) => {
      // Soft delete test case
      await client.query(
        `UPDATE tt_test_cases
         SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE test_group_id = $1 AND tid = $2`,
        [groupId, tid]
      );

      // Soft delete test contents
      await client.query(
        `UPDATE tt_test_contents
         SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE test_group_id = $1 AND tid = $2`,
        [groupId, tid]
      );

      // Soft delete test case files
      await client.query(
        `UPDATE tt_test_case_files
         SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE test_group_id = $1 AND tid = $2`,
        [groupId, tid]
      );
    });

    return NextResponse.json({ message: 'テストケースを削除しました' });
  } catch (error) {
    console.error('DELETE /api/test-groups/[groupId]/cases/[tid] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストケースの削除に失敗しました' },
      { status: 500 }
    );
  }
}
