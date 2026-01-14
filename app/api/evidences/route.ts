import { requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { STATUS_CODES } from '@/constants/statusCodes';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import { handleError } from '@/utils/errorHandler';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';

/**
 * ========================
 * AWS S3移行時の変更点
 * ========================
 *
 * 【必要なライブラリ】
 * npm install @aws-sdk/client-s3
 *
 * 【インポート追加】
 * import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

// POST /api/evidences - エビデンスファイルアップロード
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // FormDataからファイルとメタデータを取得
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const testGroupId = formData.get('testGroupId') as string;
    const tid = formData.get('tid') as string;
    const testCaseNo = formData.get('testCaseNo') as string;
    const historyCount = formData.get('historyCount') as string;

    if (!file || !testGroupId || !tid || !testCaseNo || !historyCount) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/evidences'
      );
    }

    const parsedTestGroupId = parseInt(testGroupId, 10);
    const parsedTestCaseNo = parseInt(testCaseNo, 10);
    const parsedHistoryCount = parseInt(historyCount, 10);

    if (isNaN(parsedTestGroupId) || isNaN(parsedTestCaseNo) || isNaN(parsedHistoryCount)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/evidences'
      );
    }

    // テストグループの存在確認
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: parsedTestGroupId, is_deleted: false },
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'POST',
        '/api/evidences'
      );
    }

    // ==================== ローカルディスク保存（現在の実装） ====================
    // ファイル保存ディレクトリ
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'evidences', testGroupId, tid);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 最大evidence_noを取得（全history_count対象）
    // historyCount=0の場合は、まだDBレコードがないため、全履歴から最大値を取得して一意性を確保
    const maxEvidence = await prisma.tt_test_evidences.findFirst({
      where: {
        test_group_id: parsedTestGroupId,
        tid: tid,
        test_case_no: parsedTestCaseNo,
        // history_countは指定せず、全履歴から最大値を取得
      },
      orderBy: {
        evidence_no: 'desc',
      },
    });

    const newEvidenceNo = (maxEvidence?.evidence_no ?? 0) + 1;

    // ファイル名生成: testCaseNo_historyCount_evidenceNo_timestamp.ext
    const fileExtension = file.name.split('.').pop();
    const fileName = `${testCaseNo}_${historyCount}_${newEvidenceNo}_${Date.now()}.${fileExtension}`;
    const filePath = join(uploadDir, fileName);

    // ファイルをBase64からバッファに変換して保存
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);

    /**
     * ==================== AWS S3保存（移行後の実装） ====================
     *
     * 【上記のローカルディスク保存を以下のS3アップロードに置き換える】
     *
     * // S3キーの生成（バケット内のファイルパス）
     * const fileExtension = file.name.split('.').pop();
     * const fileName = `${testCaseNo}_${historyCount}_${newEvidenceNo}_${Date.now()}.${fileExtension}`;
     * const s3Key = `evidences/${testGroupId}/${tid}/${fileName}`;
     *
     * // ファイルをバッファに変換
     * const arrayBuffer = await file.arrayBuffer();
     * const buffer = Buffer.from(arrayBuffer);
     *
     * // S3にアップロード
     * const uploadCommand = new PutObjectCommand({
     *   Bucket: process.env.AWS_S3_BUCKET_NAME,
     *   Key: s3Key,
     *   Body: buffer,
     *   ContentType: file.type,
     *   Metadata: {
     *     originalName: file.name,
     *     testGroupId: testGroupId,
     *     tid: tid,
     *     testCaseNo: testCaseNo,
     *     historyCount: historyCount,
     *   },
     * });
     *
     * try {
     *   await s3Client.send(uploadCommand);
     * } catch (s3Error) {
     *   console.error('S3 upload failed:', s3Error);
     *   throw new Error('File upload to S3 failed');
     * }
     *
     * // S3のURLを生成（evidence_pathとして保存）
     * const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
     */

    // ==================== データベースに記録（現在の実装：ローカルパス） ====================
    // historyCount=0の場合は、まだ履歴レコードが存在しないため、ファイルのみ保存してデータベースには記録しない
    // 結果保存時にまとめてデータベースに記録される
    let evidenceRecord = null;

    if (parsedHistoryCount > 0) {
      // 既存の履歴に対するエビデンス追加の場合のみデータベースに記録
      evidenceRecord = await prisma.tt_test_evidences.create({
        data: {
          test_group_id: parsedTestGroupId,
          tid: tid,
          test_case_no: parsedTestCaseNo,
          history_count: parsedHistoryCount,
          evidence_no: newEvidenceNo,
          evidence_name: file.name,
          evidence_path: `/uploads/evidences/${testGroupId}/${tid}/${fileName}`, // ローカル: publicからの相対パス
        },
      });
    }

    /**
     * ==================== データベースに記録（移行後：S3キーまたはURL） ====================
     *
     * 【S3移行時の変更】
     * evidence_pathの値をS3キーまたはURLに変更：
     *
     * const evidenceRecord = await prisma.tt_test_evidences.create({
     *   data: {
     *     test_group_id: parsedTestGroupId,
     *     tid: tid,
     *     test_case_no: parsedTestCaseNo,
     *     history_count: parsedHistoryCount,
     *     evidence_no: newEvidenceNo,
     *     evidence_name: file.name,
     *     evidence_path: s3Key, // 例: 'evidences/1/TID-001/1_1_1_123456789.png'
     *   },
     * });
     */

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/evidences',
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          evidenceId: evidenceRecord ? evidenceRecord.id : null,
          evidenceNo: newEvidenceNo,
          evidenceName: file.name,
          evidencePath: `/uploads/evidences/${testGroupId}/${tid}/${fileName}`,
          testCaseNo: parsedTestCaseNo,
          historyCount: parsedHistoryCount,
        },
      },
      { status: STATUS_CODES.CREATED }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'POST',
      '/api/evidences'
    );
  }
}

