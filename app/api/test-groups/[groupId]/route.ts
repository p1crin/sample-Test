import { canModifyTestGroup, canViewTestGroup, requireAdminOrTestManager, requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { deleteDirectory } from '@/app/lib/storage';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import serverLogger from '@/utils/server-logger';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

interface RouteParams {
  params: Promise<{ groupId: string }>;
}

// GET /api/test-groups/[groupId] - テストグループ詳細取得
export async function GET(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { groupId } = await params;

  try {
    const user = await requireAuth(req);
    // テストグループIDが数値でないとき400エラー
    if (isNaN(parseInt(groupId, 10))) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}`
      );
    }
    const canView = await canViewTestGroup(user.id, user.user_role, parseInt(groupId, 10));

    // 閲覧権限のテストグループ取得時は403エラー
    if (!canView) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}`
      )
    }

    const queryTimer = new QueryTimer();
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: {
        id: parseInt(groupId, 10),
        is_deleted: false,
      },
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      executionTime: queryTimer.elapsed(),
      rowsReturned: testGroup ? 1 : 0,
      query: 'findUnique',
      params: [{ id: groupId, is_deleted: false }],
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}`
      );
    }

    const tagsTimer = new QueryTimer();
    const tagsResult = await prisma.tt_test_group_tags.findMany({
      where: {
        test_group_id: parseInt(groupId, 10),
        mt_tags: {
          is_deleted: false,
        },
      },
      include: {
        mt_tags: true,
      },
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_group_tags',
      executionTime: tagsTimer.elapsed(),
      rowsReturned: tagsResult.length,
      query: 'findMany',
      params: [{ test_group_id: groupId, mt_tags: { is_deleted: false } }],
    });

    const formattedTags = tagsResult.map(tag => ({
      tag_id: tag.tag_id,
      tag_name: tag.mt_tags.name,
      test_role: tag.test_role,
    }));

    logAPIEndpoint({
      method: 'GET',
      endpoint: `/api/test-groups/${parseInt(groupId, 10)}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...testGroup,
        tags: formattedTags,
      },
    });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}`
    );
  }
}

// PUT /api/test-groups/[groupId] - テストグループ更新
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { groupId } = await params;

  // テストグループIDが数値でないとき400エラー
  if (isNaN(parseInt(groupId, 10))) {
    return handleError(
      new Error(ERROR_MESSAGES.BAD_REQUEST),
      STATUS_CODES.BAD_REQUEST,
      apiTimer,
      'GET',
      `/api/test-groups/${groupId}`
    );
  }

  try {
    const user = await requireAuth(req);

    // テストグループIDが数値でないとき400エラー
    if (isNaN(parseInt(groupId))) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'GET',
        `/api/test-groups/${groupId}`
      );
    }
    // ユーザーが管理者またはテストグループを閲覧する権限があるかどうかをチェック
    const canModify = await canModifyTestGroup(user, parseInt(groupId, 10));

    if (!canModify) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'PUT',
        `/api/test-groups/${groupId}`
      );
    }

    const body = await req.json();
    const {
      oem,
      model,
      event,
      variation,
      destination,
      specs,
      test_startdate,
      test_enddate,
      ng_plan_count,
      tag_names,
    } = body;

    serverLogger.info(`PUT /api/test-groups/${parseInt(groupId, 10)} リクエスト`, {
      oem,
      model,
      event,
      variation,
      destination,
      tagCount: tag_names?.length || 0
    });

    // 必須フィールドをバリデーション
    if (!oem || !model || !event || !variation || !destination || !specs || !test_startdate || !test_enddate || ng_plan_count === undefined || ng_plan_count === null) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}`,
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
        `/api/test-groups/${groupId}`
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    if (oem.length > maxLength || model.length > maxLength || event.length > maxLength ||
      variation.length > maxLength || destination.length > maxLength) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH
      });

      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/test-groups/${groupId}`
      );
    }

    // 不具合摘出予定数をバリデーション
    if (typeof ng_plan_count !== 'number' || ng_plan_count < 0 || ng_plan_count > 9999) {
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_NG_PLAN_COUNT
      });

      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_NG_PLAN_COUNT),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'PUT',
        `/api/test-groups/${groupId}`
      );
    }

    // 日付の大小関係をバリデーション
    if (test_startdate && test_enddate) {
      const startDate = new Date(test_startdate);
      const endDate = new Date(test_enddate);
      if (startDate > endDate) {
        logAPIEndpoint({
          method: 'PUT',
          endpoint: `/api/test-groups/${groupId}`,
          userId: user.id,
          statusCode: STATUS_CODES.BAD_REQUEST,
          executionTime: apiTimer.elapsed(),
          error: ERROR_MESSAGES.VALIDATION_ERROR_DATE
        });
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_DATE),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'PUT',
          `/api/test-groups/${groupId}`
        );
      }
    }

    const updateTimer = new QueryTimer();
    // Prisma トランザクション内でテストグループを更新
    const testGroup = await prisma.$transaction(async (tx) => {
      // テストグループの内容を更新
      const updateGroup = await tx.tt_test_groups.update({
        where: {
          id: parseInt(groupId, 10)
        },
        data: {
          oem,
          model,
          event,
          variation,
          destination,
          specs,
          test_startdate: new Date(test_startdate),
          test_enddate: new Date(test_enddate),
          ng_plan_count,
          updated_by: user.id,
        }
      });

      // タグが指定されている場合はテストグループタグを関連付け
      if (tag_names && Array.isArray(tag_names) && tag_names.length > 0) {
        // 既存のタグ情報の削除
        await tx.tt_test_group_tags.deleteMany({
          where: {
            test_group_id: parseInt(groupId, 10)
          }
        });

        for (const tag of tag_names) {
          // タグからタグIDを取得
          const foundTag = await tx.mt_tags.findUnique({
            where: {
              name: tag.tag_name,
              is_deleted: false
            }
          });

          if (foundTag) {
            await tx.tt_test_group_tags.createMany({
              data: {
                test_group_id: updateGroup.id,
                tag_id: foundTag.id,
                test_role: tag.test_role
              },
            });
          }
        }
      }
      return updateGroup;
    });

    logDatabaseQuery({
      operation: 'UPDATE',
      table: 'tt_test_groups',
      executionTime: updateTimer.elapsed(),
      rowsAffected: 1,
      query: 'update',
      params: [
        {
          oem,
          model,
          event,
          variation,
          destination,
          specs,
          test_startdate,
          test_enddate,
          ng_plan_count,
          updated_by: user.id,
        }
      ]
    });

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${parseInt(groupId, 10)}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });
    return NextResponse.json({ success: true, data: testGroup }, { status: STATUS_CODES.CREATED });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'PUT',
      `/api/test-groups/${groupId}`);
  }
}

// DELETE /api/test-groups/[groupId] - テストグループ削除
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.OK;
  const { groupId } = await params;

  try {
    const user = await requireAuth(req);

    // テストグループIDが数値でないとき400エラー
    if (isNaN(parseInt(groupId, 10))) {
      return handleError(
        new Error(ERROR_MESSAGES.INVALID_GROUP_ID),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupId}`
      );
    }

    // ユーザーが管理者またはテストグループを変更(削除)する権限があるかどうかをチェック
    const canModify = await canModifyTestGroup(user, parseInt(groupId, 10));

    if (!canModify) {
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupId}`
      );
    }
    // テストグループ存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: parseInt(groupId, 10) },
    });

    if (!testGroup || testGroup.is_deleted) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        `/api/test-groups/${groupId}`,
      );
    }
    // 紐づいているファイルの削除（制御仕様書、データフロー、エビデンス）
    // S3/ローカルの両方に対応
    await Promise.all([
      deleteDirectory(`/uploads/test-cases/${groupId}`, user.id),  // 制御仕様書・データフロー
      deleteDirectory(`/evidences/${groupId}`, user.id),            // エビデンス
    ]);

    const deleteTimer = new QueryTimer();
    // Prisma トランザクション内でテストグループを削除
    const deleteGroup = await prisma.$transaction(async (tx) => {
      // groupIdに一致するレコードを削除
      await tx.tt_test_evidences.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10),
        }
      });

      await tx.tt_test_results_history.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10),
        }
      });

      await tx.tt_test_results.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10)
        }
      });

      await tx.tt_test_contents.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10)
        }
      });

      await tx.tt_test_case_files.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10)
        }
      });

      await tx.tt_test_cases.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10)
        }
      })

      await tx.tt_test_group_tags.deleteMany({
        where: {
          test_group_id: parseInt(groupId, 10)
        }
      });

      await tx.tt_test_groups.delete({
        where: {
          id: parseInt(groupId, 10)
        }
      });
    },
      {
        maxWait: 10000,
        timeout: 15000,
      });

    logDatabaseQuery({
      operation: 'DELETE',
      table: 'tt_test_groups',
      executionTime: deleteTimer.elapsed(),
      rowsAffected: 1,
      query: 'delete',
      params: [
        {
          id: parseInt(groupId, 10)
        }
      ]
    });

    statusCode = STATUS_CODES.OK;
    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/test-groups/${groupId}`,
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json({ success: true, data: deleteGroup }, { status: STATUS_CODES.OK });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      `/api/test-groups/${groupId}`
    );
  }
}

