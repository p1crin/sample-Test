import { isAdmin, requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { ERROR_MESSAGES } from "@/constants/errorMessages";
import { STATUS_CODES } from "@/constants/statusCodes";
import { hashPassword } from "@/utils/cryptroUtils";
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
    const userData = await prisma.mt_users.findUnique({
      where: {
        id: parseInt(userId, 10)
      }
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_users',
      executionTime: queryTimer.elapsed(),
      rowsReturned: userData ? 1 : 0,
      query: 'findUnique',
      params: [
        {
          id: parseInt(userId, 10)
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

// PUT /api/users/[userId] - ユーザ更新
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { userId } = await params;

  if (isNaN(parseInt(userId, 10))) {
    return handleError(
      new Error(ERROR_MESSAGES.BAD_REQUEST),
      STATUS_CODES.BAD_REQUEST,
      apiTimer,
      'PUT',
      `/api/users/${userId}`
    );
  }

  try {
    const user = await requireAuth(req);

    // ユーザが管理者か確認   
    if (!isAdmin(user)) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/users/${userId}`,
        userId: user.id,
        statusCode: STATUS_CODES.FORBIDDEN,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.PERMISSION_DENIED
      });
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'PUT',
        `/api/users/${userId}`
      );
    }

    const body = await req.json();
    const {
      email,
      name,
      department,
      company,
      user_role,
      password,
      tags,
      status
    } = body;

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/users/${userId}`,
      userId: user.id,
      executionTime: apiTimer.elapsed()
    });

    // 必須フィールドをバリデーション
    if (!email || !name || !department || !company || user_role === null) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/users/${userId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/users/${userId}`
      );
    }

    // ユーザの権限をバリデーション
    if (typeof user_role !== 'number' || user_role < 0 || user_role > 2) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/users/${userId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.BAD_REQUEST
      });
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/users/${userId}`
      );
    }

    // ステータスをバリデーション
    if (typeof status !== 'boolean') {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/users/${userId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.BAD_REQUEST
      });
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/users/${userId}`
      );
    }

    // メールアドレス重複確認
    const existingUser = await prisma.mt_users.findFirst({
      where: {
        id: { not: parseInt(userId, 10) },
        email: email
      },
    });

    if (existingUser) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: '/api/users',
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/users/${userId}`
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    if (email.length > maxLength || name.length > maxLength || department.length > maxLength || company.length > maxLength) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/users/${userId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH_FOR_USER
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH_FOR_USER),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/users/${userId}`
      );
    }

    // パスワードをバリデーション
    const maxPassword = 64;
    const minPassword = 8;
    if (typeof password !== 'undefined') {
      if (typeof password !== 'string' || password.length < minPassword || password.length > maxPassword) {
        logAPIEndpoint({
          method: 'PUT',
          endpoint: `/api/users/${userId}`,
          userId: user.id,
          statusCode: STATUS_CODES.BAD_REQUEST,
          executionTime: apiTimer.elapsed(),
          error: ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH_FOR_USER
        });
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH_FOR_USER),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'PUT',
          `/api/users/${userId}`
        );
      }

      //パスワードの文字種のバリデーション
      const passwordPattern = /(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!-/:-@[-`{-~])/;
      if (!passwordPattern.test(password)) {
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_PASSWORD_CONTENT),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'PUT',
          `/api/users/${userId}`
        );
      }
    }

    // タグの使用不可文字をバリデーション
    const tagsNgScript = (tags: string[]): boolean => {
      return tags.some(tag => tag.includes(",") || tag.includes(";"));
    }
    if (tags && Array.isArray(tags) && tags.length > 0) {
      if (tagsNgScript(tags)) {
        logAPIEndpoint({
          method: 'PUT',
          endpoint: '/api/users',
          userId: user.id,
          statusCode: STATUS_CODES.BAD_REQUEST,
          executionTime: apiTimer.elapsed(),
          error: ERROR_MESSAGES.VALIDATION_ERROR_NG_USER_TAG
        });
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_NG_USER_TAG),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'PUT',
          `/api/users/${userId}`
        );
      }
    }

    // Prisma トランザクション内でテストグループを更新
    const userData = await prisma.$transaction(async (tx) => {
      const updateTimer = new QueryTimer();

      let passwordHash: undefined | string;
      if (typeof password !== 'undefined') {
        passwordHash = await hashPassword(password);
      } else {
        passwordHash = password;
      }

      // ユーザ情報更新
      const updateUser = await tx.mt_users.update({
        where: {
          id: parseInt(userId, 10)
        },
        data: {
          email,
          name,
          department,
          company,
          user_role,
          password: passwordHash,
          is_deleted: status
        }
      });

      logDatabaseQuery({
        operation: 'UPDATE',
        table: 'mt_users',
        executionTime: updateTimer.elapsed(),
        rowsAffected: 1,
        query: 'update',
        params: [
          {
            email,
            name,
            department,
            company,
            user_role,
            password: passwordHash,
            is_deleted: status
          }
        ]
      });

      // ユーザに紐づいているタグを削除
      await tx.mt_user_tags.deleteMany({
        where: {
          user_id: parseInt(userId, 10)
        }
      });

      // 新規に作成されたタグの確認
      if (tags && Array.isArray(tags) && tags.length > 0) {
        for (const tag of tags) {
          // タグ名からタグIDを取得
          const tagLookupTimer = new QueryTimer();
          let foundTag = await tx.mt_tags.findUnique({
            where: {
              name: tag,
              is_deleted: false
            }
          });

          logDatabaseQuery({
            operation: 'SELECT',
            table: 'mt_tags',
            executionTime: tagLookupTimer.elapsed(),
            rowsReturned: foundTag ? 1 : 0,
            query: 'findUnique',
            params: [
              {
                name: tag
              }
            ]
          });

          // タグの新規作成
          if (!foundTag) {
            const tagInsertTimer = new QueryTimer();
            foundTag = await tx.mt_tags.create({
              data: {
                name: tag
              }
            });

            logDatabaseQuery({
              operation: 'INSERT',
              table: 'mt_tags',
              executionTime: tagInsertTimer.elapsed(),
              rowsAffected: 1,
              query: 'create',
              params: [
                {
                  name: tag
                }
              ]
            });
          }

          // ユーザとタグの紐づけ
          if (foundTag && updateUser) {
            const tagInsertTimer = new QueryTimer();
            await tx.mt_user_tags.create({
              data: {
                user_id: updateUser.id,
                tag_id: foundTag.id
              }
            });

            logDatabaseQuery({
              operation: 'INSERT',
              table: 'mt_user_tags',
              executionTime: tagInsertTimer.elapsed(),
              rowsAffected: 1,
              query: 'create',
              params: [
                {
                  user_id: updateUser.id,
                  tag_id: foundTag.id
                }
              ]
            });
          }

        }
      }
      return updateUser;
    });

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/users/${userId}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json({ success: true, message: 'ユーザを更新しました', data: userData }, { status: STATUS_CODES.OK });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.BAD_REQUEST,
      apiTimer,
      'PUT',
      `/api/users/${userId}`
    );
  }
}

// DELETE /api/users/[userId] - ユーザー削除
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { userId } = await params;

  if (isNaN(parseInt(userId, 10))) {
    return handleError(
      new Error(ERROR_MESSAGES.BAD_REQUEST),
      STATUS_CODES.BAD_REQUEST,
      apiTimer,
      'PUT',
      `/api/users/${userId}`
    );
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
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'DELETE',
        `/api/users/${userId}`
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
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      `/api/users/${userId}`
    );
  }
}