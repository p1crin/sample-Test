import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { query, getSingleRow, transaction } from '@/app/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/users/[userId] - Get user detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam, 10);

    // Get user detail
    const userResult = await query(
      `SELECT id, name, email, user_role, created_at, updated_at
       FROM mt_users
       WHERE id = $1 AND is_deleted = FALSE`,
      [userId]
    );

    const user = getSingleRow(userResult);
    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // Get user tags
    const tagsResult = await query(
      `SELECT t.id as tag_id, t.name as tag_name
       FROM mt_user_tags ut
       JOIN mt_tags t ON ut.tag_id = t.id
       WHERE ut.user_id = $1 AND ut.is_deleted = FALSE AND t.is_deleted = FALSE
       ORDER BY t.name`,
      [userId]
    );

    const tags = tagsResult.rows;

    return NextResponse.json({ user, tags });
  } catch (error) {
    console.error('GET /api/users/[userId] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'ユーザーの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[userId] - Update user
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam, 10);
    const body = await req.json();
    const { name, email, user_role, password, tags } = body;

    await transaction(async (client) => {
      // Update user basic info
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await client.query(
          `UPDATE mt_users
           SET name = $1, email = $2, user_role = $3, password = $4, updated_at = CURRENT_TIMESTAMP
           WHERE id = $5 AND is_deleted = FALSE`,
          [name, email, user_role, hashedPassword, userId]
        );
      } else {
        await client.query(
          `UPDATE mt_users
           SET name = $1, email = $2, user_role = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 AND is_deleted = FALSE`,
          [name, email, user_role, userId]
        );
      }

      // Delete existing user tags
      await client.query(
        `UPDATE mt_user_tags
         SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId]
      );

      // Insert new user tags
      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          await client.query(
            `INSERT INTO mt_user_tags (user_id, tag_id, created_by, updated_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, tag_id) DO UPDATE
             SET is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP`,
            [userId, tagId, admin.id, admin.id]
          );
        }
      }
    });

    return NextResponse.json({ message: 'ユーザーを更新しました' });
  } catch (error) {
    console.error('PUT /api/users/[userId] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'ユーザーの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[userId] - Delete user (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireAdmin(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam, 10);

    await query(
      `UPDATE mt_users
       SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({ message: 'ユーザーを削除しました' });
  } catch (error) {
    console.error('DELETE /api/users/[userId] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'ユーザーの削除に失敗しました' },
      { status: 500 }
    );
  }
}
