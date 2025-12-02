import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

// GET /api/users/[userId] - Get user detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    await requireAdmin(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam, 10);

    // Get user detail
    const user = await prisma.mt_users.findUnique({
      where: {
        id: userId,
        is_deleted: false,
      },
    });

    if (!user) {
      statusCode = 404;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/users/${userId}`,
        statusCode,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
      });
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 });
    }

    // Get user tags
    const tags = await prisma.mt_user_tags.findMany({
      where: {
        user_id: userId,
      },
      include: {
        mt_tags: true,
      },
      orderBy: {
        mt_tags: {
          name: 'asc',
        },
      },
    });

    const formattedTags = tags
      .filter((tag) => !tag.mt_tags.is_deleted)
      .map((tag) => ({
        tag_id: tag.mt_tags.id,
        tag_name: tag.mt_tags.name,
      }));

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/users/${userId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1 + formattedTags.length,
    });

    return NextResponse.json({ user, tags: formattedTags });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 :
                 error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/users/${(await params).userId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const admin = await requireAdmin(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam, 10);
    const body = await req.json();
    const { name, email, user_role, password, tags } = body;

    await prisma.$transaction(async (tx) => {
      // Update user basic info
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await tx.mt_users.update({
          where: {
            id: userId,
          },
          data: {
            name,
            email,
            user_role,
            password: hashedPassword,
          },
        });
      } else {
        await tx.mt_users.update({
          where: {
            id: userId,
          },
          data: {
            name,
            email,
            user_role,
          },
        });
      }

      // Delete existing user tags
      await tx.mt_user_tags.updateMany({
        where: {
          user_id: userId,
        },
        data: {
          is_deleted: true,
        },
      });

      // Insert new user tags
      if (tags && tags.length > 0) {
        for (const tagId of tags) {
          await tx.mt_user_tags.upsert({
            where: {
              user_id_tag_id: {
                user_id: userId,
                tag_id: tagId,
              },
            },
            update: {
              is_deleted: false,
            },
            create: {
              user_id: userId,
              tag_id: tagId,
              created_by: admin.id,
              updated_by: admin.id,
            },
      }
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/users/${userId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 0,
    });

    return NextResponse.json({ message: 'ユーザーを更新しました' });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 :
                 error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/users/${(await params).userId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    await requireAdmin(req);
    const { userId: userIdParam } = await params;
    const userId = parseInt(userIdParam, 10);

    await prisma.mt_users.update({
      where: {
        id: userId,
      },
      data: {
        is_deleted: true,
      },
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/users/${userId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 0,
    });

    return NextResponse.json({ message: 'ユーザーを削除しました' });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 :
                 error instanceof Error && error.message === 'Forbidden' ? 403 : 500;
    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/users/${(await params).userId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

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
