'use server';

import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/users/check-email - email重複チェック
export async function GET(req: NextRequest) {

  const apiTimer = new QueryTimer();
  type WhereConditionProps = {
    email: string;
    id?: {
      not: number;
    };
  };

  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get('id') as string;
    const email = searchParams.get('email') as string;

    if (!email) {
      return handleError(
        new Error(ERROR_MESSAGES.REQUIRED_FIELD),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        '/api/users/check-email'
      );
    }

    // emailが既に登録されているか確認
    const whereCondition: WhereConditionProps = {
      email: email,
    };

    if (id) {
      whereCondition.id = { not: parseInt(id, 10) };
    }

    const existingEmail = await prisma.mt_users.findFirst({
      where: whereCondition,
    });

    return NextResponse.json({
      success: true,
      isDuplicate: !!existingEmail,
    }, { status: STATUS_CODES.OK });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      '/api/users/check-email'
    )
  }
}