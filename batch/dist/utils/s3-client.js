"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCsvFromS3 = readCsvFromS3;
exports.writeResultToS3 = writeResultToS3;
exports.writeImportResultCsv = writeImportResultCsv;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-1',
});
/**
 * S3からCSVファイルを読み込む
 */
async function readCsvFromS3(bucket, key) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });
        const response = await s3Client.send(command);
        if (!response.Body) {
            throw new Error('S3オブジェクトが空です');
        }
        // StreamをStringに変換
        const stream = response.Body;
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
    }
    catch (error) {
        console.error('S3からのCSV読み込みエラー:', error);
        throw new Error(`S3からのCSV読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * S3に結果ファイルを書き込む
 */
async function writeResultToS3(bucket, key, content, contentType = 'application/json') {
    try {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: content,
            ContentType: contentType,
        });
        await s3Client.send(command);
        console.log(`結果ファイルをS3に書き込みました: s3://${bucket}/${key}`);
    }
    catch (error) {
        console.error('S3への結果書き込みエラー:', error);
        throw new Error(`S3への結果書き込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * インポート結果のCSVを生成してS3に書き込む
 */
async function writeImportResultCsv(bucket, key, results) {
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
//# sourceMappingURL=s3-client.js.map