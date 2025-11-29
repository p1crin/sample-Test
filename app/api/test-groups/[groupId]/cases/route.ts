import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canViewTestGroup, canEditTestCases } from '@/app/lib/auth';
import { query, getAllRows, transaction } from '@/app/lib/db';
import { logDatabaseQuery, logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import serverLogger from '@/utils/server-logger';

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

    // Check view permission
    const canView = await canViewTestGroup(user.id, user.user_role, parseInt(groupId));

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

    // Fetch test cases with contents
    const testCaseQuery = `SELECT
        tc.test_group_id,
        tc.tid,
        tc.first_layer,
        tc.second_layer,
        tc.third_layer,
        tc.fourth_layer,
        tc.purpose,
        tc.request_id,
        tc.check_items,
        tc.test_procedure,
        tc.created_at,
        tc.updated_at
       FROM tt_test_cases tc
       WHERE tc.test_group_id = $1 AND tc.is_deleted = FALSE
       ORDER BY tc.tid`;

    const testCaseTimer = new QueryTimer();
    const result = await query(testCaseQuery, [groupId]);
    const testCases = getAllRows(result);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'tt_test_cases',
      executionTime: testCaseTimer.elapsed(),
      rowsReturned: testCases.length,
      query: testCaseQuery,
      params: [groupId],
    });

    // Fetch test contents for each test case
    const casesWithContents = await Promise.all(
      testCases.map(async (testCase: unknown) => {
        const tc = testCase as Record<string, unknown>;

        const contentsQuery = `SELECT test_case_no, test_case, expected_value, is_target
           FROM tt_test_contents
           WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
           ORDER BY test_case_no`;

        const contentsTimer = new QueryTimer();
        const contentsResult = await query(contentsQuery, [groupId, tc.tid]);

        logDatabaseQuery({
          operation: 'SELECT',
          table: 'tt_test_contents',
          executionTime: contentsTimer.elapsed(),
          rowsReturned: contentsResult.rows.length,
          query: contentsQuery,
          params: [groupId, tc.tid],
        });

        const filesQuery = `SELECT file_type, file_no, file_name, file_path
           FROM tt_test_case_files
           WHERE test_group_id = $1 AND tid = $2 AND is_deleted = FALSE
           ORDER BY file_type, file_no`;

        const filesTimer = new QueryTimer();
        const filesResult = await query(filesQuery, [groupId, tc.tid]);

        logDatabaseQuery({
          operation: 'SELECT',
          table: 'tt_test_case_files',
          executionTime: filesTimer.elapsed(),
          rowsReturned: filesResult.rows.length,
          query: filesQuery,
          params: [groupId, tc.tid],
        });

        return {
          ...tc,
          contents: getAllRows(contentsResult),
          files: getAllRows(filesResult),
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
  try {
    const { groupId } = await params;
    const user = await requireAuth(req);

    // Check edit permission
    const canEdit = await canEditTestCases(user, parseInt(groupId));

    if (!canEdit) {
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
      return NextResponse.json(
        { error: 'TIDは必須です' },
        { status: 400 }
      );
    }

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json(
        { error: 'テストケース内容は最低1つ必要です' },
        { status: 400 }
      );
    }

    // Create test case in transaction
    const testCase = await transaction(async (client) => {
      // Insert test case
      const result = await client.query(
        `INSERT INTO tt_test_cases
         (test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
          purpose, request_id, check_items, test_procedure)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          groupId,
          tid,
          first_layer || null,
          second_layer || null,
          third_layer || null,
          fourth_layer || null,
          purpose || null,
          request_id || null,
          check_items || null,
          test_procedure || null,
        ]
      );

      const newTestCase = result.rows[0];

      // Insert test contents
      for (const content of contents) {
        await client.query(
          `INSERT INTO tt_test_contents
           (test_group_id, tid, test_case_no, test_case, expected_value, is_target)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            groupId,
            tid,
            content.test_case_no,
            content.test_case || '',
            content.expected_value || null,
            content.is_target !== undefined ? content.is_target : true,
          ]
        );
      }

      return newTestCase;
    });

    return NextResponse.json({ testCase }, { status: 201 });
  } catch (error) {
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
