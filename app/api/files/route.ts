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
 * import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

// POST /api/files - ファイルアップロード
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // FormDataからファイルとメタデータを取得
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const testGroupId = formData.get('testGroupId') as string;
    const tid = formData.get('tid') as string;
    const fileType = parseInt(formData.get('fileType') as string, 10); // 0: controlSpec, 1: dataFlow

    if (!file || !testGroupId || !tid || isNaN(fileType)) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'POST',
        '/api/files'
      );
    }

    // テストグループの存在確認と権限チェック
    const testGroup = await prisma.tt_test_groups.findUnique({
      where: { id: parseInt(testGroupId, 10), is_deleted: false },
    });

    if (!testGroup) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'POST',
        '/api/files'
      );
    }

    // ==================== ローカルディスク保存（現在の実装） ====================
    // ファイル保存ディレクトリ
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'test-cases', testGroupId, tid);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // ファイル名生成（タイムスタンプ + 元のファイル名）
    const fileTypePrefix = fileType === 0 ? 'control_spec' : 'data_flow';
    const fileName = `${fileTypePrefix}_${Date.now()}_${file.name}`;
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
     * const fileTypePrefix = fileType === 0 ? 'control_spec' : 'data_flow';
     * const fileName = `${fileTypePrefix}_${Date.now()}_${file.name}`;
     * const s3Key = `test-cases/${testGroupId}/${tid}/${fileName}`;
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
     *   // オプション: ファイルのメタデータを追加
     *   Metadata: {
     *     originalName: file.name,
     *     testGroupId: testGroupId,
     *     tid: tid,
     *     fileType: String(fileType),
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
     * // S3のURLを生成（file_pathとして保存）
     * // オプション1: 署名付きURL（一時的なアクセス）を後で生成する場合はs3Keyのみ保存
     * // オプション2: パブリックアクセスの場合は直接URLを保存
     * const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
     *
     * 【注意点】
     * 1. ローカルの場合：file_path = '/uploads/test-cases/1/TID-001/file.pdf'（publicディレクトリからの相対パス）
     * 2. S3の場合：file_path = s3Key または s3Url（アクセス方法により選択）
     * 3. S3では署名付きURL（presigned URL）を使用して一時的なアクセスを提供することを推奨
     * 4. 画像の表示時には署名付きURLを生成するAPIエンドポイントを別途作成する必要がある
     */

    // データベースに記録
    // 最大file_noを取得
    const maxFileNo = await prisma.tt_test_case_files.findFirst({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_type: fileType,
      },
      orderBy: {
        file_no: 'desc',
      },
    });

    const newFileNo = (maxFileNo?.file_no ?? 0) + 1;

    // ==================== データベースに記録（現在の実装：ローカルパス） ====================
    const fileRecord = await prisma.tt_test_case_files.create({
      data: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_type: fileType,
        file_no: newFileNo,
        file_name: file.name,
        file_path: `/uploads/test-cases/${testGroupId}/${tid}/${fileName}`, // ローカル: publicからの相対パス
      },
    });

    /**
     * ==================== データベースに記録（移行後：S3キーまたはURL） ====================
     *
     * 【S3移行時の変更】
     * file_pathの値を以下のいずれかに変更：
     *
     * オプション1: S3キーのみを保存（推奨）
     * const fileRecord = await prisma.tt_test_case_files.create({
     *   data: {
     *     test_group_id: parseInt(testGroupId, 10),
     *     tid: tid,
     *     file_type: fileType,
     *     file_no: newFileNo,
     *     file_name: file.name,
     *     file_path: s3Key, // 例: 'test-cases/1/TID-001/control_spec_123456789_file.pdf'
     *   },
     * });
     *
     * オプション2: 完全なS3 URLを保存
     * const fileRecord = await prisma.tt_test_case_files.create({
     *   data: {
     *     test_group_id: parseInt(testGroupId, 10),
     *     tid: tid,
     *     file_type: fileType,
     *     file_no: newFileNo,
     *     file_name: file.name,
     *     file_path: s3Url, // 例: 'https://bucket.s3.region.amazonaws.com/test-cases/...'
     *   },
     * });
     *
     * 【推奨】オプション1（S3キーのみ保存）
     * 理由：
     * - バケット名やリージョンが変更されても影響を受けない
     * - 署名付きURLを動的に生成できる
     * - ファイルアクセス時にアクセス制御を柔軟に実装できる
     */

    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/files',
      userId: user.id,
      statusCode: STATUS_CODES.CREATED,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          fileId: fileRecord.id,
          fileNo: fileRecord.file_no,
          fileName: fileRecord.file_name,
          filePath: fileRecord.file_path,
          fileType: fileRecord.file_type,
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
      '/api/files'
    );
  }
}

