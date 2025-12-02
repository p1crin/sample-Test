import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup, canEditTestCases } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

interface RouteParams {
  params: Promise<{ groupId: string }>;
}

// GET /api/test-groups/[groupId]/cases - Get test cases
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const { groupId } = await params;
    const user = await requireAuth(req);
    const groupIdNum = parseInt(groupId);

    // Check view permission
    const canView = await canViewTestGroup(user.id, user.user_role, groupIdNum);

    if (!canView) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/cases`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'このテストグループを表示する権限がありません' },
        { status: 403 }
      );
    }

    // Fetch test cases
    const testCases = await prisma.tt_test_cases.findMany({
      where: {
        test_group_id: groupIdNum,
        is_deleted: false,
      },
      orderBy: {
        tid: 'asc',
      },
    });

    // Fetch test contents and files for each test case
    const casesWithContents = await Promise.all(
      testCases.map(async (testCase: typeof testCases[0]) => {
        const contents = await prisma.tt_test_contents.findMany({
          where: {
            test_group_id: groupIdNum,
            tid: testCase.tid,
            is_deleted: false,
          },
          orderBy: {
            test_case_no: 'asc',
          },
        });

        const files = await prisma.tt_test_case_files.findMany({
          where: {
            test_group_id: groupIdNum,
            tid: testCase.tid,
            is_deleted: false,
          },
          orderBy: [
            { file_type: 'asc' },
            { file_no: 'asc' },
          ],
        });

        return {
          ...testCase,
          contents,
          files,
        };
      })
    );

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/cases`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: casesWithContents.length,
    });

    return NextResponse.json({ testCases: casesWithContents });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${(await params).groupId}/cases`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'テストケースの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST /api/test-groups/[groupId]/cases - Create test case
export async function POST(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  let statusCode = 201;

  try {
    const { groupId } = await params;
    const user = await requireAuth(req);
    const groupIdNum = parseInt(groupId);

    // Check edit permission
    const canEdit = await canEditTestCases(user, groupIdNum);

    if (!canEdit) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${groupId}/cases`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'テストケースを作成する権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      tid,
      first_layer,
      second_layer,
      third_layer,
      fourth_layer,
      purpose,
      request_id,
      check_items,
      test_procedure,
      contents, // Array of test contents
    } = body;

    // Validate required fields
    if (!tid) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${groupId}/cases`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: tid required',
      });
      return NextResponse.json(
        { error: 'TIDは必須です' },
        { status: 400 }
      );
    }

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${groupId}/cases`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: contents required',
      });
      return NextResponse.json(
        { error: 'テストケース内容は最低1つ必要です' },
        { status: 400 }
      );
    }

    // Create test case in transaction
    const testCase = await prisma.$transaction(async (tx) => {
      // Insert test case
      const newTestCase = await tx.tt_test_cases.create({
        data: {
          test_group_id: groupIdNum,
          tid,
          first_layer: first_layer || null,
          second_layer: second_layer || null,
          third_layer: third_layer || null,
          fourth_layer: fourth_layer || null,
          purpose: purpose || null,
          request_id: request_id || null,
          check_items: check_items || null,
          test_procedure: test_procedure || null,
        },
      });

      // Insert test contents
      for (const content of contents) {
        await tx.tt_test_contents.create({
          data: {
            test_group_id: groupIdNum,
            tid,
            test_case_no: content.test_case_no,
            test_case: content.test_case || '',
            expected_value: content.expected_value || null,
            is_target: content.is_target !== undefined ? content.is_target : true,
          },
        });
      }

      return newTestCase;
    });

    statusCode = 201;
    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${groupId}/cases`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1 + contents.length,
    });

    return NextResponse.json({ testCase }, { status: 201 });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${(await params).groupId}/cases`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error(`POST /api/test-groups/${(await params).groupId}/cases error:`, error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'テストケースの作成に失敗しました' },
      { status: 500 }
    );
  }
}
