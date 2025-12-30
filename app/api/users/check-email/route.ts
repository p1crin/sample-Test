'use server';

import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/users/check-email - email重複チェック
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email') as string;

    if (!email) {
      return NextResponse.json({
        success: false,
        error: ERROR_MESSAGES.REQUIRED_FIELD,
      }, { status: STATUS_CODES.BAD_REQUEST });
    }

    // emailが既に登録されているか確認
    const existingEmail = await prisma.mt_users.findUnique({
      where: {
        email: email,
      },
    });

    return NextResponse.json({
      success: true,
      isDuplicate: !!existingEmail,
    }, { status: STATUS_CODES.OK });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.DEFAULT;
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: STATUS_CODES.INTERNAL_SERVER_ERROR });
  }
}