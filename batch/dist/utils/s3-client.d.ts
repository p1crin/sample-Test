/**
 * S3からCSVファイルを読み込む
 */
export declare function readCsvFromS3(bucket: string, key: string): Promise<string>;
/**
 * S3に結果ファイルを書き込む
 */
export declare function writeResultToS3(bucket: string, key: string, content: string, contentType?: string): Promise<void>;
/**
 * インポート結果のCSVを生成してS3に書き込む
 */
export declare function writeImportResultCsv(bucket: string, key: string, results: Array<{
    row: number;
    email: string;
    name: string;
    success: boolean;
    operation: string;
    errorMessage?: string;
}>): Promise<void>;
//# sourceMappingURL=s3-client.d.ts.map