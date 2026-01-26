import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, writeFileSync } from 'fs';
import { Readable } from 'stream';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || '', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' },
});

/**
 * S3からCSVファイルを読み込む
 */
export async function readCsvFromS3(bucket: string, key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('S3オブジェクトが空です');
    }

    // StreamをStringに変換
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf-8');
  } catch (error) {
    console.error('S3からのCSV読み込みエラー:', error);
    throw new Error(`S3からのCSV読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * S3に結果ファイルを書き込む
 */
export async function writeResultToS3(
  bucket: string,
  key: string,
  content: string,
  contentType: string = 'application/json'
): Promise<void> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`結果ファイルをS3に書き込みました: s3://${bucket}/${key}`);
  } catch (error) {
    console.error('S3への結果書き込みエラー:', error);
    throw new Error(`S3への結果書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * インポート結果のCSVを生成してS3に書き込む
 */
export async function writeImportResultCsv(
  bucket: string,
  key: string,
  results: Array<{
    row: number;
    email: string;
    name: string;
    success: boolean;
    operation: string;
    errorMessage?: string;
  }>
): Promise<void> {
  // CSVヘッダー
  const header = '行番号,メールアドレス,名前,結果,操作,エラー詳細\n';

  // CSV行を生成
  const rows = results.map(r => {
    const result = r.success ? '成功' : '失敗';
    const operation = r.operation === 'created' ? '新規作成' :
      r.operation === 'updated' ? '更新' :
        r.operation === 'skipped' ? 'スキップ' : 'エラー';
    const errorMessage = r.errorMessage || '';

    return `${r.row},"${r.email}","${r.name}",${result},${operation},"${errorMessage}"`;
  }).join('\n');

  const csvContent = header + rows;

  await writeResultToS3(bucket, key, csvContent, 'text/csv; charset=utf-8');
}

/**
 * ローカルファイルからCSVファイルを読み込む
 */
export async function readCsvFromLocal(filePath: string): Promise<string> {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('ローカルファイルからのCSV読み込みエラー:', error);
    throw new Error(`ローカルファイルからのCSV読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * ローカルファイルに結果ファイルを書き込む
 */
export async function writeResultToLocal(
  filePath: string,
  content: string,
  contentType: string = 'application/json'
): Promise<void> {
  try {
    writeFileSync(filePath, content, { encoding: 'utf-8' });
    console.log(`結果ファイルをローカルに書き込みました: ${filePath}`);
  } catch (error) {
    console.error('ローカルファイルへの結果書き込みエラー:', error);
    throw new Error(`ローカルファイルへの結果書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * インポート結果のCSVを生成してローカルに書き込む
 */
export async function writeImportResultCsvToLocal(
  filePath: string,
  results: Array<{
    row: number;
    email: string;
    name: string;
    success: boolean;
    operation: string;
    errorMessage?: string;
  }>
): Promise<void> {
  // CSVヘッダー
  const header = '行番号,メールアドレス,名前,結果,操作,エラー詳細\n';

  // CSV行を生成
  const rows = results.map(r => {
    const result = r.success ? '成功' : '失敗';
    const operation = r.operation === 'created' ? '新規作成' :
      r.operation === 'updated' ? '更新' :
        r.operation === 'skipped' ? 'スキップ' : 'エラー';
    const errorMessage = r.errorMessage || '';

    return `${r.row},"${r.email}","${r.name}",${result},${operation},"${errorMessage}"`;
  }).join('\n');

  const csvContent = header + rows;

  await writeResultToLocal(filePath, csvContent, 'text/csv; charset=utf-8');
}

/**
 * S3からZIPファイルを読み込む
 */
export async function readZipFromS3(bucket: string, key: string): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('S3オブジェクトが空です');
    }

    // StreamをBufferに変換
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('S3からのZIP読み込みエラー:', error);
    throw new Error(`S3からのZIP読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * S3にファイルをアップロード
 */
export async function uploadFileToS3(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType?: string
): Promise<void> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`ファイルをS3にアップロードしました: s3://${bucket}/${key}`);
  } catch (error) {
    console.error('S3へのファイルアップロードエラー:', error);
    throw new Error(`S3へのファイルアップロードに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * テストケースインポート結果のCSVを生成してS3に書き込む
 */
export async function writeTestCaseImportResultCsv(
  bucket: string,
  key: string,
  results: Array<{
    row: number;
    tid: string;
    success: boolean;
    operation: string;
    errorMessage?: string;
    contentCount?: number;
  }>
): Promise<void> {
  // CSVヘッダー
  const header = '行番号,TID,結果,操作,テスト内容数,エラー詳細\n';

  // CSV行を生成
  const rows = results.map(r => {
    const result = r.success ? '成功' : '失敗';
    const operation = r.operation === 'created' ? '新規作成' : 'エラー';
    const contentCount = r.contentCount || 0;
    const errorMessage = r.errorMessage || '';

    return `${r.row},"${r.tid}",${result},${operation},${contentCount},"${errorMessage}"`;
  }).join('\n');

  const csvContent = header + rows;

  await writeResultToS3(bucket, key, csvContent, 'text/csv; charset=utf-8');
}