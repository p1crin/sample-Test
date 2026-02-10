import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { readZipFromS3, writeResultToS3, uploadFileToS3, writeTestCaseImportResultCsv } from './utils/s3-client';
import { parseCsv, validateAllRows, groupByTid } from './utils/test-case-csv-parser';
import { extractZip, validateAllFilesExist, normalizeFilePath } from './utils/zip-handler';
import {
  TestCaseImportResult,
  ImportSummary,
  GroupedTestCase,
  ZipFileEntry,
  FileType,
} from './types/test-case-import.types';
import { createBatchLogger } from './utils/logger';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const logger = createBatchLogger('test-case-import');

const prisma = new PrismaClient();

// 環境変数でストレージモードを判定
const STORAGE_MODE = process.env.STORAGE_MODE || 's3'; // 's3' or 'local'
const LOCAL_UPLOAD_BASE_PATH = process.env.LOCAL_UPLOAD_BASE_PATH || join(process.cwd(), 'public');

/**
 * 環境変数の検証
 */
function validateEnvironmentVariables(): void {
  const required = ['INPUT_S3_BUCKET', 'INPUT_S3_KEY', 'OUTPUT_S3_BUCKET', 'DATABASE_URL', 'TEST_GROUP_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`必須の環境変数が設定されていません: ${missing.join(', ')}`);
  }

  // TEST_GROUP_IDが数値かチェック
  const testGroupId = parseInt(process.env.TEST_GROUP_ID!, 10);
  if (isNaN(testGroupId) || testGroupId <= 0) {
    throw new Error('TEST_GROUP_IDは正の整数である必要があります');
  }

  if (STORAGE_MODE === 's3') {
    const s3Required = ['FILE_S3_BUCKET'];
    const s3Missing = s3Required.filter(key => !process.env[key]);
    if (s3Missing.length > 0) {
      throw new Error(`S3モードで必須の環境変数が設定されていません: ${s3Missing.join(', ')}`);
    }
  }
}

/**
 * ファイルをストレージにアップロード（S3またはローカル）
 */
async function uploadFile(
  testGroupId: number,
  tid: string,
  fileName: string,
  buffer: Buffer,
  fileType: 'evidence' | 'test-case' | 'control-spec' | 'data-flow'
): Promise<string> {
  if (STORAGE_MODE === 's3') {
    // S3にアップロード
    const bucket = process.env.FILE_S3_BUCKET!;
    let keyPrefix = '';

    if (fileType === 'evidence') {
      keyPrefix = `evidences/${testGroupId}/${tid}`;
    } else if (fileType === 'control-spec' || fileType === 'data-flow') {
      keyPrefix = `uploads/test-cases/${testGroupId}/${tid}`;
    }

    const key = `${keyPrefix}/${fileName}`;
    await uploadFileToS3(bucket, key, buffer);
    return `/${key}`;
  } else {
    // ローカルに保存
    let localDir = '';

    if (fileType === 'evidence') {
      localDir = join(LOCAL_UPLOAD_BASE_PATH, 'evidences', String(testGroupId), tid);
    } else if (fileType === 'control-spec' || fileType === 'data-flow') {
      localDir = join(LOCAL_UPLOAD_BASE_PATH, 'uploads', 'test-cases', String(testGroupId), tid);
    }

    // ディレクトリが存在しない場合は作成
    if (!existsSync(localDir)) {
      mkdirSync(localDir, { recursive: true });
    }

    const localPath = join(localDir, fileName);
    writeFileSync(localPath, buffer);

    // 相対パスを返す
    if (fileType === 'evidence') {
      return `/evidences/${testGroupId}/${tid}/${fileName}`;
    } else {
      return `/uploads/test-cases/${testGroupId}/${tid}/${fileName}`;
    }
  }
}

/**
 * トランザクション内で1つのテストケース（TID）をインポート
 */
