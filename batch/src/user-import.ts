import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import {
  readCsvFromS3,
  writeResultToS3,
  writeImportResultCsv,
  readCsvFromLocal,
  writeResultToLocal,
  writeImportResultCsvToLocal
} from './utils/s3-client';
import { parseCsv, validateAllRows, parseStatus } from './utils/csv-parser';
import { hashPassword } from './utils/password-hash';
import { UserCsvRow, UserImportResult, ImportSummary } from './types/user-import.types';
import { createBatchLogger } from './utils/logger';
import * as path from 'path';

const logger = createBatchLogger('user-import');

const prisma = new PrismaClient();

/**
 * 環境変数の検証
 */
function validateEnvironmentVariables(): void {
  const storageMode = process.env.STORAGE_MODE || 's3';
  let required: string[] = ['DATABASE_URL'];

  if (storageMode === 's3') {
    required.push('INPUT_S3_BUCKET', 'INPUT_S3_KEY', 'OUTPUT_S3_BUCKET');
  } else if (storageMode === 'local') {
    required.push('INPUT_FILE_PATH', 'OUTPUT_DIR_PATH');
  } else {
    throw new Error(`STORAGE_MODEは "s3" または "local" である必要があります（現在の値: ${storageMode}）`);
  }

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`必須の環境変数が設定されていません: ${missing.join(', ')}`);
  }
}

/**
 * タグ文字列をパースして配列に変換
 */
function parseTags(tagsString: string): string[] {
  if (!tagsString || tagsString.trim() === '') {
    return [];
  }
  return tagsString
    .split(';')
    .map(tag => tag.trim())
    .filter(tag => tag !== '');
}

/**
 * タグを処理（存在しない場合は作成、ユーザとの関連付け）
 */
async function processUserTags(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  userId: number,
  tagsString: string
): Promise<void> {
  const tagNames = parseTags(tagsString);

  if (tagNames.length === 0) {
    return;
  }

  // 既存のユーザータグを削除（論理削除）
  await tx.mt_user_tags.updateMany({
    where: { user_id: userId },
    data: { is_deleted: true },
  });

  // 各タグを処理
  for (const tagName of tagNames) {
    // タグが存在するか確認、存在しない場合は作成
    let tag = await tx.mt_tags.findFirst({
      where: { name: tagName, is_deleted: false },
    });

    if (!tag) {
      tag = await tx.mt_tags.create({
        data: { name: tagName },
      });
    }

    // ユーザータグの関連付け（既存の場合は復活、新規の場合は作成）
    const existingUserTag = await tx.mt_user_tags.findUnique({
      where: {
        user_id_tag_id: {
          user_id: userId,
          tag_id: tag.id,
        },
      },
    });

    if (existingUserTag) {
      // 既存の場合は復活
      await tx.mt_user_tags.update({
        where: {
          user_id_tag_id: {
            user_id: userId,
            tag_id: tag.id,
          },
        },
        data: { is_deleted: false },
      });
    } else {
      // 新規作成
      await tx.mt_user_tags.create({
        data: {
          user_id: userId,
          tag_id: tag.id,
        },
      });
    }
  }
}

/**
 * トランザクション内で1ユーザをインポート
 */
