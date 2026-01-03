'use server';
import { canViewTestGroup, requireAuth } from "@/app/lib/auth";
import { prisma } from '@/app/lib/prisma';
import { STATUS_CODES } from "@/constants/statusCodes";
import { handleError } from "@/utils/errorHandler";
import { logAPIEndpoint, QueryTimer } from "@/utils/database-logger";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ groupId: string; tid: string }>;
}

// GET /api/test-groups/[groupId]/cases/[tid]/detail - テストケース詳細情報を取得
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { groupId: groupIdStr, tid } = await params;
  const groupId = parseInt(groupIdStr, 10);

  try {
    const user = await requireAuth(req);
    // 権限チェック
    await canViewTestGroup(user.id, user.user_role, groupId);

    // tt_test_cases から基本情報を取得
    const testCase = await prisma.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: groupId,
          tid,
        },
      },
    });

    if (!testCase) {
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}/detail`,
        userId: user.id,
        statusCode: STATUS_CODES.NOT_FOUND,
        executionTime: apiTimer.elapsed(),
      });
      return NextResponse.json(
        { success: false, error: 'テストケースが見つかりません' },
        { status: STATUS_CODES.NOT_FOUND }
      );
    }

    // tt_test_case_files からファイル情報を取得
    const files = await prisma.tt_test_case_files.findMany({
      where: {
        test_group_id: groupId,
        tid,
        is_deleted: false,
      },
    });

    // ファイルを type ごとに分類
    const controlSpecFiles = files
      .filter(f => f.file_type === 0)
      .map(f => ({ name: f.file_name, id: f.file_path }));
    const dataFlowFiles = files
      .filter(f => f.file_type === 1)
      .map(f => ({ name: f.file_name, id: f.file_path }));

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}/detail`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
    });

    return NextResponse.json({
      success: true,
      data: {
        tid: testCase.tid,
        firstLayer: testCase.first_layer,
        secondLayer: testCase.second_layer,
        thirdLayer: testCase.third_layer,
        fourthLayer: testCase.fourth_layer,
        purpose: testCase.purpose,
        requestId: testCase.request_id,
        checkItems: testCase.check_items,
        controlSpec: controlSpecFiles,
        dataFlow: dataFlowFiles,
        testProcedure: testCase.test_procedure,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}/cases/${tid}/detail`
    );
  }
}