/**
 * ========================
 * DELETE /api/files用のAWS S3移行時の変更点
 * ========================
 *
 * 【インポート追加】
 * import { DeleteObjectCommand } from '@aws-sdk/client-s3';
 */

// DELETE /api/files - ファイル削除
export async function DELETE(req: NextRequest) {
  const apiTimer = new QueryTimer();

  try {
    const user = await requireAuth(req);

    // リクエストボディから削除対象のファイル情報を取得
    const body = await req.json();
    const { testGroupId, tid, fileNo, fileType } = body;

    if (!testGroupId || !tid || fileNo === undefined || fileType === undefined) {
      return handleError(
        new Error(ERROR_MESSAGES.BAD_REQUEST),
        STATUS_CODES.BAD_REQUEST,
        apiTimer,
        'DELETE',
        '/api/files'
      );
    }

    // データベースからファイル情報を取得
    const fileRecord = await prisma.tt_test_case_files.findFirst({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_no: fileNo,
        file_type: fileType,
      },
    });

    if (!fileRecord) {
      return handleError(
        new Error(ERROR_MESSAGES.NOT_FOUND),
        STATUS_CODES.NOT_FOUND,
        apiTimer,
        'DELETE',
        '/api/files'
      );
    }

    // ==================== 物理ファイルを削除（現在の実装：ローカルディスク） ====================
    if (fileRecord.file_path) {
      const filePath = join(process.cwd(), 'public', fileRecord.file_path);
      try {
        await rm(filePath, { force: true });
      } catch (error) {
        console.warn(`Failed to delete file: ${filePath}`, error);
      }
    }

    /**
     * ==================== AWS S3からファイル削除（移行後の実装） ====================
     *
     * 【上記のローカルファイル削除を以下のS3削除に置き換える】
     *
     * if (fileRecord.file_path) {
     *   // S3キーを取得（file_pathに保存されているもの）
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
     *     // S3でファイルが見つからない場合でもエラーを無視
     *     // （既に削除されている可能性があるため）
     *     console.warn(`Failed to delete file from S3: ${s3Key}`, s3Error);
     *   }
     * }
     *
     * 【注意点】
     * 1. S3の削除は非同期で行われるが、削除コマンドは即座に成功を返す
     * 2. 存在しないキーを削除してもエラーにならない（冪等性がある）
     * 3. トランザクションは使用できないため、DBからの削除が成功してもS3削除が失敗する可能性がある
     * 4. 定期的なクリーンアップジョブで孤立したS3オブジェクトを削除することを推奨
     */

    // データベースから削除
    await prisma.tt_test_case_files.deleteMany({
      where: {
        test_group_id: parseInt(testGroupId, 10),
        tid: tid,
        file_no: fileNo,
        file_type: fileType,
      },
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: '/api/files',
      userId: user.id,
      statusCode: STATUS_CODES.OK,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'File deleted successfully',
      },
      { status: STATUS_CODES.OK }
    );
  } catch (error) {
    return handleError(
      error as Error,
      STATUS_CODES.INTERNAL_SERVER_ERROR,
      apiTimer,
      'DELETE',
      '/api/files'
    );
  }
}
