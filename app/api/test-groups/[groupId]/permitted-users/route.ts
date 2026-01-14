import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { QueryTimer, logAPIEndpoint, logDatabaseQuery } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';

// GET /api/test-groups/[groupId]/permitted-users - テストグループに許可されたユーザー一覧を取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const apiTimer = new QueryTimer();
  const user = await requireAuth(req);
  const { groupId: groupIdParam } = await params;
  const groupId = parseInt(groupIdParam, 10);

  try {
    // 形式チェック
    if (isNaN(groupId)) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_GROUP_ID),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/permitted-users`,
      );
    }

    // 権限をチェック
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/permitted-users`,
      );
    }

    // テストグループに関連付けられたタグを取得
    const queryTimer = new QueryTimer();
    const testGroupTags = await prisma.tt_test_group_tags.findMany({
      where: {
        test_group_id: groupId,
        is_deleted: false,
      },
      select: {
        tag_id: true,
      },
    });
    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_group_tags',
      executionTime: queryTimer.elapsed(),
      rowsReturned: testGroupTags.length,
      query: 'findMany',
      params: [{ test_group_id: groupId, is_deleted: false }],
    });

    const tagIds = testGroupTags.map(tgt => tgt.tag_id);

    // タグに関連付けられたユーザーを取得
    let taggedUsers: Array<{ id: number; name: string; email: string; is_deleted: boolean }> = [];

    if (tagIds.length > 0) {
      const usersTimer = new QueryTimer();
      const userTags = await prisma.mt_user_tags.findMany({
        where: {
          tag_id: { in: tagIds },
          is_deleted: false,
        },
        include: {
          mt_users: {
            select: {
              id: true,
              name: true,
              email: true,
              is_deleted: true,
            },
          },
        },
      });
      logDatabaseQuery({
        operation: 'SELECT',
        table: 'mt_user_tags',
        executionTime: usersTimer.elapsed(),
        rowsReturned: userTags.length,
        query: 'findMany',
        params: [{ tag_id: { in: tagIds }, is_deleted: false }],
      });

      taggedUsers = userTags
        .filter(ut => !ut.mt_users.is_deleted)
        .map(ut => ut.mt_users);
    }

    // 現在のユーザー自身を取得
    const currentUserTimer = new QueryTimer();
    const currentUser = await prisma.mt_users.findUnique({
      where: {
        id: user.id,
        is_deleted: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        is_deleted: true,
      },
    });
    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_users',
      executionTime: currentUserTimer.elapsed(),
      rowsReturned: currentUser ? 1 : 0,
      query: 'findUnique',
      params: [{ id: user.id, is_deleted: false }],
    });

    // タグに紐づいたユーザー＋自分自身をマージして重複を排除
    const allUsers = [...taggedUsers];
    if (currentUser && !currentUser.is_deleted) {
      allUsers.push(currentUser);
    }

    const uniqueUsers = Array.from(
      new Map(
        allUsers.map(u => [u.id, { id: u.id, name: u.name, email: u.email }])
      ).values()
    );

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/permitted-users`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: uniqueUsers.length,
    });

    return NextResponse.json({ success: true, data: uniqueUsers });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}/permitted-users`,
    );
  }
}
