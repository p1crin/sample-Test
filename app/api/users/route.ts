import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { query, getAllRows, transaction } from '@/app/lib/db';
import { hash } from 'bcryptjs';
import { User } from '@/app/types/database';

// GET /api/users - Get all users (Admin only)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const department = searchParams.get('department');
    const tagId = searchParams.get('tagId');

    let queryText = `
      SELECT DISTINCT u.id, u.email, u.user_role, u.department, u.company, u.created_at, u.updated_at
      FROM mt_users u
      LEFT JOIN mt_user_tags ut ON u.id = ut.user_id
      WHERE u.is_deleted = FALSE
    `;

    const params: unknown[] = [];

    if (email) {
      params.push(`%${email}%`);
      queryText += ` AND u.email ILIKE $${params.length}`;
    }

    if (department) {
      params.push(`%${department}%`);
      queryText += ` AND u.department ILIKE $${params.length}`;
    }

    if (tagId) {
      params.push(parseInt(tagId));
      queryText += ` AND ut.tag_id = $${params.length}`;
    }

    queryText += ` ORDER BY u.created_at DESC`;

    const result = await query<Omit<User, 'password'>>(queryText, params);
    const users = getAllRows(result);

    // Fetch tags for each user
    const usersWithTags = await Promise.all(
      users.map(async (user) => {
        const tagsResult = await query(
          `SELECT t.id, t.name
           FROM mt_tags t
           JOIN mt_user_tags ut ON t.id = ut.tag_id
           WHERE ut.user_id = $1 AND t.is_deleted = FALSE`,
          [user.id]
        );

        return {
          ...user,
          tags: getAllRows(tagsResult),
        };
      })
    );

    return NextResponse.json({ users: usersWithTags });
  } catch (error) {
    console.error('GET /api/users error:', error);

    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'ユーザーの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create user (Admin only)
export async function POST(req: NextRequest) {
  try {
    const pass = await hash("admin123", 10);
    console.log(`password: ${pass}`);
    await requireAdmin(req);

    const body = await req.json();
    const { email, password, user_role, department, company, tags } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM mt_users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user in transaction
    const user = await transaction(async (client) => {
      // Insert user
      const result = await client.query<User>(
        `INSERT INTO mt_users (email, password, user_role, department, company)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, user_role, department, company, created_at, updated_at`,
        [email, hashedPassword, user_role || 2, department || '', company || '']
      );

      const newUser = result.rows[0];

      // Create tags if they don't exist and assign to user
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          // Check if tag exists
          const tagResult = await client.query(
            'SELECT id FROM mt_tags WHERE name = $1',
            [tagName]
          );

          let tagId;
          if (tagResult.rows.length === 0) {
            // Create new tag
            const newTag = await client.query(
              'INSERT INTO mt_tags (name) VALUES ($1) RETURNING id',
              [tagName]
            );
            tagId = newTag.rows[0].id;
          } else {
            tagId = tagResult.rows[0].id;
          }

          // Assign tag to user
          await client.query(
            'INSERT INTO mt_user_tags (user_id, tag_id) VALUES ($1, $2)',
            [newUser.id, tagId]
          );
        }
      }

      return newUser;
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);

    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json(
        { error: '管理者権限が必要です' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'ユーザーの作成に失敗しました' },
      { status: 500 }
    );
  }
}
