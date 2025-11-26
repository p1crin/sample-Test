import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Upload file to S3
 * @param file File object
 * @param folder S3 folder path
 * @returns Object with URL and S3 key
 */
export async function uploadFileToS3(
  file: File,
  folder: string
): Promise<{ url: string; key: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${randomString}-${sanitizedFileName}`;
    const key = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: file.type,
    });

    await s3Client.send(command);

    const url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return { url, key };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('ファイルのアップロードに失敗しました');
  }
}

/**
 * Delete file from S3
 * @param key S3 object key
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('ファイルの削除に失敗しました');
  }
}

/**
 * Generate presigned URL for file download
 * @param key S3 object key
 * @param expiresIn URL expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Generate presigned URL error:', error);
    throw new Error('署名付きURLの生成に失敗しました');
  }
}

/**
 * Copy a file from temp/ folder to production folder
 *
 * Architecture:
 * 1. Files are first uploaded to temp/ folder via presigned URL
 * 2. On registration, files are copied from temp/ to production folder
 * 3. S3 lifecycle policy auto-deletes temp/ files after 24 hours
 *
 * @param tempS3Key - Temporary S3 key (e.g., "temp/evidence/123-file.png")
 * @param productionFolder - Production folder name (e.g., "evidence", "test-cases")
 * @returns Production S3 key
 */
export async function copyFromTempToProduction(
  tempS3Key: string,
  productionFolder: string
): Promise<string> {
  try {
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('S3バケット名が設定されていません');
    }

    // Extract filename from temp key: temp/evidence/123-file.png -> 123-file.png
    const fileName = tempS3Key.split('/').pop();
    if (!fileName) {
      throw new Error('Invalid temp S3 key');
    }

    // Create production key: evidence/123-file.png
    const productionKey = `${productionFolder}/${fileName}`;

    // Copy file from temp/ to production folder
    const copyCommand = new CopyObjectCommand({
      Bucket: bucketName,
      CopySource: `${bucketName}/${tempS3Key}`,
      Key: productionKey,
    });

    await s3Client.send(copyCommand);

    // Note: We don't delete the temp file here
    // S3 lifecycle policy will auto-delete it after 24 hours

    return productionKey;
  } catch (error) {
    console.error('S3 copy error:', error);
    throw new Error('ファイルのコピーに失敗しました');
  }
}

/**
 * Copy multiple files from temp/ to production folder
 * @param tempS3Keys - Array of temporary S3 keys
 * @param productionFolder - Production folder name
 * @returns Array of production S3 keys
 */
export async function copyMultipleFromTempToProduction(
  tempS3Keys: string[],
  productionFolder: string
): Promise<string[]> {
  const productionKeys: string[] = [];

  for (const tempKey of tempS3Keys) {
    const productionKey = await copyFromTempToProduction(tempKey, productionFolder);
    productionKeys.push(productionKey);
  }

  return productionKeys;
}
