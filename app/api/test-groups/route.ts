import { canModifyTestGroup, getAccessibleTestGroups, isAdmin, isTestManager, requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import type { Prisma } from '@/generated/prisma/client';
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/test-groups - アクセス可能なテストグループを取得
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.OK;
  try {
    const user = await requireAuth(req);
    // アクセス可能なテストグループのIDを取得
    const accessibleIds = await getAccessibleTestGroups(user.id, user.user_role);

    if (accessibleIds.length === 0) {
      logAPIEndpoint({
        method: 'GET',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode: STATUS_CODES.OK,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
        queryParams: new URLSearchParams(req.url.split('?')[1]),
      });
      return NextResponse.json({ success: true, data: [], totalCount: 0 });
    }

    // クエリ文字列から検索パラメータを取得
    const { searchParams } = new URL(req.url);
    const oem = searchParams.get('oem') || '';
    const model = searchParams.get('model') || '';
    const event = searchParams.get('event') || '';
    const variation = searchParams.get('variation') || '';
    const destination = searchParams.get('destination') || '';

    // ページネーションパラメータを取得
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // Prisma の where 条件を構築
    const whereConditions: Prisma.tt_test_groupsWhereInput = {
      id: {
        in: accessibleIds,
      },
      is_deleted: false,
    };

    if (oem) {
      whereConditions.oem = {
        contains: oem,
        mode: 'insensitive',
      };
    }

    if (model) {
      whereConditions.model = {
        contains: model,
        mode: 'insensitive',
      };
    }

    if (event) {
      whereConditions.event = {
        contains: event,
        mode: 'insensitive',
      };
    }

    if (variation) {
      whereConditions.variation = {
        contains: variation,
        mode: 'insensitive',
      };
    }

    if (destination) {
      whereConditions.destination = {
        contains: destination,
        mode: 'insensitive',
      };
    }

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/test-groups',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
      queryParams: searchParams,
    });

    // 合計件数を取得
    const countTimer = new QueryTimer();
    const totalCount = await prisma.tt_test_groups.count({
      where: whereConditions,
    });

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      userId: user.id,
      executionTime: countTimer.elapsed(),
      rowsReturned: 1,
      query: 'COUNT(*)',
      params: Object.entries(whereConditions),
    });

    // ページネーション付きでテストグループを取得
    const dataTimer = new QueryTimer();
    const testGroups = await prisma.tt_test_groups.findMany({
      where: whereConditions,
      orderBy: {
        updated_at: 'desc',
      },
      skip: offset,
      take: limit,
    });

    // 各テストグループに対してcanModifyTestGroupをチェック
    const testGroupsWithCanModify = await Promise.all(testGroups.map(async (group) => {
      const isCanModify = await canModifyTestGroup(user, group.id);
      return { ...group, isCanModify };
    }));

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      userId: user.id,
      executionTime: dataTimer.elapsed(),
      rowsReturned: testGroups.length,
      query: 'findMany',
      params: [{ skip: offset, take: limit }],
    });

    statusCode = STATUS_CODES.OK;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/test-groups',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: testGroupsWithCanModify.length,
      queryParams: searchParams,
    });

    return NextResponse.json({ success: true, data: testGroupsWithCanModify, totalCount });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      '/api/test-groups'
    );
  }
}

// POST /api/test-groups - 新しいテストグループを作成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = STATUS_CODES.CREATED;

  try {
    const user = await requireAuth(req);

    // ユーザーが管理者またはテスト管理者かどうかを確認
    if (!isAdmin(user) && !isTestManager(user)) {
      statusCode = STATUS_CODES.FORBIDDEN;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.PERMISSION_DENIED,
      });

      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'POST',
        '/api/test-groups'
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
      tag_names, // { tag_name, test_role } の配列
    } = body;

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/test-groups',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
      queryParams: new URLSearchParams(req.url.split('?')[1]),
    });

    // 必須フィールドをバリデーション
    if (!oem || !model || !event || !variation || !destination || !specs || !test_startdate || !test_enddate || ng_plan_count === undefined || ng_plan_count === null) {
      statusCode = STATUS_CODES.BAD_REQUEST;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS,
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/test-groups'
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    if (oem.length > maxLength || model.length > maxLength || event.length > maxLength ||
      variation.length > maxLength || destination.length > maxLength) {
      statusCode = STATUS_CODES.BAD_REQUEST;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH,
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/test-groups'
      );
    }

    // 不具合摘出予定数をバリデーション
    if (typeof ng_plan_count !== 'number' || ng_plan_count < 0 || ng_plan_count > 9999) {
      statusCode = STATUS_CODES.BAD_REQUEST;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_NG_PLAN_COUNT,
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_NG_PLAN_COUNT),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/test-groups'
      );
    }

    // 日付の大小関係をバリデーション
    if (test_startdate && test_enddate) {
      const startDate = new Date(test_startdate);
      const endDate = new Date(test_enddate);
      if (startDate > endDate) {
        statusCode = STATUS_CODES.BAD_REQUEST;
        logAPIEndpoint({
          method: 'POST',
          endpoint: '/api/test-groups',
          userId: user.id,
          statusCode,
          executionTime: apiTimer.elapsed(),
          error: ERROR_MESSAGES.VALIDATION_ERROR_DATE,
        });
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_DATE),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          '/api/test-groups'
        );
      }
    }

    // Prisma トランザクション内でテストグループを作成
    const testGroup = await prisma.$transaction(async (tx) => {
      // テストグループを新規作成
      const insertTimer = new QueryTimer();
      const newGroup = await tx.tt_test_groups.create({
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
          updated_by: user.id,
        },
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
                test_group_id: newGroup.id,
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
                  test_group_id: newGroup.id,
                  tag_id: foundTag.id,
                  test_role: tag.test_role,
                },
              ],
            });
          }
        }
      }

      return newGroup;
    });

    statusCode = STATUS_CODES.CREATED;
    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/test-groups',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({ success: true, data: testGroup }, { status: STATUS_CODES.CREATED });
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