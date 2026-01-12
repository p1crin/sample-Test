import { canEditTestCases, canViewTestGroup, requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, logDatabaseQuery, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { rm } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

/**
 * ========================
 * AWS S3移行時の変更点（DELETE /api/test-groups/[groupId]/cases/[tid]）
 * ========================
 *
 * 【必要なライブラリ】
 * npm install @aws-sdk/client-s3
 *
 * 【インポート追加】
 * import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
 *
 * 【環境変数の追加（.env.local）】
 * AWS_REGION=ap-northeast-1
 * AWS_S3_BUCKET_NAME=your-bucket-name
 * AWS_ACCESS_KEY_ID=your-access-key-id
 * AWS_SECRET_ACCESS_KEY=your-secret-access-key
 *
 * 【S3クライアントの初期化（ファイル上部に追加）】
 * const s3Client = new S3Client({
 *   region: process.env.AWS_REGION,
 *   credentials: {
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   },
 * });
 */

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

    // ==================== レスポンスデータをフォーマット（現在の実装：ローカルパス） ====================
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
        file_path: file.file_path, // ローカル: /uploads/test-cases/...
        file_type: file.file_type,
        file_no: file.file_no
      })),
      data_flow: testCaseFiles.filter(file => file.file_type === 1).map(file => ({
        file_name: file.file_name,
        file_path: file.file_path, // ローカル: /uploads/test-cases/...
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

    /**
     * ==================== AWS S3からファイル取得（移行後の実装） ====================
     *
     * 【インポート追加】
     * import { GetObjectCommand } from '@aws-sdk/client-s3';
     * import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
     *
     * 【file_pathを署名付きURLに変換する場合の実装例】
     * S3キーをfile_pathに保存している場合、フロントエンドでアクセス可能な署名付きURLを生成する必要があります。
     *
     * // 署名付きURL生成のヘルパー関数
     * async function generatePresignedUrl(s3Key: string): Promise<string> {
     *   const command = new GetObjectCommand({
     *     Bucket: process.env.AWS_S3_BUCKET_NAME,
     *     Key: s3Key,
     *   });
     *
     *   // 署名付きURL（有効期限：3600秒 = 1時間）
     *   const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
     *   return signedUrl;
     * }
     *
     * // レスポンスデータのフォーマット時に署名付きURLを生成
     * const responseData = {
     *   // ... 他のフィールド
     *   control_spec: await Promise.all(
     *     testCaseFiles.filter(file => file.file_type === 0).map(async file => ({
     *       file_name: file.file_name,
     *       file_path: await generatePresignedUrl(file.file_path), // 署名付きURLに変換
     *       file_type: file.file_type,
     *       file_no: file.file_no
     *     }))
     *   ),
     *   data_flow: await Promise.all(
     *     testCaseFiles.filter(file => file.file_type === 1).map(async file => ({
     *       file_name: file.file_name,
     *       file_path: await generatePresignedUrl(file.file_path), // 署名付きURLに変換
     *       file_type: file.file_type,
     *       file_no: file.file_no
     *     }))
     *   ),
     *   // ...
     * };
     *
     * 【注意点】
     * 1. 署名付きURLには有効期限がある（上記例：1時間）
     * 2. 有効期限が切れた後は再度APIを呼び出してURLを取得する必要がある
     * 3. パブリックアクセスを許可する場合は署名なしの直URLを返すことも可能
     * 4. 大量のファイルがある場合、URL生成に時間がかかる可能性がある
     * 5. セキュリティ要件に応じてURLの有効期限を調整する
     *
     * 【別のアプローチ：専用のファイルダウンロードAPIを作成】
     * GET /api/files/download?fileNo=123&fileType=0&testGroupId=1&tid=TID-001
     * このAPIで署名付きURLを生成してリダイレクトまたは返す方が管理しやすい場合もあります。
     */

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
    const canEdit = canEditTestCases(user, testGroupId);

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
      firstLayer,
      secondLayer,
      thirdLayer,
      fourthLayer,
      purpose,
      requestId,
      checkItems,
      testProcedure,
      testContents = [],
      controlSpecFileIds = [],
      dataFlowFileIds = [],
      deletedFiles = [],
      deletedContents = [],
    } = body;

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${testGroupId}/cases/${tid}`,
      userId: user.id,
      executionTime: apiTimer.elapsed()
    });

    // 必須フィールドをバリデーション
    if (!firstLayer || !secondLayer || !thirdLayer || !fourthLayer || !purpose || !requestId || !checkItems || !testProcedure) {
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
    if (firstLayer.length > maxLength || secondLayer.length > maxLength || thirdLayer.length > maxLength || fourthLayer.length > maxLength || purpose.length > maxLength || requestId.length > maxLength) {
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
          first_layer: firstLayer,
          second_layer: secondLayer,
          third_layer: thirdLayer,
          fourth_layer: fourthLayer,
          purpose: purpose,
          request_id: requestId,
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

      // ==================== 削除されたファイルを削除（現在の実装：ローカルディスク） ====================
      for (const deletedFile of deletedFiles) {
        // データベースからファイル情報を取得
        const fileRecord = await tx.tt_test_case_files.findFirst({
          where: {
            test_group_id: testGroupId,
            tid: tid,
            file_no: deletedFile.fileNo,
            file_type: deletedFile.fileType // 0=controlSpec, 1=dataFlow
          }
        });

        // 物理ファイルを削除
        if (fileRecord?.file_path) {
          const filePath = join(process.cwd(), 'public', fileRecord.file_path);
          try {
            await rm(filePath, { force: true });
          } catch (error) {
            // ファイルが既に存在しない場合はエラーを無視
            console.warn(`Failed to delete file: ${filePath}`, error);
          }
        }

        /**
         * ==================== AWS S3からファイル削除（移行後の実装） ====================
         *
         * 【上記のローカルファイル削除を以下のS3削除に置き換える】
         *
         * if (fileRecord?.file_path) {
         *   // S3キーを取得
         *   const s3Key = fileRecord.file_path;
         *
         *   // S3から削除
         *   const deleteCommand = new DeleteObjectCommand({
         *     Bucket: process.env.AWS_S3_BUCKET_NAME,
         *     Key: s3Key,
         *   });
         *
         *   try {
         *     await s3Client.send(deleteCommand);
         *   } catch (s3Error) {
         *     console.warn(`Failed to delete file from S3: ${s3Key}`, s3Error);
         *   }
         * }
         *
         * 【注意点】
         * - トランザクション内でS3削除を実行するが、S3はトランザクションをサポートしていない
         * - DBロールバックが発生してもS3削除は取り消されない
         * - S3削除が失敗してもトランザクションを継続するか判断が必要
         */

        // データベースから削除
        await tx.tt_test_case_files.deleteMany({
          where: {
            test_group_id: testGroupId,
            tid: tid,
            file_no: deletedFile.fileNo,
            file_type: deletedFile.fileType // 0=controlSpec, 1=dataFlow
          }
        });
      }

      // ファイルは既にアップロードAPIで登録済みなので、ここでは何もしない
      // controlSpecFileIds, dataFlowFileIds は確認用に保持

      //
      let testCaseNo = 0;
      for (const content of testContents) {
        await tx.tt_test_contents.upsert({
          where: {
            test_group_id_tid_test_case_no: {
              test_group_id: testGroupId,
              tid: tid,
              test_case_no: testCaseNo,
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
            test_case_no: testCaseNo,
            test_case: content.testCase,
            expected_value: content.expectedValue,
            is_target: content.is_target,
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
        firstLayer,
        secondLayer,
        thirdLayer,
        fourthLayer,
        purpose,
        requestId,
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

    return NextResponse.json({ success: true, data: testCase }, { status: STATUS_CODES.OK });
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
    // ==================== 紐づいているファイルの削除（現在の実装：ローカルディスク） ====================
    const deleteDir = join(process.cwd(), 'public', 'uploads', 'test-cases', String(groupId), tid);
    await rm(deleteDir, { recursive: true, force: true })

    /**
     * ==================== AWS S3からディレクトリ削除（移行後の実装） ====================
     *
     * 【上記のローカルディレクトリ削除を以下のS3バッチ削除に置き換える】
     *
     * // S3プレフィックス（ディレクトリ相当）を定義
     * const s3Prefix = `test-cases/${groupId}/${tid}/`;
     *
     * // 1. プレフィックス配下のすべてのオブジェクトをリストアップ
     * const listCommand = new ListObjectsV2Command({
     *   Bucket: process.env.AWS_S3_BUCKET_NAME,
     *   Prefix: s3Prefix,
     * });
     *
     * try {
     *   const listedObjects = await s3Client.send(listCommand);
     *
     *   if (listedObjects.Contents && listedObjects.Contents.length > 0) {
     *     // 2. リストアップされたオブジェクトを一括削除
     *     const deleteCommand = new DeleteObjectsCommand({
     *       Bucket: process.env.AWS_S3_BUCKET_NAME,
     *       Delete: {
     *         Objects: listedObjects.Contents.map(item => ({ Key: item.Key! })),
     *         Quiet: false,
     *       },
     *     });
     *
     *     const deleteResult = await s3Client.send(deleteCommand);
     *
     *     // エラーがあった場合はログに記録
     *     if (deleteResult.Errors && deleteResult.Errors.length > 0) {
     *       console.error('S3 deletion errors:', deleteResult.Errors);
     *     }
     *   }
     * } catch (s3Error) {
     *   console.error(`Failed to delete S3 objects with prefix: ${s3Prefix}`, s3Error);
     *   // エラーハンドリング：S3削除が失敗してもテストケース削除を続行するか判断
     * }
     *
     * 【注意点】
     * 1. S3には「ディレクトリ」の概念がない。プレフィックスでオブジェクトをグループ化する
     * 2. 1000個以上のオブジェクトがある場合はページネーションが必要
     * 3. DeleteObjectsCommandは最大1000個まで一度に削除可能
     * 4. S3削除はトランザクション外で実行されるため、DB削除が成功してもS3削除が失敗する可能性がある
     * 5. 大量のファイルがある場合は非同期ジョブで削除することを推奨
     * 6. S3のバケットバージョニングが有効な場合、削除マーカーが追加されるだけで物理削除されない
     *
     * 【1000個以上のオブジェクトがある場合の実装例】
     * let continuationToken: string | undefined;
     * do {
     *   const listCommand = new ListObjectsV2Command({
     *     Bucket: process.env.AWS_S3_BUCKET_NAME,
     *     Prefix: s3Prefix,
     *     ContinuationToken: continuationToken,
     *   });
     *
     *   const listedObjects = await s3Client.send(listCommand);
     *
     *   if (listedObjects.Contents && listedObjects.Contents.length > 0) {
     *     const deleteCommand = new DeleteObjectsCommand({
     *       Bucket: process.env.AWS_S3_BUCKET_NAME,
     *       Delete: {
     *         Objects: listedObjects.Contents.map(item => ({ Key: item.Key! })),
     *       },
     *     });
     *     await s3Client.send(deleteCommand);
     *   }
     *
     *   continuationToken = listedObjects.NextContinuationToken;
     * } while (continuationToken);
     */

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