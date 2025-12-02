/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { hash } from 'bcryptjs';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

// GET /api/users - Get all users (Admin only)
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    await requireAdmin(req);

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const department = searchParams.get('department');
    const tagId = searchParams.get('tagId');

    // Build where conditions
    const whereConditions: Record<string, unknown> = {
      is_deleted: false,
    };

    if (email) {
      whereConditions.email = {
        contains: email,
        mode: 'insensitive',
      };
    }

    if (department) {
      whereConditions.department = {
        contains: department,
        mode: 'insensitive',
      };
    }

    // If tagId is provided, filter users by tag
    let userIds: number[] | undefined;
    if (tagId) {
      const userTags = await prisma.mt_user_tags.findMany({
        where: {
          tag_id: parseInt(tagId),
        },
        select: {
          user_id: true,
        },
      });
      userIds = userTags.map((ut: typeof userTags[0]) => ut.user_id);
    }

    if (userIds !== undefined && userIds.length === 0) {
      // No users with this tag
      statusCode = 200;
      logAPIEndpoint({
        method: 'GET',
        endpoint: '/api/users',
        statusCode,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
      });
      return NextResponse.json({ users: [] });
    }

    if (userIds) {
      whereConditions.id = {
        in: userIds,
      };
    }

    // Fetch users
    const users = await prisma.mt_users.findMany({
      where: whereConditions,
      orderBy: {
        created_at: 'desc',
      },
    } as any);

    // Fetch tags for each user
    const usersWithTags = await Promise.all(
      users.map(async (user: typeof users[0]) => {
        const tags = await prisma.mt_user_tags.findMany({
          where: {
            user_id: user.id,
          },
          include: {
            mt_tags: true,
          },
        });

        return {
          ...user,
          tags: tags
            .filter((tag) => !tag.mt_tags.is_deleted)
            .map((tag) => ({
              id: tag.mt_tags.id,
              name: tag.mt_tags.name,
            })),
        };
      })
    );

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/users',
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: usersWithTags.length,
    });

    return NextResponse.json({ users: usersWithTags });
  } catch (error) {
    statusCode = error instanceof Error && error.message.includes('Admin') ? 403 : 500;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/users',
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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
  const apiTimer = new QueryTimer();
  let statusCode = 201;

  try {
    const pass = await hash("admin123", 10);
    console.log(`password: ${pass}`);
    await requireAdmin(req);

    const body = await req.json();
    const { email, password, user_role, department, company, tags } = body;

    // Validate required fields
    if (!email || !password) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/users',
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: email and password required',
      });
      return NextResponse.json(
        { error: 'メールアドレスとパスワードは必須です' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.mt_users.findFirst({
      where: {
        email: email,
      },
    });

    if (existingUser) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/users',
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Email already exists',
      });
      return NextResponse.json(
        { error: 'このメールアドレスは既に使用されています' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user in transaction
    const user = await prisma.$transaction(async (tx) => {
      // Insert user
      const newUser = await tx.mt_users.create({
        data: {
          email,
          password: hashedPassword,
          user_role: user_role || 2,
          department: department || '',
          company: company || '',
        },
      });

      // Create tags if they don't exist and assign to user
      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          // Check if tag exists
          let foundTag = await tx.mt_tags.findFirst({
            where: {
              name: tagName,
            },
          });

          // Create new tag if it doesn't exist
          if (!foundTag) {
            foundTag = await tx.mt_tags.create({
              data: {
                name: tagName,
              },
            });
          }

          // Assign tag to user
          await tx.mt_user_tags.create({
            data: {
              user_id: newUser.id,
              tag_id: foundTag.id,
            },
          });
        }
      }

      return newUser;
    });

    statusCode = 201;
    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/users',
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    statusCode = error instanceof Error && error.message.includes('Admin') ? 403 : 500;
    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/users',
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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