async function importUserInTransaction(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  row: UserCsvRow,
  rowNumber: number
): Promise<UserImportResult> {
  const result: UserImportResult = {
    row: rowNumber,
    email: row.email,
    name: row.name,
    success: false,
    operation: 'error',
  };

  try {
    const isNewUser = !row.id || row.id.trim() === '';
    const userRole = parseInt(row.user_role, 10);
    const isDeleted = parseStatus(row.status);

    if (isNewUser) {
      // 新規ユーザ作成
      // メールアドレスの重複チェック
      const existingUser = await tx.mt_users.findUnique({
        where: { email: row.email, is_deleted: false },
      });

      if (existingUser) {
        throw new Error(`メールアドレス "${row.email}" は既に使用されています`);
      }

      // パスワードハッシュ化
      const hashedPassword = await hashPassword(row.password);

      // ユーザ作成
      const newUser = await tx.mt_users.create({
        data: {
          email: row.email,
          name: row.name,
          user_role: userRole,
          department: row.department || '',
          company: row.company || '',
          password: hashedPassword,
          is_deleted: isDeleted,
        },
      });

      // タグを処理
      await processUserTags(tx, newUser.id, row.tags);

      result.success = true;
      result.operation = 'created';
    } else {
      // 既存ユーザ更新
      const userId = parseInt(row.id, 10);

      // ユーザ存在チェック
      const existingUser = await tx.mt_users.findUnique({
        where: { id: userId, is_deleted: false },
      });

      if (!existingUser) {
        throw new Error(`ID ${userId} のユーザが見つかりません`);
      }

      // メールアドレス変更時の重複チェック
      if (existingUser.email !== row.email) {
        const duplicateEmail = await tx.mt_users.findUnique({
          where: { email: row.email, is_deleted: false },
        });

        if (duplicateEmail && duplicateEmail.id !== userId) {
          throw new Error(`メールアドレス "${row.email}" は既に別のユーザに使用されています`);
        }
      }

      // 更新データを準備
      const updateData: {
        email: string;
        name: string;
        user_role: number;
        department: string;
        company: string;
        is_deleted: boolean;
        password?: string;
      } = {
        email: row.email,
        name: row.name,
        user_role: userRole,
        department: row.department || '',
        company: row.company || '',
        is_deleted: isDeleted,
      };

      // パスワードが指定されている場合のみ更新
      if (row.password && row.password.trim() !== '') {
        updateData.password = await hashPassword(row.password);
      }

      // ユーザ更新
      await tx.mt_users.update({
        where: { id: userId },
        data: updateData,
      });

      // タグを処理
      await processUserTags(tx, userId, row.tags);

      result.success = true;
      result.operation = 'updated';
    }

    return result;
  } catch (error) {
    result.errorMessage = error instanceof Error ? error.message : String(error);
    throw error; // トランザクションをロールバックするためにエラーを再スロー
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  const startTime = new Date();
  logger.startBatch('ユーザインポートバッチを開始します');

  let importResultId: number | null = null;

  try {
    // 環境変数の検証
    validateEnvironmentVariables();

    const storageMode = process.env.STORAGE_MODE || 's3';
    const executorName = process.env.EXECUTOR_NAME || 'system';

    let inputSource: string;
    let outputLocation: string;

    if (storageMode === 's3') {
      const inputBucket = process.env.INPUT_S3_BUCKET!;
      const inputKey = process.env.INPUT_S3_KEY!;
      const outputBucket = process.env.OUTPUT_S3_BUCKET!;
      inputSource = `s3://${inputBucket}/${inputKey}`;
      outputLocation = `s3://${outputBucket}`;
    } else {
      const inputFilePath = process.env.INPUT_FILE_PATH!;
      const outputDirPath = process.env.OUTPUT_DIR_PATH!;
      inputSource = inputFilePath;
      outputLocation = outputDirPath;
    }

    logger.info('バッチ設定', { storageMode, inputSource, outputLocation });

    // 実行開始をDBに記録（import_status=0: 実施中）
    const fileName = storageMode === 's3'
      ? process.env.INPUT_S3_KEY!
      : path.basename(process.env.INPUT_FILE_PATH!);

    const importRecord = await prisma.tt_import_results.create({
      data: {
        file_name: fileName,
        import_status: 0, // 0: 実施中
        executor_name: executorName,
        import_type: 0, // 0: ユーザインポート
        count: 0,
        message: 'インポート処理を開始しました',
      },
    });
    importResultId = importRecord.id;
    logger.info('インポート実行レコードを作成', { importResultId });

    // CSVファイルを読み込み
    logger.info('CSVファイルを読み込み中');
    let csvContent: string;
    if (storageMode === 's3') {
      const inputBucket = process.env.INPUT_S3_BUCKET!;
      const inputKey = process.env.INPUT_S3_KEY!;
      csvContent = await readCsvFromS3(inputBucket, inputKey);
    } else {
      const inputFilePath = process.env.INPUT_FILE_PATH!;
      csvContent = await readCsvFromLocal(inputFilePath);
    }

    // CSVをパース
    logger.info('CSVをパース中');
    const rows = parseCsv(csvContent);
    logger.info('ユーザデータを検出', { count: rows.length });

    if (rows.length === 0) {
      throw new Error('CSVにデータが含まれていません');
    }

    // 事前バリデーション
    logger.info('全行のバリデーションを実行中');
    const validation = validateAllRows(rows);
    if (!validation.valid) {
      logger.error('バリデーションエラー', null, { errors: validation.errors });

      // エラー詳細をメッセージに含める
      const errorMessage = `バリデーションエラーが${validation.errors.length}件発生したため実行されませんでした:\n${validation.errors.join('\n')}`;

      // DBレコードを更新（import_status=2: エラー）
      await prisma.tt_import_results.update({
        where: { id: importResultId },
        data: {
          import_status: 2, // 2: エラー
          message: errorMessage,
        },
      });

      // 結果を書き込み（参考用）
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultContent = JSON.stringify({ error: errorMessage, errors: validation.errors }, null, 2);

      if (storageMode === 's3') {
        const outputBucket = process.env.OUTPUT_S3_BUCKET!;
        const resultJsonKey = `user-import-results/result-${timestamp}.json`;
        await writeResultToS3(outputBucket, resultJsonKey, resultContent);
        logger.error('バリデーションエラーにより終了', null, { resultFile: `s3://${outputBucket}/${resultJsonKey}` });
      } else {
        const outputDirPath = process.env.OUTPUT_DIR_PATH!;
        const resultJsonPath = path.join(outputDirPath, `result-${timestamp}.json`);
        await writeResultToLocal(resultJsonPath, resultContent);
        logger.error('バリデーションエラーにより終了', null, { resultFile: resultJsonPath });
      }

      process.exit(1);
    }

    // トランザクション内で全ユーザをインポート
    logger.info('ユーザデータをインポート中');
    const results: UserImportResult[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx: Omit<any, "$disconnect" | "$connect" | "$on" | "$transaction" | "$use" | "$extends">) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // ヘッダー行を考慮

        logger.progress(i + 1, rows.length, `${row.email} を処理中`, { email: row.email });

        try {
          const result = await importUserInTransaction(tx, row, rowNumber);
          results.push(result);

          if (result.operation === 'created') {
            createdCount++;
          } else if (result.operation === 'updated') {
            updatedCount++;
          }
        } catch (error) {
          // エラーが発生したらトランザクション全体をロールバック
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('行処理中にエラー発生', error, { rowNumber, email: row.email });

          // エラー結果を記録
          results.push({
            row: rowNumber,
            email: row.email,
            name: row.name,
            success: false,
            operation: 'error',
            errorMessage,
          });

          throw new Error(`${rowNumber}行目の処理中にエラーが発生したため全件ロールバックしました:\n- ${rowNumber}行目: ${errorMessage}`);
        }
      }
    });

    const endTime = new Date();
    const successCount = rows.length;

    // サマリを作成
    const summary: ImportSummary = {
      totalRows: rows.length,
      successCount,
      errorCount: 0,
      createdCount,
      updatedCount,
      skippedCount: 0,
      results,
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
    };

    // 結果を書き込み
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    logger.info('結果を書き込み中');
    if (storageMode === 's3') {
      const outputBucket = process.env.OUTPUT_S3_BUCKET!;
      const resultJsonKey = `user-import-results/result-${timestamp}.json`;
      const resultCsvKey = `user-import-results/result-${timestamp}.csv`;

      await writeResultToS3(outputBucket, resultJsonKey, JSON.stringify(summary, null, 2));
      await writeImportResultCsv(outputBucket, resultCsvKey, results);

      logger.endBatch('インポート完了', {
        successCount,
        createdCount,
        updatedCount,
        resultFiles: {
          json: `s3://${outputBucket}/${resultJsonKey}`,
          csv: `s3://${outputBucket}/${resultCsvKey}`,
        },
      });
    } else {
      const outputDirPath = process.env.OUTPUT_DIR_PATH!;
      const resultJsonPath = path.join(outputDirPath, `result-${timestamp}.json`);
      const resultCsvPath = path.join(outputDirPath, `result-${timestamp}.csv`);

      await writeResultToLocal(resultJsonPath, JSON.stringify(summary, null, 2));
      await writeImportResultCsvToLocal(resultCsvPath, results);

      logger.endBatch('インポート完了', {
        successCount,
        createdCount,
        updatedCount,
        resultFiles: {
          json: resultJsonPath,
          csv: resultCsvPath,
        },
      });
    }

    // DBレコードを更新（import_status=1: 成功）
    const successMessage = `${successCount}件のユーザを正常にインポートしました（新規: ${createdCount}件, 更新: ${updatedCount}件）`;
    await prisma.tt_import_results.update({
      where: { id: importResultId },
      data: {
        import_status: 1, // 1: 成功
        count: successCount,
        message: successMessage,
      },
    });
  } catch (error) {
    logger.error('ユーザインポートバッチでエラーが発生しました', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // DBレコードを更新（import_status=2: エラー）
    try {
      if (importResultId) {
        await prisma.tt_import_results.update({
          where: { id: importResultId },
          data: {
            import_status: 2, // 2: エラー
            count: 0,
            message: errorMessage,
          },
        });
      } else {
        // インポートレコード作成前のエラー
        const storageMode = process.env.STORAGE_MODE || 's3';
        const fileName = storageMode === 's3'
          ? (process.env.INPUT_S3_KEY || 'unknown')
          : (process.env.INPUT_FILE_PATH ? path.basename(process.env.INPUT_FILE_PATH) : 'unknown');

        await prisma.tt_import_results.create({
          data: {
            file_name: fileName,
            import_status: 2, // 2: エラー
            executor_name: process.env.EXECUTOR_NAME || 'system',
            import_type: 0, // 0: ユーザインポート
            count: 0,
            message: errorMessage,
          },
        });
      }
    } catch (dbError) {
      logger.error('エラー記録の保存に失敗しました', dbError);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// バッチ実行
main();