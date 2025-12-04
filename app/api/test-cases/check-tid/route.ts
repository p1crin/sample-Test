'use server';

import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const groupId = parseInt(searchParams.get('groupId') as string);
    const tid = searchParams.get('tid') as string;

    if (!groupId || !tid) {
      return NextResponse.json({
        success: false,
        error: 'groupId and tid are required',
      }, { status: 400 });
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
    }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '予期せぬエラーが発生しました';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
