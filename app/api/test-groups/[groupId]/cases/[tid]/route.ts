import { canEditTestCases, canViewTestGroup, requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { rm } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

// GET /api/test-groups/[groupId]/cases/[tid] - テストケース詳細を取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.OK;
  const { groupId: groupIdParam, tid } = await params;
  const groupId = parseInt(groupIdParam, 10);

  try {
    const user = await requireAuth(req);

    // 形式チェック
    if (isNaN(groupId)) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_GROUP_ID),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/daily-report-data`,
      );
    }

    // 権限を確認
    const canView = await canViewTestGroup(user.id, user.user_role, groupId);
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/cases/${tid}`,
      );
    }

    // テストグループ存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: groupId, is_deleted: false },
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/daily-report-data`,
      );
    }

    // テストケース詳細を取得
    const testCase = await prisma.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: groupId,
          tid,
        },
        is_deleted: false,
      },
    });

    // テストケース存在確認
    if (!testCase) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}/cases/${tid}`,
      );
    }

    // テスト内容を取得
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

    // テストケースファイル（制御仕様書、データフロー）を取得
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

    // レスポンスデータをフォーマット
    const responseData = {
      test_group_id: testCase.test_group_id,
      tid: testCase.tid,
      first_layer: testCase.first_layer,
      second_layer: testCase.second_layer,
      third_layer: testCase.third_layer,
      fourth_layer: testCase.fourth_layer,
      purpose: testCase.purpose,
      request_id: testCase.request_id,
      test_procedure: testCase.test_procedure,
      check_items: testCase.check_items,
      created_at: testCase.created_at,
      updated_at: testCase.updated_at,
      control_spec: testCaseFiles.filter(file => file.file_type === 0).map(file => ({
        file_name: file.file_name,
        file_path: file.file_path,
        file_type: file.file_type,
        file_no: file.file_no
      })),
      data_flow: testCaseFiles.filter(file => file.file_type === 1).map(file => ({
        file_name: file.file_name,
        file_path: file.file_path,
        file_type: file.file_type,
        file_no: file.file_no
      })),
      contents: testContents.map(content => ({
        id: content.test_case_no,
        testCase: content.test_case,
        expectedValue: content.expected_value,
        is_target: content.is_target
      }))
    };

    statusCode = STATUS_CODES.OK;
    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${groupId}/cases/${tid}`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1 + testContents.length + testCaseFiles.length,
    });

    return NextResponse.json({
      success: true,
      data: [responseData],
    });
  } catch (error) {
    return handleError(
      new Error(ERROR_MESSAGES.GET_FALED),
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}/cases/${tid}`,
    );
  }
}

