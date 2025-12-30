import { isAdmin, requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { ERROR_MESSAGES } from "@/constants/errorMessages";
import { STATUS_CODES } from "@/constants/statusCodes";
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { handleError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ userId: string }>
}

// GET /api/users/[userId] - ユーザー詳細取得
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { userId } = await params;

  try {
    const user = await requireAuth(req);

    if (!isAdmin(user)) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/users/${userId}`
      );
    }

    const queryTimer = new QueryTimer();
    const userData = await prisma.mt_users.findFirst({
      where: {
        id: parseInt(userId, 10),
        is_deleted: false
      }
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_users',
      executionTime: queryTimer.elapsed(),
      rowsReturned: userData ? 1 : 0,
      query: 'findFirst',
      params: [
        {
          id: parseInt(userId, 10),
          is_deleted: false
        }
      ]
    });

    if (!userData) {
      return handleError(
        new Error(ERROR_MESSAGES.GET_FALED),
        STATUS_CODES.NOT_FOUND,
        queryTimer,
        'GET',
        `/api/users/${userId}`
      );
    }

    const tagsTimer = new QueryTimer();
    const userTags = await prisma.mt_user_tags.findMany({
      where: {
        user_id: parseInt(userId, 10),
        is_deleted: false,
        mt_tags: {
          is_deleted: false,
        },
      },
      include: {
        mt_tags: true,
      },
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_user_tags',
      executionTime: tagsTimer.elapsed(),
      rowsReturned: userTags.length,
      query: 'findMany',
      params: [
        {
          user_id: parseInt(userId, 10),
          mt_tags: {
            is_deleted: false
          }
        }
      ]
    });

    // タグのフォーマット
    const formattedUserTags = userTags.map(tag =>
      tag.mt_tags.name
    );

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/users/${userId}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...userData,
          userTags: formattedUserTags
        }
      },
      { status: STATUS_CODES.OK }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/users/${userId}`
    );
  }
}

// DELETE /api/users/[userId] - ユーザー削除
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { userId } = await params;

  if (isNaN(parseInt(userId, 10))) {
    throw new Error('対象のID(メールアドレス)の取得に失敗しました');
  }

  try {
    const user = await requireAuth(req);

    // ユーザが管理者か確認   
    if (!isAdmin(user)) {
      logAPIEndpoint({
        method: 'DELETE',
        endpoint: `/api/users/${userId}`,
        userId: user.id,
        statusCode: STATUS_CODES.FORBIDDEN,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.PERMISSION_DENIED
      });
      return NextResponse.json(
        { success: false, error: { message: ERROR_MESSAGES.PERMISSION_DENIED } },
        { status: STATUS_CODES.FORBIDDEN },
      );
    }

    const deleteTimer = new QueryTimer();
    // ユーザIDに一致するレコードを削除扱い
    await prisma.mt_users.update({
      where: {
        id: parseInt(userId, 10),
      },
      data: {
        is_deleted: true,
      }
    });


    logDatabaseQuery({
      operation: 'UPDATE',
      table: 'mt_users',
      executionTime: deleteTimer.elapsed(),
      rowsAffected: 1,
      query: 'update',
      params: [
        {
          id: parseInt(userId, 10),
        }
      ]
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/users/${userId}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json({ success: true, message: 'ユーザを削除しました' }, { status: STATUS_CODES.OK });
  } catch (error) {
    return handleError(error as Error, STATUS_CODES.INTERNAL_SERVER_ERROR, apiTimer, 'DELETE', `/api/users/${userId}`);
  }
}