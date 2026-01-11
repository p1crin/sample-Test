import { isAdmin, requireAdmin, requireAuth } from "@/app/lib/auth";
import { getAllRows, query } from "@/app/lib/db";
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from "@/constants/errorMessages";
import { STATUS_CODES } from "@/constants/statusCodes";
import { User } from "@/types";
import { hashPassword } from "@/utils/cryptroUtils";
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from "@/utils/database-logger";
import { handleError } from "@/utils/errorHandler";
import { NextRequest, NextResponse } from "next/server";

// GET /api/users - ユーザ一覧情報を取得
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  try {
    const user = await requireAdmin(req);

    // クエリ文字列から検索パラメータを取得
    const { searchParams } = new URL(req.url);
    let roleValue;
    switch (searchParams.get('user_role')) {
      case "システム管理者":
        roleValue = "0";
        break;
      case "テスト管理者":
        roleValue = "1";
        break;
      case "一般":
        roleValue = "2";
        break;
      default:
        roleValue = "";
        break;
    }

    let statusValue;
    switch (searchParams.get('status')) {
      case "有効":
        statusValue = false;
        break;
      case "無効":
        statusValue = true;
        break;
      default:
        statusValue = "";
    }
    const email = searchParams.get('email') || '';
    const name = searchParams.get('name') || '';
    const department = searchParams.get('department') || '';
    const company = searchParams.get('company') || '';
    const role = roleValue;
    const tags = searchParams.getAll('tags');
    const status = statusValue;

    // ページネーションパラメータを取得
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    // WHERE句を動的に構築
    const whereConditions = [];
    const whereParams: unknown[] = [];
    let paramsIndex = 1;

    if (email) {
      whereConditions.push(`u.email ILIKE $${paramsIndex}`);
      whereParams.push(`%${email}%`);
      paramsIndex++;
    }

    if (name) {
      whereConditions.push(`u.name ILIKE $${paramsIndex}`);
      whereParams.push(`%${name}%`);
      paramsIndex++;
    }

    if (department) {
      whereConditions.push(`u.department ILIKE $${paramsIndex}`);
      whereParams.push(`%${department}%`);
      paramsIndex++;
    }

    if (company) {
      whereConditions.push(`u.company ILIKE $${paramsIndex}`);
      whereParams.push(`%${company}%`);
      paramsIndex++;
    }

    if (role) {
      whereConditions.push(`u.user_role = $${paramsIndex}`);
      whereParams.push(`${role}`);
      paramsIndex++;
    }
    if (status !== "") {
      whereConditions.push(`u.is_deleted = $${paramsIndex}`);
      whereParams.push(`${status}`);
      paramsIndex++;
    }

    if (tags.length > 0) {
      const tagPlaceholders = tags.map((_, index) => `$${paramsIndex + index}`).join(',');
      whereConditions.push(`u.id IN (
                            SELECT ut2.user_id
                            FROM mt_user_tags ut2
                            JOIN mt_tags t2
                            ON ut2.tag_id = t2.id
                            WHERE t2.name IN(${tagPlaceholders})
                            AND ut2.is_deleted = FALSE
                            GROUP BY ut2.user_id
                            HAVING COUNT(DISTINCT t2.name) =${tags.length}
                            )`);
      whereParams.push(...tags);
      paramsIndex += tags.length;
    }


    const whereClause = whereConditions.join(' AND ');

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/users',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
      queryParams: searchParams,
    });

    // ページネーション用に合計件数を取得
    const countQuery = `SELECT COUNT(*) FROM mt_users u ${whereClause ? `WHERE ${whereClause}` : ''}`;
    const countTimer = new QueryTimer();
    const countResult = await query<{ count: string | number }>(countQuery, whereParams);
    const totalCount = parseInt(String(countResult.rows[0]?.count || '0'), 10);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_users',
      executionTime: countTimer.elapsed(),
      rowsReturned: 1,
      query: 'COUNT(*)',
      params: Object.entries(whereClause),
    });

    // ページネーション付きでユーザ情報を取得
    const dataParams = [...whereParams, limit, offset];
    const limitParamIndex = whereParams.length + 1;
    const offsetParamIndex = whereParams.length + 2;
    const dataQuery = `SELECT u.id, u.email, u.name, u.user_role, u.department, u.company, u.created_at, u.updated_at,
                      u.is_deleted, COALESCE(tags.tags,'') AS tags
                      FROM mt_users u
                      LEFT JOIN (
                        SELECT ut.user_id, string_agg(t.name, ',') AS tags
                        FROM mt_user_tags ut
                        JOIN mt_tags t 
                        ON ut.tag_id = t.id
                        WHERE ut.is_deleted = FALSE
                        GROUP BY ut.user_id
                      ) tags ON u.id = tags.user_id
                       ${whereClause ? `WHERE ${whereClause}` : ''}
                       ORDER BY u.updated_at
                      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`;

    const dataTimer = new QueryTimer();
    const result = await query<User>(dataQuery, dataParams);
    const users = getAllRows(result);

    logDatabaseQuery({
      operation: 'SELECT',
      table: 'mt_users',
      userId: user.id,
      executionTime: dataTimer.elapsed(),
      rowsReturned: users.length,
      query: 'findMany',
      params: [{ skip: offset, take: limit }],
    })

    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/users',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: users.length,
      queryParams: searchParams,
    });

    return NextResponse.json({ success: true, data: users, totalCount });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'GET',
      '/api/users',
    )
  }
}

