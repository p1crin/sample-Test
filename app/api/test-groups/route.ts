import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAdmin, isTestManager, getAccessibleTestGroups } from '@/app/lib/auth';
import { query, getAllRows, transaction } from '@/app/lib/db';
import { TestGroup, UserRole } from '@/types';
import serverLogger from '@/utils/server-logger';
import { logDatabaseQuery, logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { formatDate } from '@/utils/date-formatter';

// GET /api/test-groups - Get all accessible test groups
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);

    // Get accessible test group IDs
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

    // Get search parameters from query string
    const { searchParams } = new URL(req.url);
    const oem = searchParams.get('oem') || '';
    const model = searchParams.get('model') || '';
    const event = searchParams.get('event') || '';
    const variation = searchParams.get('variation') || '';
    const destination = searchParams.get('destination') || '';

    // Get pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clause
    const whereConditions = ['id = ANY($1)', 'is_deleted = FALSE'];
    const params: unknown[] = [accessibleIds];
    let paramIndex = 2;

    if (oem) {
      whereConditions.push(`oem ILIKE $${paramIndex}`);
      params.push(`%${oem}%`);
      paramIndex++;
    }

    if (model) {
      whereConditions.push(`model ILIKE $${paramIndex}`);
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (event) {
      whereConditions.push(`event ILIKE $${paramIndex}`);
      params.push(`%${event}%`);
      paramIndex++;
    }

    if (variation) {
      whereConditions.push(`variation ILIKE $${paramIndex}`);
      params.push(`%${variation}%`);
      paramIndex++;
    }

    if (destination) {
      whereConditions.push(`destination ILIKE $${paramIndex}`);
      params.push(`%${destination}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Fetch total count for pagination
    const countQuery = `SELECT COUNT(*) as count
       FROM tt_test_groups
       WHERE ${whereClause}`;
    const countTimer = new QueryTimer();
    const countResult = await query<{ count: string | number }>(countQuery, params);
    const totalCount = parseInt(String(countResult.rows[0]?.count || '0'), 10);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      executionTime: countTimer.elapsed(),
      rowsReturned: 1,
      query: countQuery,
      params,
    });

    // Fetch test groups with pagination
    const dataParams = [...params, limit, offset];
    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    const dataQuery = `SELECT id, oem, model, event, variation, destination, specs,
              test_startdate, test_enddate, ng_plan_count, created_by, updated_by,
              created_at, updated_at
       FROM tt_test_groups
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

    const dataTimer = new QueryTimer();
    const result = await query<TestGroup>(dataQuery, dataParams);
    const testGroups = getAllRows(result);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_groups',
      executionTime: dataTimer.elapsed(),
      rowsReturned: testGroups.length,
      query: dataQuery,
      params: dataParams,
    });

    // 日付をフォーマット（日本時間）
    const formattedTestGroups = testGroups.map((group: TestGroup) => ({
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

// POST /api/test-groups - Create new test group
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 201;

  try {
    const user = await requireAuth(req);

    // Check if user is admin or test manager
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
      tag_names, // Array of { tag_name, test_role }
    } = body;

    serverLogger.debug('POST /api/test-groups Request', {
      oem,
      model,
      event,
      variation,
      destination,
      tagCount: tag_names?.length || 0,
    });

    // Validate required fields
    if (!oem || !model) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/test-groups',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: OEM and model are required',
      });
      return NextResponse.json(
        { success: false, error: { message: 'OEMとモデルは必須です' } },
        { status: 400 }
      );
    }

    // Create test group in transaction
    const testGroup = await transaction(async (client) => {
      // Insert test group
      const insertQuery = `INSERT INTO tt_test_groups
         (oem, model, event, variation, destination, specs, test_startdate, test_enddate, ng_plan_count, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING *`;

      const insertParams = [
        oem,
        model,
        event || '',
        variation || '',
        destination || '',
        specs || '',
        test_startdate || null,
        test_enddate || null,
        ng_plan_count || 0,
        user.id.toString(),
      ];

      const insertTimer = new QueryTimer();
      const result = await client.query<TestGroup>(insertQuery, insertParams);
      const newGroup = result.rows[0];

      logDatabaseQuery({
        operation: 'INSERT',
        table: 'tt_test_groups',
        executionTime: insertTimer.elapsed(),
        rowsAffected: 1,
        query: insertQuery,
        params: insertParams,
      });

      // Insert test group tags if provided
      if (tag_names && Array.isArray(tag_names) && tag_names.length > 0) {
        for (const tag of tag_names) {
          // Get tag ID from tag name
          const tagLookupQuery = `SELECT id FROM mt_tags WHERE name = $1 AND is_deleted = FALSE`;
          const tagLookupTimer = new QueryTimer();
          const tagResult = await client.query(tagLookupQuery, [tag.tag_name]);

          logDatabaseQuery({
            operation: 'SELECT',
            table: 'mt_tags',
            executionTime: tagLookupTimer.elapsed(),
            rowsReturned: tagResult.rows.length,
            query: tagLookupQuery,
            params: [tag.tag_name],
          });

          if (tagResult.rows.length > 0) {
            const tagId = tagResult.rows[0].id;
            const tagInsertQuery = `INSERT INTO tt_test_group_tags (test_group_id, tag_id, test_role)
               VALUES ($1, $2, $3)`;
            const tagInsertParams = [newGroup.id, tagId, tag.test_role];

            const tagInsertTimer = new QueryTimer();
            await client.query(tagInsertQuery, tagInsertParams);

            logDatabaseQuery({
              operation: 'INSERT',
              table: 'tt_test_group_tags',
              executionTime: tagInsertTimer.elapsed(),
              rowsAffected: 1,
              query: tagInsertQuery,
              params: tagInsertParams,
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