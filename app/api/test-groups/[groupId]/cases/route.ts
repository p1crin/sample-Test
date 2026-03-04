'use server';
import { canEditTestCases, canViewTestGroup, requireAuth } from "@/app/lib/auth";
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from "@/constants/errorMessages";
import { STATUS_CODES } from "@/constants/statusCodes";
import { Prisma } from '@/generated/prisma/client';
import { TestCase } from "@/types";
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { handleError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ groupId: string }>;
}

// GET /api/test-groups/[groupId]/cases - テストグループIDが該当するテストケースを取得
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();

  // URLからテストグループIDを取得
  const { groupId: groupId } = await params;
  const testGroupId = parseInt(groupId, 10);

  try {
    const user = await requireAuth(req);
    // 取得したテストグループIDとユーザ情報で権限チェック
    const canView = await canViewTestGroup(user.id, user.user_role, testGroupId);
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${testGroupId}/cases`,
      );
    }

    const isCanModify = await canEditTestCases(user, testGroupId);


    // クエリ文字列から検索パラメータを取得
    const { searchParams } = new URL(req.url);
    const tid = searchParams.get('tid') || '';
    const firstLayer = searchParams.get('first_layer') || '';
    const secondLayer = searchParams.get('second_layer') || '';
    const thirdLayer = searchParams.get('third_layer') || '';
    const fourthLayer = searchParams.get('fourth_layer') || '';

    // ページネーションパラメータを取得
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // WHERE句の動的構築
    const whereConditions: Prisma.Sql[] = [
      Prisma.sql`ttc.test_group_id = ${testGroupId}`,
      Prisma.sql`ttc.is_deleted = FALSE`
    ];

    if (tid) {
      whereConditions.push(Prisma.sql`ttc.tid ILIKE ${`%${tid}%`}`);
    }

    if (firstLayer) {
      whereConditions.push(Prisma.sql`ttc.first_layer ILIKE ${`%${firstLayer}%`}`);
    }

    if (secondLayer) {
      whereConditions.push(Prisma.sql`ttc.second_layer ILIKE ${`%${secondLayer}%`}`);
    }

    if (thirdLayer) {
      whereConditions.push(Prisma.sql`ttc.third_layer ILIKE ${`%${thirdLayer}%`}`);
    }

    if (fourthLayer) {
      whereConditions.push(Prisma.sql`ttc.fourth_layer ILIKE ${`%${fourthLayer}%`}`);
    }

    // WHERE句を結合
    const whereClause = Prisma.join(whereConditions, ' AND ');

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${testGroupId}/cases`,
      userId: user.id,
      executionTime: apiTimer.elapsed(),
      queryParams: searchParams,
    })

    // ページネーション用に合計件数を取得
    const countTimer = new QueryTimer();
    const countQuery = Prisma.sql`
      SELECT COUNT(*) FROM tt_test_cases ttc WHERE ${whereClause}
    `;
    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>(countQuery);
    const totalCount = Number(countResult[0]?.count || 0);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_cases',
      executionTime: countTimer.elapsed(),
      rowsReturned: 1,
      query: countQuery.strings.join("?"),
      params: [{ testGroupId, tid, firstLayer, secondLayer, thirdLayer, fourthLayer }],
    });

    // ページネーション付きでテストケースを取得（集計含む）
    const dataTimer = new QueryTimer();
    const dataQuery = Prisma.sql`
      SELECT ttc.test_group_id, ttc.tid, ttc.first_layer, ttc.second_layer, ttc.third_layer, ttc.fourth_layer,
        ttc.purpose, ttc.request_id, ttc.check_items, ttc.test_procedure, ttc.created_at, ttc.updated_at,
        SUM(CASE WHEN (tc.test_group_id IS NOT NULL AND tr.judgment IS NULL AND tc.is_target = true) OR (tr.judgment = '未着手' AND tc.is_target = true) THEN 1 ELSE 0 END):: INTEGER AS not_started_items,
        SUM(CASE WHEN tr.judgment IN('OK', '参照OK') THEN 1 ELSE 0 END):: INTEGER AS ok_items,
        SUM(CASE WHEN tr.judgment = 'NG' THEN 1 ELSE 0 END):: INTEGER AS ng_items,
        SUM(CASE WHEN tr.judgment = '対象外' OR tc.is_target = false THEN 1 ELSE 0 END):: INTEGER AS excluded_items
      FROM tt_test_cases ttc
      LEFT JOIN tt_test_contents tc
        ON ttc.test_group_id = tc.test_group_id
        AND ttc.tid = tc.tid
      LEFT JOIN tt_test_results tr
        ON tc.test_group_id = tr.test_group_id
        AND tc.tid = tr.tid
        AND tc.test_case_no = tr.test_case_no
      WHERE ${whereClause}
      GROUP BY
        ttc.test_group_id, ttc.tid, ttc.first_layer, ttc.second_layer, ttc.third_layer, ttc.fourth_layer,
        ttc.purpose, ttc.request_id, ttc.check_items, ttc.test_procedure, ttc.created_at, ttc.updated_at
      ORDER BY ttc.updated_at DESC, ttc.tid ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const testCases = await prisma.$queryRaw<TestCase[]>(dataQuery);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_cases',
      userId: user.id,
      executionTime: dataTimer.elapsed(),
      rowsReturned: testCases.length,
      query: dataQuery.strings.join("?"),
      params: [{ testGroupId, tid, firstLayer, secondLayer, thirdLayer, fourthLayer, limit, offset }],
    })

    // レスポンスデータを整形
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTestCases = await Promise.all(testCases.map(async (testCase: any) => ({
      test_group_id: testCase.test_group_id,
      tid: testCase.tid,
      first_layer: testCase.first_layer,
      second_layer: testCase.second_layer,
      third_layer: testCase.third_layer,
      fourth_layer: testCase.fourth_layer,
      purpose: testCase.purpose,
      request_id: testCase.request_id,
      check_items: testCase.check_items,
      test_procedure: testCase.test_procedure,
      created_at: testCase.created_at,
      updated_at: testCase.updated_at,
      chartData: {
        ok_items: testCase.ok_items || 0,
        ng_items: testCase.ng_items || 0,
        not_started_items: testCase.not_started_items || 0,
        excluded_items: testCase.excluded_items || 0,
      },
    })));

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${testGroupId}/cases`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: formattedTestCases.length,
    });

    return NextResponse.json({ success: true, data: formattedTestCases, isCanModify, totalCount }, { status: STATUS_CODES.OK });

  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${testGroupId}/cases`
    );
  }
}

// POST /api/test-groups/[groupId]/cases - テストケース登録
export async function POST(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { groupId } = await params;
  const testGroupId = parseInt(groupId, 10);
  try {
    // 認証チェック
    const user = await requireAuth(req);
    const canView = await canViewTestGroup(user.id, user.user_role, testGroupId);
    const isCanModify = await canEditTestCases(user, testGroupId);

    if (!canView || !isCanModify) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${testGroupId}/cases`,
      );
    }

    // JSON形式でリクエストボディを受け取る（編集画面と同じ形式）
    const body = await req.json();
    const {
      tid,
      first_layer: firstLayer,
      second_layer: secondLayer,
      third_layer: thirdLayer,
      fourth_layer: fourthLayer,
      purpose,
      request_id: requestId,
      checkItems,
      testProcedure,
      testContents = [],
    } = body;

    // TIDの重複チェック
    const existingTestCase = await prisma.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: testGroupId,
          tid,
        },
      },
    });

    if (existingTestCase) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${testGroupId}/cases`,
        userId: user.id,
        statusCode: STATUS_CODES.CONFLICT,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
      });
      return handleError(
        new Error(`TID「${tid}」は既に登録されています`),
        STATUS_CODES.CONFLICT,
        apiTimer,
        'POST',
        `/api/test-groups/${testGroupId}/cases`
      );
    }

    // トランザクション開始
    const result = await prisma.$transaction(async (tx) => {
      // tt_test_cases に登録
      const testCase = await tx.tt_test_cases.create({
        data: {
          test_group_id: testGroupId,
          tid,
          first_layer: firstLayer,
          second_layer: secondLayer,
          third_layer: thirdLayer,
          fourth_layer: fourthLayer,
          purpose,
          request_id: requestId,
          check_items: checkItems,
          test_procedure: testProcedure,
        },
      });

      // tt_test_contents に登録（テストケースと期待値が両方入力されているもののみ）
      if (testContents && testContents.length > 0) {
        let testCaseNo = 1;
        for (let i = 0; i < testContents.length; i++) {
          const tc = testContents[i];
          // テストケースと期待値が両方入力されている場合のみ登録
          if (tc.testCase && tc.testCase.trim() !== '' && tc.expectedValue && tc.expectedValue.trim() !== '') {
            await tx.tt_test_contents.create({
              data: {
                test_group_id: testGroupId,
                tid,
                test_case_no: testCaseNo,
                test_case: tc.testCase,
                expected_value: tc.expectedValue,
                is_target: tc.is_target,
              },
            });
            testCaseNo++;
          }
        }
      }

      return testCase;
    });

    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${testGroupId}/cases`,
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: STATUS_CODES.CREATED });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      `/api/test-groups/${testGroupId}/cases`
    )
  }
}