// PUT /api/test-groups/[groupId]/cases/[tid] - テストケースの更新
export async function PUT(req: NextRequest, { params }: { params: Promise<{ groupId: string; tid: string }> }) {
  const apiTimer = new QueryTimer();
  const getParams = await params;
  const testGroupId = parseInt(getParams.groupId);
  const tid = encodeURIComponent(getParams.tid);

  // テストグループIDが数値でないとき400エラー
  if (isNaN(testGroupId)) {
    return handleError(
      new Error(ERROR_MESSAGES.BAD_REQUEST),
      STATUS_CODES.BAD_REQUEST,
      apiTimer,
      'PUT',
      `/api/test-groups/${testGroupId}/cases/${tid}`,
    );
  }

  try {
    // 認証チェック
    const user = await requireAuth(req);
    // 権限チェック
    const canEdit = await canEditTestCases(user, testGroupId);

    if (!canEdit) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'PUT',
        `/api/test-groups/${testGroupId}/cases/${tid}`,
      );
    }

    // JSONボディをパース
    const body = await req.json();
    const {
      first_layer,
      second_layer,
      third_layer,
      fourth_layer,
      purpose,
      request_id,
      checkItems,
      testProcedure,
      testContents = [],
      testContentIds = [],
      deletedContents = [],
    } = body;

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${testGroupId}/cases/${tid}`,
      userId: user.id,
      executionTime: apiTimer.elapsed()
    });

    // 必須フィールドをバリデーション
    if (!first_layer || !second_layer || !third_layer || !fourth_layer || !purpose || !request_id || !checkItems || !testProcedure) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${testGroupId}/cases/${tid}`,
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
        `/api/test-groups/${testGroupId}/cases/${tid}`
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    if (first_layer.length > maxLength || second_layer.length > maxLength || third_layer.length > maxLength || fourth_layer.length > maxLength || purpose.length > maxLength || request_id.length > maxLength) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${testGroupId}/cases/${tid}`,
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
        `/api/test-groups/${testGroupId}/cases/${tid}`
      );
    }

    // トランザクション開始
    const updateTimer = new QueryTimer();
    const testCase = await prisma.$transaction(async (tx) => {
      // tt_test_casesの値を更新
      const updateTestCase = await tx.tt_test_cases.update({
        where: {
          test_group_id_tid: {
            test_group_id: testGroupId,
            tid: tid
          }
        },
        data: {
          first_layer: first_layer,
          second_layer: second_layer,
          third_layer: third_layer,
          fourth_layer: fourth_layer,
          purpose: purpose,
          request_id: request_id,
          check_items: checkItems,
          test_procedure: testProcedure
        }
      });

      // 削除されたテスト内容を削除
      for (const deletedContent of deletedContents) {
        await tx.tt_test_contents.deleteMany({
          where: {
            test_group_id: testGroupId,
            tid: tid,
            test_case_no: deletedContent.testCaseNo
          }
        });
      }

      // ファイルは既にアップロードAPIで登録済みなので、ここでは何もしない
      // controlSpecFileIds, dataFlowFileIds は確認用に保持

      // 使用可能なtest_case_noをtestContentIdsに格納済み
      let testCaseNo = 0;
      for (const content of testContents) {
        await tx.tt_test_contents.upsert({
          where: {
            test_group_id_tid_test_case_no: {
              test_group_id: testGroupId,
              tid: tid,
              test_case_no: testContentIds[testCaseNo],
            }
          },
          update: {
            test_case: content.testCase,
            expected_value: content.expectedValue,
            is_target: content.is_target
          },
          create: {
            test_group_id: testGroupId,
            tid: tid,
            test_case_no: testContentIds[testCaseNo] || null,
            test_case: content.testCase || null,
            expected_value: content.expectedValue || null,
            is_target: content.is_target || null,
            tt_test_cases: {
              connect: {
                test_group_id_tid: {
                  test_group_id: testGroupId,
                  tid: tid
                }
              }
            }
          }
        })
        testCaseNo++;
      }
      return updateTestCase;
    });

    logDatabaseQuery({
      operation: 'UPDATE',
      table: 'tt_test_cases',
      executionTime: updateTimer.elapsed(),
      rowsAffected: 1,
      query: 'update',
      params: [
        first_layer,
        second_layer,
        third_layer,
        fourth_layer,
        purpose,
        request_id,
        checkItems,
        testProcedure
      ]
    });

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${testGroupId}/cases/${tid}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json({ success: true, data: testCase });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'PUT',
      `/api/test-groups/${testGroupId}/cases/${tid}`,
    )
  }
}

// DELETE /api/test-groups/[groupId]/cases/[tid] - テストケース削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; tid: string }> }
) {
  const apiTimer = new QueryTimer();
  const { groupId: groupIdParam, tid } = await params;

  try {
    const user = await requireAuth(req);
    // テストグループIDの形式チェック
    if (isNaN(parseInt(groupIdParam))) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_GROUP_ID),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupIdParam}/cases/${tid}`
      );
    }

    // TIDの形式チェック
    const tidPattern = /^([1-9][0-9]{0,2}-){3}[1-9][0-9]{0,2}$/;
    if (!tidPattern.test(tid)) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_TID),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupIdParam}/cases/${tid}`
      );
    }
    const groupId = parseInt(groupIdParam, 10);

    // ユーザが管理者または削除権限があるかチェック
    const canModify = await canEditTestCases(user, groupId);

    if (!canModify) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupIdParam}/cases/${tid}`
      );
    }

    // テストグループ存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: groupId },
    });

    if (!testGroup || testGroup.is_deleted) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupIdParam}/cases/${tid}`
      );
    }

    // テストケース存在確認
    const testCase = await prisma.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: groupId,
          tid,
        },
        is_deleted: false,
      },
    });

    if (!testCase || testCase.is_deleted) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupIdParam}/cases/${tid}`
      );
    }
    const deleteDir = join(process.cwd(), 'public', 'uploads', 'test-cases', String(groupId), tid);
    await rm(deleteDir, { recursive: true, force: true })

    const deleteTimer = new QueryTimer();
    // Prisma トランザクション内でテストケースを削除
    const deleteTestCase = await prisma.$transaction(async (tx) => {
      // tidに一致するレコードを削除
      await tx.tt_test_evidences.deleteMany({
        where: {
          test_group_id: groupId,
          tid: tid,
        }
      });

      await tx.tt_test_results_history.deleteMany({
        where: {
          test_group_id: groupId,
          tid: tid,
        }
      });

      await tx.tt_test_results.deleteMany({
        where: {
          test_group_id: groupId,
          tid: tid,
        }
      });

      await tx.tt_test_contents.deleteMany({
        where: {
          test_group_id: groupId,
          tid: tid,
        }
      });

      await tx.tt_test_case_files.deleteMany({
        where: {
          test_group_id: groupId,
          tid: tid,
        }
      });

      await tx.tt_test_cases.deleteMany({
        where: {
          test_group_id: groupId,
          tid: tid,
        }
      })
    },
      {
        maxWait: 10000,
        timeout: 15000,
      });
    logDatabaseQuery({
      operation: 'DELETE',
      table: 'tt_test_cases',
      executionTime: deleteTimer.elapsed(),
      query: 'delete',
      params: [
        {
          tid: tid
        }
      ]
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/test-groups/${groupIdParam}/cases/${tid}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });
    return NextResponse.json({ success: true, data: deleteTestCase }, { status: STATUS_CODES.OK })
  } catch (error) {
    handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      `/api/test-groups/${groupIdParam}/cases/${tid}`
    );
  }
}