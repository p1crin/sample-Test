'use server';

import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/test-cases/check-tid - TID重複チェック
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const groupId = parseInt(searchParams.get('groupId') as string);
    const tid = searchParams.get('tid') as string;

    if (!groupId || !tid) {
      return NextResponse.json({
        success: false,
        error: ERROR_MESSAGES.GROUP_ID_AND_TID_REQUIRED,
      }, { status: STATUS_CODES.BAD_REQUEST });
    }

    // TIDが既に登録されているか確認
    const existingTestCase = await prisma.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: groupId,
          tid,
        },
      },
    });

    return NextResponse.json({
      success: true,
      isDuplicate: !!existingTestCase,
    }, { status: STATUS_CODES.OK });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.DEFAULT;
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: STATUS_CODES.INTERNAL_SERVER_ERROR });
  }
}