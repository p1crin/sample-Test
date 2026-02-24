import { requireAuth } from "@/app/lib/auth";
import { prisma } from '@/app/lib/prisma';
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { handleError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from 'bcrypt';
import { hashPassword } from "@/utils/cryptroUtils";
import { STATUS_CODES } from "@/constants/statusCodes";
import { ERROR_MESSAGES } from "@/constants/errorMessages";

// PUT /api/auth/change-password -登録済みのパスワードを更新
export async function PUT(req: NextRequest) {
  const apiTimer = new QueryTimer();
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const {
      current_password,
      new_password,
      new_password_confirmation
    } = body;

    logAPIEndpoint({
      method: 'PUT',
      endpoint: '/api/auth/change-password',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
    })

    // 必須フィールドのバリデーション
    if (!current_password || !new_password || !new_password_confirmation) {
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      );
    }
    // 文字数のバリデーション
    const passMaxLength = 64;
    const passMinLength = 8;

    if (new_password.length > passMaxLength || new_password.length < passMinLength) {
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_NEW_PASSWORD_LENGTH),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      );
    }
    // 新しいパスワードの文字種のバリデーション(半角英数字記号を最低1文字ずつ使用)
    const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).+$/;
    if (!passwordPattern.test(new_password)) {
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_NEW_PASSWORD_CONTENT),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      );
    }
    // 現在のパスワードと新しいパスワードが一致したときは400エラー
    if (current_password === new_password) {
      return handleError(
        new Error(ERROR_MESSAGES.MATCH_PASSWORD),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      );
    }
    // 新しいパスワードと確認用が一致しないときは400エラー
    if (new_password !== new_password_confirmation) {
      return handleError(
        new Error(ERROR_MESSAGES.UNMATCH_NEW_PASSWORD),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      );
    }

    // ユーザIDが一致するユーザ情報を取得
    const selectTimer = new QueryTimer();
    const userInfo = await prisma.mt_users.findUnique({
      where: {
        id: user.id,
        is_deleted: false,
      }
    });

    logDatabaseQuery({
      operation: 'SELECT',
      userId: user.id,
      executionTime: selectTimer.elapsed(),
      query: 'findMany',
    })

    // 該当するデータが無いとき404エラー
    if (!userInfo) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_PASSWORD),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      );
    }
    // パスワードのハッシュ値を比較
    const isMatchPass = await bcrypt.compare(current_password, userInfo.password)
    // パスワードのハッシュ値が違うとき404エラー
    if (!isMatchPass) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_PASSWORD),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'PUT',
        '/api/auth/change-password'
      )
    }
    // 新しいパスワードを暗号化
    const newPasswordHash = await hashPassword(new_password)
    // パスワードを更新
    const updateTimer = new QueryTimer();
    const userData = await prisma.mt_users.update({
      data: {
        password: newPasswordHash
      },
      where: {
        id: user.id
      }
    })

    logDatabaseQuery({
      operation: 'UPDATE',
      userId: user.id,
      executionTime: updateTimer.elapsed(),
      rowsAffected: 1,
      params: [
        {
          password: newPasswordHash
        }
      ]
    })

    logAPIEndpoint({
      method: 'PUT',
      endpoint: '/api/auth/change-password',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });
    return NextResponse.json({ success: true, data: userData }, { status: STATUS_CODES.OK });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'PUT',
      '/api/auth/change-password'
    );
  }
}