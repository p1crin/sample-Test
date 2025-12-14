import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup, canEditTestCases } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

// GET /api/test-groups/[groupId]/cases/[tid] - Get test case detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json({ error: 'アクセス権限がありません' }, { status: 403 });
    }

    // Get test case detail
    const testCase = await prisma.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: groupId,
          tid,
        },
        is_deleted: false,
      },
    });

    if (!testCase) {
      statusCode = 404;
      logAPIEndpoint({
        method: 'GET',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
      });
      return NextResponse.json({ error: 'テストケースが見つかりません' }, { status: 404 });
    }

    // Get test contents
    const testContents = await prisma.tt_test_contents.findMany({
      where: {
        test_group_id: groupId,
        tid,
        is_deleted: false,
      },
      orderBy: {
        test_case_no: 'asc',
      },
    });

    // Get test case files
    const testCaseFiles = await prisma.tt_test_case_files.findMany({
      where: {
        test_group_id: groupId,
        tid,
        is_deleted: false,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1 + testContents.length + testCaseFiles.length,
    });

    return NextResponse.json({
      testCase,
      testContents,
      testCaseFiles,
    });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${(await params).groupId}/cases/${(await params).tid}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error('GET /api/test-groups/[groupId]/cases/[tid] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストケースの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// PUT /api/test-groups/[groupId]/cases/[tid] - Update test case
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission (Designer role required)
    const canEdit = await canEditTestCases(user, groupId);
    if (!canEdit) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'テストケースを編集する権限がありません' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      first_layer,
      second_layer,
      third_layer,
      fourth_layer,
      purpose,
      request_id,
      check_items,
      test_procedure,
      contents,
    } = body;

    // Validation
    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
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

    // Check that all contents have both test_case and expected_value
    if (contents.some((tc: unknown) => {
      const record = tc as Record<string, unknown>;
      const testCase = String(record.test_case || '').trim();
      const expectedValue = String(record.expected_value || '').trim();
      return testCase === '' || expectedValue === '';
    })) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: test_case and expected_value required in all contents',
      });
      return NextResponse.json(
        { error: 'テストケースと期待値の両方を入力してください' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Update test case
      await tx.tt_test_cases.update({
        where: {
          test_group_id_tid: {
            test_group_id: groupId,
            tid,
          },
        },
        data: {
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

      // Delete existing test contents
      await tx.tt_test_contents.deleteMany({
        where: {
          test_group_id: groupId,
          tid,
        },
      });

      // Insert new test contents
      if (contents && contents.length > 0) {
        for (const content of contents) {
          await tx.tt_test_contents.create({
            data: {
              test_group_id: groupId,
              tid,
              test_case_no: content.test_case_no,
              test_case: content.test_case,
              expected_value: content.expected_value || null,
              is_target: content.is_target !== undefined ? content.is_target : true,
            },
          });
        }
      }
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1 + contents.length,
    });

    return NextResponse.json({ message: 'テストケースを更新しました' });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${(await params).groupId}/cases/${(await params).tid}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error('PUT /api/test-groups/[groupId]/cases/[tid] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストケースの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/test-groups/[groupId]/cases/[tid] - Delete test case (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);
    const { groupId: groupIdParam, tid } = await params;
    const groupId = parseInt(groupIdParam, 10);

    // Check permission (Designer role required)
    const canEdit = await canEditTestCases(user, groupId);
    if (!canEdit) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'DELETE',
        endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'テストケースを削除する権限がありません' },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete test case
      await tx.tt_test_cases.updateMany({
        where: {
          test_group_id: groupId,
          tid,
        },
        data: {
          is_deleted: true,
        },
      });

      // Soft delete test contents
      await tx.tt_test_contents.updateMany({
        where: {
          test_group_id: groupId,
          tid,
        },
        data: {
          is_deleted: true,
        },
      });

      // Soft delete test case files
      await tx.tt_test_case_files.updateMany({
        where: {
          test_group_id: groupId,
          tid,
        },
        data: {
          is_deleted: true,
        },
      });
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 0,
    });

    return NextResponse.json({ message: 'テストケースを削除しました' });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/test-groups/${(await params).groupId}/cases/${(await params).tid}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    console.error('DELETE /api/test-groups/[groupId]/cases/[tid] error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストケースの削除に失敗しました' },
      { status: 500 }
    );
  }
}
