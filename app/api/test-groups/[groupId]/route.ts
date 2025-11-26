import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup, canModifyTestGroup } from '@/app/lib/auth';
import { query, getSingleRow, transaction } from '@/app/lib/db';
import { TestGroup } from '@/app/types/database';

interface RouteParams {
  params: Promise<{ groupId: string }>;
}

// GET /api/test-groups/[groupId] - Get test group details
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { groupId } = await params;
    const user = await requireAuth(req);

    // Check view permission
    const canView = await canViewTestGroup(user.id, user.user_role, parseInt(groupId));

    if (!canView) {
      return NextResponse.json(
        { error: 'このテストグループを表示する権限がありません' },
        { status: 403 }
      );
    }

    // Fetch test group
    const result = await query<TestGroup>(
      `SELECT * FROM tt_test_groups
       WHERE id = $1 AND is_deleted = FALSE`,
      [groupId]
    );

    const testGroup = getSingleRow(result);

    if (!testGroup) {
      return NextResponse.json(
        { error: 'テストグループが見つかりません' },
        { status: 404 }
      );
    }

    // Fetch associated tags
    const tagsResult = await query(
      `SELECT t.id, t.name, tgt.test_role
       FROM tt_test_group_tags tgt
       JOIN mt_tags t ON tgt.tag_id = t.id
       WHERE tgt.test_group_id = $1 AND t.is_deleted = FALSE`,
      [groupId]
    );

    return NextResponse.json({ success: true, data: testGroup, tags: tagsResult.rows });
  } catch (error) {
    console.error(`GET /api/test-groups/${(await params).groupId} error:`, error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'テストグループの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PUT /api/test-groups/[groupId] - Update test group
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { groupId } = await params;
    const user = await requireAuth(req);

    // Check modify permission
    const canModify = await canModifyTestGroup(user, parseInt(groupId));

    if (!canModify) {
      return NextResponse.json(
        { error: 'このテストグループを編集する権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      oem,
      model,
      event,
      variation,
      destination,
      specs,
      test_startdate,
      test_enddate,
      ng_plan_count,
      tags, // Array of { tag_id, test_role }
    } = body;

    // Update test group in transaction
    const testGroup = await transaction(async (client) => {
      // Update test group
      const result = await client.query<TestGroup>(
        `UPDATE tt_test_groups
         SET oem = $1, model = $2, event = $3, variation = $4, destination = $5,
             specs = $6, test_startdate = $7, test_enddate = $8, ng_plan_count = $9,
             updated_by = $10
         WHERE id = $11 AND is_deleted = FALSE
         RETURNING *`,
        [
          oem,
          model,
          event,
          variation,
          destination,
          specs,
          test_startdate,
          test_enddate,
          ng_plan_count,
          user.id.toString(),
          groupId,
        ]
      );

      const updatedGroup = getSingleRow(result);

      if (!updatedGroup) {
        throw new Error('Test group not found');
      }

      // Update tags if provided
      if (tags && Array.isArray(tags)) {
        // Delete existing tags
        await client.query(
          `DELETE FROM tt_test_group_tags WHERE test_group_id = $1`,
          [groupId]
        );

        // Insert new tags
        for (const tag of tags) {
          await client.query(
            `INSERT INTO tt_test_group_tags (test_group_id, tag_id, test_role)
             VALUES ($1, $2, $3)`,
            [groupId, tag.tag_id, tag.test_role]
          );
        }
      }

      return updatedGroup;
    });

    return NextResponse.json({ success: true, data: testGroup });
  } catch (error) {
    console.error(`PUT /api/test-groups/${(await params).groupId} error:`, error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'テストグループの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/test-groups/[groupId] - Soft delete test group
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { groupId } = await params;
    const user = await requireAuth(req);

    // Check modify permission
    const canModify = await canModifyTestGroup(user, parseInt(groupId));

    if (!canModify) {
      return NextResponse.json(
        { error: 'このテストグループを削除する権限がありません' },
        { status: 403 }
      );
    }

    // Soft delete
    await query(
      `UPDATE tt_test_groups
       SET is_deleted = TRUE, updated_by = $1
       WHERE id = $2`,
      [user.id.toString(), groupId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`DELETE /api/test-groups/${(await params).groupId} error:`, error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'テストグループの削除に失敗しました' },
      { status: 500 }
    );
  }
}
