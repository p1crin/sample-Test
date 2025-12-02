/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin, isTestManager, getAccessibleTestGroups } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import serverLogger from '@/utils/server-logger';
import { logDatabaseQuery, logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { formatDate } from '@/utils/date-formatter';

// GET /api/test-groups - アクセス可能なテストグループを取得
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);

    // アクセス可能なテストグループのIDを取得
    const accessibleIds = await getAccessibleTestGroups(user.id, user.user_role);

    if (accessibleIds.length === 0) {
      logAPIEndpoint({
        method: 'GET',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode: 200,
        executionTime: apiTimer.elapsed(),
        dataSize: 0,
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
    const whereConditions: Record<string, unknown> = {
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

    // 合計件数を取得
    const countTimer = new QueryTimer();
    const totalCount = await prisma.tt_test_groups.count({
      where: whereConditions,
    } as any);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      executionTime: countTimer.elapsed(),
      rowsReturned: 1,
      query: 'COUNT(*)',
      params: Object.entries(whereConditions),
    });

    // ページネーション付きでテストグループを取得
    const dataTimer = new QueryTimer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const testGroups = await prisma.tt_test_groups.findMany({
      where: whereConditions,
      orderBy: {
        created_at: 'desc',
      },
      skip: offset,
      take: limit,
    } as any);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      executionTime: dataTimer.elapsed(),
      rowsReturned: testGroups.length,
      query: 'findMany',
      params: [{ skip: offset, take: limit }],
    });

    // 日付をフォーマット（日本時間）
    const formattedTestGroups = testGroups.map((group: typeof testGroups[0]) => ({
      ...group,
      created_at: formatDate(group.created_at, 'YYYY/MM/DD HH:mm:ss'),
      updated_at: formatDate(group.updated_at, 'YYYY/MM/DD HH:mm:ss'),
    }));

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/test-groups',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: formattedTestGroups.length,
    });

    return NextResponse.json({ success: true, data: formattedTestGroups, totalCount });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/test-groups',
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
      { error: 'テストグループの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST /api/test-groups - 新しいテストグループを作成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 201;

  try {
    const user = await requireAuth(req);

    // ユーザーが管理者またはテスト管理者かどうかを確認
    if (!isAdmin(user) && !isTestManager(user)) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'テストグループを作成する権限がありません' },
        { status: 403 }
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

    serverLogger.debug('POST /api/test-groups リクエスト', {
      oem,
      model,
      event,
      variation,
      destination,
      tagCount: tag_names?.length || 0,
    });

    // 必須フィールドをバリデーション
    if (!oem || !model || !event || !variation || !destination || !specs || !test_startdate || !test_enddate || ng_plan_count === undefined || ng_plan_count === null) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: Required fields are missing',
      });
      return NextResponse.json(
        { success: false, error: { message: 'すべての必須フィールドを入力してください' } },
        { status: 400 }
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    if (oem.length > maxLength || model.length > maxLength || event.length > maxLength ||
        variation.length > maxLength || destination.length > maxLength) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: Field length exceeds maximum',
      });
      return NextResponse.json(
        { success: false, error: { message: `OEM、機種、イベント、バリエーション、仕向は${maxLength}文字以内で入力してください` } },
        { status: 400 }
      );
    }

    // 不具合摘出予定数をバリデーション
    if (typeof ng_plan_count !== 'number' || ng_plan_count < 0 || ng_plan_count > 9999) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: ng_plan_count out of range',
      });
      return NextResponse.json(
        { success: false, error: { message: '不具合摘出予定数は最大9999件です' } },
        { status: 400 }
      );
    }

    // 日付の大小関係をバリデーション
    if (test_startdate && test_enddate) {
      const startDate = new Date(test_startdate);
      const endDate = new Date(test_enddate);
      if (startDate > endDate) {
        statusCode = 400;
        logAPIEndpoint({
          method: 'POST',
          endpoint: '/api/test-groups',
          userId: user.id,
          statusCode,
          executionTime: apiTimer.elapsed(),
          error: 'Validation error: test_startdate must be before test_enddate',
        });
        return NextResponse.json(
          { success: false, error: { message: '試験開始日は試験終了日以前である必要があります' } },
          { status: 400 }
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
          event: event || '',
          variation: variation || '',
          destination: destination || '',
          specs: specs || '',
          test_startdate: test_startdate ? new Date(test_startdate) : null,
          test_enddate: test_enddate ? new Date(test_enddate) : null,
          ng_plan_count: ng_plan_count || 0,
          created_by: user.id.toString(),
          updated_by: user.id.toString(),
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
          const foundTag = await tx.mt_tags.findFirst({
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
            query: 'findFirst',
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

    statusCode = 201;
    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/test-groups',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({ success: true, data: testGroup }, { status: 201 });
  } catch (error) {
    // エラーが認証エラーの場合は401、その他は500
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/test-groups',
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
      { error: 'テストグループの作成に失敗しました' },
      { status: 500 }
    );
  }
}