// POST /api/users - 新しいユーザ情報を作成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // ユーザが管理者か確認
    if (!isAdmin(user)) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/users',
        userId: user.id,
        statusCode: STATUS_CODES.FORBIDDEN,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.PERMISSION_DENIED
      });
      return handleError(
        new Error(ERROR_MESSAGES.PERMISSION_DENIED),
        STATUS_CODES.FORBIDDEN,
        apiTimer,
        'POST',
        '/api/users'
      );
    }

    const body = await req.json();
    const {
      email,
      name,
      department,
      company,
      user_role,
      password,
      userTags
    } = body;

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/users',
      userId: user.id,
      executionTime: apiTimer.elapsed(),
    });

    // 必須フィールドをバリデーション
    if (!email || !name || !department || !company || user_role === null || !password) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/users',
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_REQUIRED_FIELDS),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/users'
      );
    }

    // メールアドレス重複確認
    const existingUser = await prisma.mt_users.findUnique({
      where: {
        email: email,
      },
    });
    if (existingUser) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/users',
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_DUPLICATION_EMAIL),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/users'
      );
    }

    // フィールドの文字数をバリデーション
    const maxLength = 255;
    const passMaxLength = 64;
    const passMinlength = 8;
    if (email.length > maxLength || name.length > maxLength || company.length > maxLength
      || (password.length > passMaxLength || password.length < passMinlength)) {
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/users',
        userId: user.id,
        statusCode: STATUS_CODES.BAD_REQUEST,
        executionTime: apiTimer.elapsed(),
        error: ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH_FOR_USER
      });
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_FIELD_LENGTH_FOR_USER),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/users'
      );
    }

    //パスワードの文字種のバリデーション
    const passwordPattern = /(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!-/:-@[-`{-~])/;
    if (!passwordPattern.test(password)) {
      return handleError(
        new Error(ERROR_MESSAGES.VALIDATION_ERROR_PASSWORD_CONTENT),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/users'
      );
    }

    // タグの使用不可文字をバリデーション
    const userTagNgScript = (userTags: string[]): boolean => {
      return userTags.some(tag => tag.includes(",") || tag.includes(";"));
    }
    if (userTags && Array.isArray(userTags) && userTags.length > 0) {
      if (userTagNgScript(userTags)) {
        logAPIEndpoint({
          method: 'POST',
          endpoint: '/api/users',
          userId: user.id,
          statusCode: STATUS_CODES.BAD_REQUEST,
          executionTime: apiTimer.elapsed(),
          error: ERROR_MESSAGES.VALIDATION_ERROR_NG_USER_TAG
        });
        return handleError(
          new Error(ERROR_MESSAGES.VALIDATION_ERROR_NG_USER_TAG),
          STATUS_CODES.BAD_REQUEST,
          apiTimer,
          'POST',
          '/api/users'
        );
      }
    }

    // Prisma トランザクション内でユーザを作成
    const userData = await prisma.$transaction(async (tx) => {
      const insertTimer = new QueryTimer();
      const hash = await hashPassword(password);

      // 新規ユーザの作成
      const newUser = await tx.mt_users.create({
        data: {
          email,
          name,
          department,
          company,
          user_role,
          password: hash
        }
      });

      logDatabaseQuery({
        operation: 'INSERT',
        table: 'mt_users',
        executionTime: insertTimer.elapsed(),
        rowsAffected: 1,
        query: 'create',
        params: [
          {
            email,
            name,
            department,
            company,
            user_role,
            hash
          }
        ]
      });

      // 新規に作成されたタグの確認
      if (userTags && Array.isArray(userTags) && userTags.length > 0) {
        for (const tag of userTags) {
          // タグ名からタグIDを取得
          const tagLookupTimer = new QueryTimer();
          let foundTag = await tx.mt_tags.findUnique({
            where: {
              name: tag,
              is_deleted: false
            }
          });

          logDatabaseQuery({
            operation: 'SELECT',
            table: 'mt_tags',
            executionTime: tagLookupTimer.elapsed(),
            rowsReturned: foundTag ? 1 : 0,
            query: 'findUnique',
            params: [
              {
                name: tag
              }
            ]
          });

          // タグの新規作成
          if (!foundTag) {
            const tagInsertTimer = new QueryTimer();
            foundTag = await tx.mt_tags.create({
              data: {
                name: tag
              }
            });

            logDatabaseQuery({
              operation: 'INSERT',
              table: 'mt_tags',
              executionTime: tagInsertTimer.elapsed(),
              rowsAffected: 1,
              query: 'create',
              params: [
                {
                  name: tag
                }
              ]
            });
          }

          // ユーザとタグの紐づけ
          if (foundTag && newUser) {
            const tagInsertTimer = new QueryTimer();
            await tx.mt_user_tags.create({
              data: {
                user_id: newUser.id,
                tag_id: foundTag.id
              }
            });

            logDatabaseQuery({
              operation: 'INSERT',
              table: 'mt_user_tags',
              executionTime: tagInsertTimer.elapsed(),
              rowsAffected: 1,
              query: 'create',
              params: [
                {
                  user_id: newUser.id,
                  tag_id: foundTag.id
                }
              ]
            });
          }
        }
      }
      return newUser;
    });

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/users',
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1
    });

    return NextResponse.json({ success: true, data: userData }, { status: STATUS_CODES.CREATED });
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/users'
    );
  }
}