/**
 * ========================
 * DELETE /api/evidences用のAWS S3移行時の変更点
 * ========================
 */

// DELETE /api/evidences - エビデンスファイル削除
export async function DELETE(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // リクエストボディから削除対象のエビデンス情報を取得
    const body = await req.json();
    const { testGroupId, tid, testCaseNo, historyCount, evidenceNo } = body;

    if (!testGroupId || !tid || testCaseNo === undefined || historyCount === undefined || evidenceNo === undefined) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        '/api/evidences'
      );
    }

    // データベースからエビデンス情報を取得
    const evidenceRecord = await prisma.tt_test_evidences.findFirst({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        test_case_no: parseInt(testCaseNo, 10),
        history_count: parseInt(historyCount, 10),
        evidence_no: parseInt(evidenceNo, 10),
      },
    });

    if (!evidenceRecord) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        '/api/evidences'
      );
    }

    // ==================== 物理ファイルを削除（現在の実装：ローカルディスク） ====================
    if (evidenceRecord.evidence_path) {
      const filePath = join(process.cwd(), 'public', evidenceRecord.evidence_path);
      try {
        await rm(filePath, { force: true });
      } catch (error) {
        console.warn(`Failed to delete evidence file: ${filePath}`, error);
      }
    }

    /**
     * ==================== AWS S3からファイル削除（移行後の実装） ====================
     *
     * if (evidenceRecord.evidence_path) {
     *   const s3Key = evidenceRecord.evidence_path;
     *
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
     */

    // データベースから削除
    await prisma.tt_test_evidences.deleteMany({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        test_case_no: parseInt(testCaseNo, 10),
        history_count: parseInt(historyCount, 10),
        evidence_no: parseInt(evidenceNo, 10),
      },
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: '/api/evidences',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Evidence file deleted successfully',
      },
      { status: STATUS_CODES.OK }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      '/api/evidences'
    );
  }
}