async function importTestCaseInTransaction(
  tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>,
  testGroupId: number,
  groupedTestCase: GroupedTestCase,
  files: Map<string, ZipFileEntry>,
  rowNumber: number
): Promise<TestCaseImportResult> {
  const result: TestCaseImportResult = {
    row: rowNumber,
    tid: groupedTestCase.tid,
    success: false,
    operation: 'error',
  };

  try {
    const { tid } = groupedTestCase;

    // TIDの重複チェック
    const existingTestCase = await tx.tt_test_cases.findUnique({
      where: {
        test_group_id_tid: {
          test_group_id: testGroupId,
          tid,
        },
      },
    });

    if (existingTestCase) {
      throw new Error(`TID「${tid}」は既に登録されています`);
    }

    // tt_test_cases に登録
    await tx.tt_test_cases.create({
      data: {
        test_group_id: testGroupId,
        tid,
        first_layer: groupedTestCase.first_layer,
        second_layer: groupedTestCase.second_layer,
        third_layer: groupedTestCase.third_layer,
        fourth_layer: groupedTestCase.fourth_layer,
        purpose: groupedTestCase.purpose,
        request_id: groupedTestCase.request_id,
        check_items: groupedTestCase.check_items,
        test_procedure: groupedTestCase.test_procedure,
      },
    });

    // 制御仕様ファイルをアップロード & tt_test_case_files に登録
    let fileNo = 1;
    for (const controlSpecPath of groupedTestCase.control_spec_paths) {
      const normalizedPath = normalizeFilePath(controlSpecPath);
      const fileEntry = files.get(normalizedPath);

      if (!fileEntry) {
        throw new Error(`制御仕様ファイル「${controlSpecPath}」がZIP内に見つかりません`);
      }

      // ファイルをアップロード
      const uploadedPath = await uploadFile(
        testGroupId,
        tid,
        fileEntry.originalName,
        fileEntry.buffer,
        'control-spec'
      );

      // DBに登録
      await tx.tt_test_case_files.create({
        data: {
          test_group_id: testGroupId,
          tid,
          file_no: fileNo,
          file_name: fileEntry.originalName,
          file_path: uploadedPath,
          file_type: FileType.CONTROL_SPEC,
        },
      });

      fileNo++;
    }

    // データフローファイルをアップロード & tt_test_case_files に登録
    for (const dataFlowPath of groupedTestCase.data_flow_paths) {
      const normalizedPath = normalizeFilePath(dataFlowPath);
      const fileEntry = files.get(normalizedPath);

      if (!fileEntry) {
        throw new Error(`データフローファイル「${dataFlowPath}」がZIP内に見つかりません`);
      }

      // ファイルをアップロード
      const uploadedPath = await uploadFile(
        testGroupId,
        tid,
        fileEntry.originalName,
        fileEntry.buffer,
        'data-flow'
      );

      // DBに登録
      await tx.tt_test_case_files.create({
        data: {
          test_group_id: testGroupId,
          tid,
          file_no: fileNo,
          file_name: fileEntry.originalName,
          file_path: uploadedPath,
          file_type: FileType.DATA_FLOW,
        },
      });

      fileNo++;
    }

    // テスト内容、結果、履歴、エビデンスを登録
    for (const content of groupedTestCase.contents) {
      // tt_test_contents に登録
      await tx.tt_test_contents.create({
        data: {
          test_group_id: testGroupId,
          tid,
          test_case_no: content.test_case_no,
          test_case: content.test_case,
          expected_value: content.expected_value,
          is_target: content.is_target,
        },
      });

      // tt_test_results に登録
      await tx.tt_test_results.create({
        data: {
          test_group_id: testGroupId,
          tid,
          test_case_no: content.test_case_no,
          result: content.result,
          judgment: content.judgment,
          software_version: content.software_version,
          hardware_version: content.hardware_version,
          comparator_version: content.comparator_version,
          execution_date: content.execution_date,
          executor: content.executor,
          note: content.note,
        },
      });

      // tt_test_results_history に登録（history_count=1固定）
      await tx.tt_test_results_history.create({
        data: {
          test_group_id: testGroupId,
          tid,
          test_case_no: content.test_case_no,
          history_count: 1,
          result: content.result,
          judgment: content.judgment,
          software_version: content.software_version,
          hardware_version: content.hardware_version,
          comparator_version: content.comparator_version,
          execution_date: content.execution_date,
          executor: content.executor,
          note: content.note,
        },
      });

      // エビデンスファイルをアップロード & tt_test_evidences に登録
      let evidenceNo = 1;
      for (const evidencePath of content.evidence_paths) {
        const normalizedPath = normalizeFilePath(evidencePath);
        const fileEntry = files.get(normalizedPath);

        if (!fileEntry) {
          throw new Error(`エビデンスファイル「${evidencePath}」がZIP内に見つかりません`);
        }

        // ファイルをアップロード
        const uploadedPath = await uploadFile(
          testGroupId,
          tid,
          fileEntry.originalName,
          fileEntry.buffer,
          'evidence'
        );

        // DBに登録
        await tx.tt_test_evidences.create({
          data: {
            test_group_id: testGroupId,
            tid,
            test_case_no: content.test_case_no,
            history_count: 1,
            evidence_no: evidenceNo,
            evidence_name: fileEntry.originalName,
            evidence_path: uploadedPath,
          },
        });

        evidenceNo++;
      }
    }

    result.success = true;
    result.operation = 'created';
    result.contentCount = groupedTestCase.contents.length;

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
  logger.startBatch('テストケースインポートバッチを開始します');

  let importResultId: number | null = null;

  try {
    // 環境変数の検証
    validateEnvironmentVariables();

    const inputBucket = process.env.INPUT_S3_BUCKET!;
    const inputKey = process.env.INPUT_S3_KEY!;
    const outputBucket = process.env.OUTPUT_S3_BUCKET!;
    const executorName = process.env.EXECUTOR_NAME || 'system';
    const testGroupId = parseInt(process.env.TEST_GROUP_ID!, 10);

    logger.info('バッチ設定', {
      input: `s3://${inputBucket}/${inputKey}`,
      testGroupId,
      outputBucket,
    });

    // テストグループの存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: testGroupId, is_deleted: false },
    });

    if (!testGroup) {
      throw new Error(`テストグループID ${testGroupId} が見つかりません`);
    }

    // 実行開始をDBに記録（import_status=0: 実施中）
    const importRecord = await prisma.tt_import_results.create({
      data: {
        file_name: inputKey,
        import_status: 0, // 0: 実施中
        executor_name: executorName,
        import_type: 1, // 1: テストケースインポート
        count: 0,
        message: 'インポート処理を開始しました',
      },
    });
    importResultId = importRecord.id;
    logger.info('インポート実行レコードを作成', { importResultId });

    // S3からZIPファイルを読み込み
    logger.info('ZIPファイルを読み込み中');
    const zipBuffer = await readZipFromS3(inputBucket, inputKey);

    // ZIPファイルを解凍
    logger.info('ZIPファイルを解凍中');
    const { csvContent, files } = extractZip(zipBuffer);
    logger.info('ZIPからファイルを抽出', { fileCount: files.size });

    // CSVをパース
    logger.info('CSVをパース中');
    const rows = parseCsv(csvContent);
    logger.info('テストデータを検出', { count: rows.length });

    if (rows.length === 0) {
      throw new Error('CSVにデータが含まれていません');
    }

    // 事前バリデーション（CSV構造）
    logger.info('全行のバリデーションを実行中');
    const validation = validateAllRows(rows);
    if (!validation.valid) {
      logger.error('バリデーションエラー', null, { errors: validation.errors });

      const errorMessage = `バリデーションエラーが${validation.errors.length}件発生したため実行されませんでした:\n${validation.errors.join('\n')}`;

      // DBレコードを更新（import_status=2: エラー）
      await prisma.tt_import_results.update({
        where: { id: importResultId },
        data: {
          import_status: 2, // 2: エラー
          message: errorMessage,
        },
      });

      // S3に結果を書き込み
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultJsonKey = `test-case-import-results/result-${timestamp}.json`;
      await writeResultToS3(
        outputBucket,
        resultJsonKey,
        JSON.stringify({ error: errorMessage, errors: validation.errors }, null, 2)
      );

      logger.error('バリデーションエラーにより終了', null, { resultFile: `s3://${outputBucket}/${resultJsonKey}` });
      process.exit(1);
    }

    // TIDごとにグループ化
    logger.info('テストケースをグループ化中');
    const groupedTestCases = groupByTid(rows);
    logger.info('テストケース（TID）を検出', { count: groupedTestCases.length });

    // ファイル存在確認
    logger.info('参照ファイルの存在確認中');
    const allFilePaths: string[] = [];
    groupedTestCases.forEach(group => {
      allFilePaths.push(...group.control_spec_paths);
      allFilePaths.push(...group.data_flow_paths);
      group.contents.forEach(content => {
        allFilePaths.push(...content.evidence_paths);
      });
    });

    const fileValidation = validateAllFilesExist(allFilePaths, files);
    if (!fileValidation.valid) {
      logger.error('ファイル存在エラー', null, { errors: fileValidation.errors });

      const errorMessage = `ファイル存在エラーが${fileValidation.errors.length}件発生したため実行されませんでした:\n${fileValidation.errors.join('\n')}`;

      await prisma.tt_import_results.update({
        where: { id: importResultId },
        data: {
          import_status: 2, // 2: エラー
          message: errorMessage,
        },
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultJsonKey = `test-case-import-results/result-${timestamp}.json`;
      await writeResultToS3(
        outputBucket,
        resultJsonKey,
        JSON.stringify({ error: errorMessage, errors: fileValidation.errors }, null, 2)
      );

      logger.error('ファイル存在エラーにより終了', null, { resultFile: `s3://${outputBucket}/${resultJsonKey}` });
      process.exit(1);
    }

    // トランザクション内で全テストケースをインポート
    logger.info('テストケースをインポート中');
    const results: TestCaseImportResult[] = [];
    let createdCount = 0;
    let totalContents = 0;
    let uploadedFiles = 0;

    await prisma.$transaction(
      async (tx: Omit<any, "$disconnect" | "$connect" | "$on" | "$transaction" | "$use" | "$extends">) => {
        for (let i = 0; i < groupedTestCases.length; i++) {
          const group = groupedTestCases[i];
          const rowNumber = i + 2; // ヘッダー行を考慮

          logger.progress(i + 1, groupedTestCases.length, `TID: ${group.tid} を処理中`, { tid: group.tid });

          try {
            const result = await importTestCaseInTransaction(
              tx,
              testGroupId,
              group,
              files,
              rowNumber
            );
            results.push(result);

            if (result.operation === 'created') {
              createdCount++;
              totalContents += result.contentCount || 0;
              uploadedFiles += group.control_spec_paths.length + group.data_flow_paths.length;
              group.contents.forEach(content => {
                uploadedFiles += content.evidence_paths.length;
              });
            }
          } catch (error) {
            // エラーが発生したらトランザクション全体をロールバック
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('TID処理中にエラー発生', error, { rowNumber, tid: group.tid });

            // エラー結果を記録
            results.push({
              row: rowNumber,
              tid: group.tid,
              success: false,
              operation: 'error',
              errorMessage,
            });

            throw new Error(
              `${rowNumber}行目（TID: ${group.tid}）の処理中にエラーが発生したため全件ロールバックしました:\n- ${errorMessage}`
            );
          }
        }
      },
      {
        maxWait: 60000, // 60秒
        timeout: 300000, // 5分
      }
    );

    const endTime = new Date();

    // サマリを作成
    const summary: ImportSummary = {
      totalTestCases: groupedTestCases.length,
      totalContents,
      successCount: createdCount,
      errorCount: 0,
      createdTestCases: createdCount,
      createdContents: totalContents,
      uploadedFiles,
      results,
      startedAt: startTime.toISOString(),
      completedAt: endTime.toISOString(),
    };

    // 結果をS3に書き込み
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultJsonKey = `test-case-import-results/result-${timestamp}.json`;
    const resultCsvKey = `test-case-import-results/result-${timestamp}.csv`;

    logger.info('結果をS3に書き込み中');
    await writeResultToS3(outputBucket, resultJsonKey, JSON.stringify(summary, null, 2));
    await writeTestCaseImportResultCsv(outputBucket, resultCsvKey, results);

    // DBレコードを更新（import_status=1: 成功）
    const successMessage = `${createdCount}件のテストケースを正常にインポートしました（テスト内容: ${totalContents}件, ファイル: ${uploadedFiles}件）`;
    await prisma.tt_import_results.update({
      where: { id: importResultId },
      data: {
        import_status: 1, // 1: 成功
        count: createdCount,
        message: successMessage,
      },
    });

    logger.endBatch('インポート完了', {
      createdCount,
      totalContents,
      uploadedFiles,
      resultFiles: {
        json: `s3://${outputBucket}/${resultJsonKey}`,
        csv: `s3://${outputBucket}/${resultCsvKey}`,
      },
    });
  } catch (error) {
    logger.error('テストケースインポートバッチでエラーが発生しました', error);
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
        await prisma.tt_import_results.create({
          data: {
            file_name: process.env.INPUT_S3_KEY || 'unknown',
            import_status: 2, // 2: エラー
            executor_name: process.env.EXECUTOR_NAME || 'system',
            import_type: 1, // 1: テストケースインポート
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
