import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import clientLogger from '@/utils/client-logger';

/**
 * ストレージタイプの判定
 * 本番環境ではS3、開発環境ではローカルストレージを使用
 */
const isProduction = process.env.NODE_ENV === 'production';
const useS3 = isProduction && process.env.AWS_S3_BUCKET_NAME;

/**
 * S3クライアントの初期化（本番環境のみ）
 */
const s3Client = useS3
  ? new S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
      : undefined,
  })
  : null;

/**
 * ファイルアップロード結果
 */
export interface UploadResult {
  /** ファイルパス（ローカル: /uploads/..., S3: s3://bucket/key または key） */
  filePath: string;
  /** ファイル名 */
  fileName: string;
}

/**
 * ファイルをストレージにアップロード
 * 環境に応じてローカルディスクまたはS3に保存
 */
export async function uploadFile(
  file: File,
  directory: string,
  fileName: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (useS3 && s3Client) {
    // 本番環境: S3にアップロード
    const s3Key = `${directory}/${fileName}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      Metadata: metadata,
    });

    try {
      await s3Client.send(uploadCommand);

      // S3キーを返す（署名付きURL生成時に使用）
      return {
        filePath: s3Key,
        fileName: fileName,
      };
    } catch (error) {
      clientLogger.error('uploadFile', 'S3ファイルアップロード失敗', { error });
      throw new Error('File upload to S3 failed');
    }
  } else {
    // 開発環境: ローカルディスクに保存
    const uploadDir = join(process.cwd(), 'public', 'uploads', directory);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // publicからの相対パスを返す
    return {
      filePath: `/uploads/${directory}/${fileName}`,
      fileName: fileName,
    };
  }
}

/**
 * ストレージからファイルを削除
 * 環境に応じてローカルディスクまたはS3から削除
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (!filePath) return;

  if (useS3 && s3Client) {
    // 本番環境: S3から削除
    const s3Key = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
    });

    try {
      await s3Client.send(deleteCommand);
    } catch (error) {
      clientLogger.error('deleteFile', `S3ファイル削除失敗 S3: ${s3Key}`, { error });
    }
  } else {
    // 開発環境: ローカルディスクから削除
    const localPath = join(process.cwd(), 'public', filePath);

    try {
      await rm(localPath, { force: true });
    } catch (error) {
      clientLogger.error('deleteFile', `ローカルファイル削除失敗 local file: ${localPath}`, { error });
    }
  }
}

/**
 * ストレージタイプを取得（デバッグ用）
 */
export function getStorageType(): 'S3' | 'Local' {
  return useS3 ? 'S3' : 'Local';
}

/**
 * ファイルの署名付きURLを生成
 * S3の場合は署名付きURL、ローカルの場合はそのままのパスを返す
 */
export async function getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  if (!filePath) return '';

  if (useS3 && s3Client) {
    // 本番環境: S3署名付きURLを生成
    const s3Key = filePath.startsWith('/') ? filePath.substring(1) : filePath;

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
    });

    try {
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      clientLogger.error('getFileUrl', `署名付きURL生成失敗`, { error });
      return '';
    }
  } else {
    // 開発環境: ローカルパスをそのまま返す
    return filePath;
  }
}