// POST /api/test-groups/[groupId] - テストグループ複製
export async function POST(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  const { groupId } = await params;
  const testGroupId = parseInt(groupId, 10);

  try {
    // テストグループIDが数値でないとき400エラー
    if (isNaN(testGroupId)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${testGroupId}`
      );
    }

    // ユーザーが管理者またはテストグループを複製する権限があるかどうかをチェック
    const user = await requireAdminOrTestManager(req);

    const body = await req.json();
    const {
      oem,
      model,
      event,
      variation,
      destination,
      specs,
      test_startdate,
      test_enddate,
      ng_plan_count,
      tag_names, // { tag_name, test_role } の配列
    } = body;

    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${testGroupId}`,
      userId: user.id,
      executionTime: apiTimer.elapsed(),
    });

    // 必須フィールドをバリデーション
    if (!oem || !model || !event || !variation || !destination || !specs || !test_startdate || !test_enddate || ng_plan_count === undefined || ng_plan_count === null) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${testGroupId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS,
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${testGroupId}`
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    if (oem.length > maxLength || model.length > maxLength || event.length > maxLength ||
      variation.length > maxLength || destination.length > maxLength) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${testGroupId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH,
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${testGroupId}`
      );
    }

    // 不具合摘出予定数をバリデーション
    if (typeof ng_plan_count !== 'number' || ng_plan_count < 0 || ng_plan_count > 9999) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: `/api/test-groups/${testGroupId}`,
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_NG_PLAN_COUNT,
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_NG_PLAN_COUNT),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        `/api/test-groups/${testGroupId}`
      );
    }

    // 日付の大小関係をバリデーション
    if (test_startdate && test_enddate) {
      const startDate = new Date(test_startdate);
      const endDate = new Date(test_enddate);
      if (startDate > endDate) {
        logAPIEndpoint({
          method: 'POST',
          endpoint: `/api/test-groups/${testGroupId}`,
          userId: user.id,
          statusCode: STATUS_CODES.BAD_REQUEST,
          executionTime: apiTimer.elapsed(),
          error: ERROR_MESSAGES.VALIDATION_ERROR_DATE,
        });
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_DATE),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          `/api/test-groups/${testGroupId}`
        );
      }
    }

    // Prisma トランザクション内でテストグループを作成
    const testGroupCopy = await prisma.$transaction(async (tx) => {
      // テストグループを新規作成
      const insertTimer = new QueryTimer();
      const newTestGroup = await tx.tt_test_groups.create({
        data: {
          oem,
          model,
          event,
          variation,
          destination,
          specs,
          test_startdate: new Date(test_startdate),
          test_enddate: new Date(test_enddate),
          ng_plan_count,
          created_by: user.id,
          updated_by: user.id
        }
      });

      logDatabaseQuery({
        operation: 'INSERT',
        table: 'tt_test_groups',
        executionTime: insertTimer.elapsed(),
        rowsAffected: 1,
        query: 'create',
        params: [
          {
            oem,
            model,
            event,
            variation,
            destination,
            specs,
            test_startdate,
            test_enddate,
            ng_plan_count,
            created_by: user.id,
            updated_by: user.id,
          },
        ],
      });

      // タグが指定されている場合はテストグループタグを関連付け
      if (tag_names && Array.isArray(tag_names) && tag_names.length > 0) {
        for (const tag of tag_names) {
          // タグ名からタグIDを取得
          const tagLookupTimer = new QueryTimer();
          const foundTag = await tx.mt_tags.findUnique({
            where: {
              name: tag.tag_name,
              is_deleted: false,
            },
          });

          logDatabaseQuery({
            operation: 'SELECT',
            table: 'mt_tags',
            executionTime: tagLookupTimer.elapsed(),
            rowsReturned: foundTag ? 1 : 0,
            query: 'findUnique',
            params: [{ name: tag.tag_name }],
          });

          if (foundTag) {
            const tagInsertTimer = new QueryTimer();
            await tx.tt_test_group_tags.create({
              data: {
                test_group_id: newTestGroup.id,
                tag_id: foundTag.id,
                test_role: tag.test_role,
              },
            });

            logDatabaseQuery({
              operation: 'INSERT',
              table: 'tt_test_group_tags',
              executionTime: tagInsertTimer.elapsed(),
              rowsAffected: 1,
              query: 'create',
              params: [
                {
                  test_group_id: newTestGroup.id,
                  tag_id: foundTag.id,
                  test_role: tag.test_role,
                },
              ],
            });

          }

        }
      }

      // 複製したテストグループに紐づくテストケースをコピー
      const testCasesCopy = await tx.tt_test_cases.findMany({
        where: {
          test_group_id: testGroupId,
          is_deleted: false
        }
      });

      for (const testCase of testCasesCopy) {
        // コピー元のcreated_at, updated_atの除去
        const { created_at, updated_at, ...filteredTestCase } = testCase;

        await tx.tt_test_cases.create({
          data: {
            ...filteredTestCase,
            test_group_id: newTestGroup.id,
          }
        });
      }

      // 複製したテストグループに紐づくテストケースのファイル情報をコピー
      const testCasesfilesCopy = await tx.tt_test_case_files.findMany({
        where: {
          test_group_id: testGroupId,
          is_deleted: false
        }
      });

      for (const file of testCasesfilesCopy) {
        // ファイル保存処理
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'test-cases', String(newTestGroup.id), file.tid);

        // ディレクトリが存在しない場合は作成
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }

        // ファイル名生成
        const filePath = file.file_path;
        const splitPath = filePath?.split('/');
        const newFilePath = splitPath?.pop();

        // コピー元のcreated_at, updated_atの除去
        const { created_at, updated_at, ...filteredFile } = file;

        await tx.tt_test_case_files.create({
          data: {
            ...filteredFile,
            test_group_id: newTestGroup.id,
            file_path: `/uploads/test-cases/${newTestGroup.id}/${file.tid}/${newFilePath}`
          }
        });
      }

      // 複製したテストグループに紐づくテスト内容をコピー
      const testContentsCopy = await tx.tt_test_contents.findMany({
        where: {
          test_group_id: testGroupId,
          is_deleted: false
        }
      });

      for (const content of testContentsCopy) {
        // コピー元のcreated_at, updated_atの除去
        const { created_at, updated_at, ...filteredContent } = content;

        await tx.tt_test_contents.create({
          data: {
            ...filteredContent,
            test_group_id: newTestGroup.id,
          }
        });
      }

      // 複製したテストグループに紐づくテスト結果をコピー
      const testResultsCopy = await tx.tt_test_results.findMany({
        where: {
          test_group_id: testGroupId,
          is_deleted: false
        }
      });

      for (const result of testResultsCopy) {
        // コピー元のcreated_at, updated_atの除去
        const { created_at, updated_at, ...filteredResult } = result;

        await tx.tt_test_results.create({
          data: {
            ...filteredResult,
            test_group_id: newTestGroup.id,
          }
        });
      }

      // 複製したテストグループに紐づくテスト結果履歴をコピー
      const testResultsHistoryCopy = await tx.tt_test_results_history.findMany({
        where: {
          test_group_id: testGroupId,
          is_deleted: false
        }
      });

      for (const resultHistory of testResultsHistoryCopy) {
        // コピー元のcreated_at, updated_atの除去
        const { created_at, updated_at, ...filteredResultHistory } = resultHistory;

        await tx.tt_test_results_history.create({
          data: {
            ...filteredResultHistory,
            test_group_id: newTestGroup.id,
          }
        });
      }

      // 複製したテストグループに紐づくテストエビデンスをコピー
      const testEvidencesCopy = await tx.tt_test_evidences.findMany({
        where: {
          test_group_id: testGroupId,
          is_deleted: false
        }
      });

      for (const evidences of testEvidencesCopy) {
        // ファイル保存処理
        const uploadDir = join(process.cwd(), 'public', 'evidences', String(newTestGroup.id), evidences.tid);

        // ディレクトリが存在しない場合は作成
        if (!existsSync(uploadDir)) {
          await mkdir(uploadDir, { recursive: true });
        }

        // パス名生成
        const evidencesPath = evidences.evidence_path;
        const splitPath = evidencesPath?.split('/');
        const newEvidencesPath = splitPath?.pop();

        // コピー元のcreated_at, updated_atの除去
        const { created_at, updated_at, ...filteredEvidences } = evidences;

        await tx.tt_test_evidences.create({
          data: {
            ...filteredEvidences,
            test_group_id: newTestGroup.id,
            evidence_path: `/evidences/${newTestGroup.id}/${evidences.tid}/${newEvidencesPath}`
          }
        });
      }

      return newTestGroup;
    });

    logAPIEndpoint({
      method: 'POST',
      endpoint: `/api/test-groups/${groupId}`,
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json(
      { success: true, data: testGroupCopy },
      { status: STATUS_CODES.CREATED }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/test-groups'
    );
  }
}
