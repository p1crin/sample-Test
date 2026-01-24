"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const s3_client_1 = require("./utils/s3-client");
const csv_parser_1 = require("./utils/csv-parser");
const password_hash_1 = require("./utils/password-hash");
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
/**
 * 環境変数の検証
 */
function validateEnvironmentVariables() {
    const required = ['INPUT_S3_BUCKET', 'INPUT_S3_KEY', 'OUTPUT_S3_BUCKET', 'DATABASE_URL'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`必須の環境変数が設定されていません: ${missing.join(', ')}`);
    }
}
/**
 * トランザクション内で1ユーザをインポート
 */
async function importUserInTransaction(tx, row, rowNumber) {
    const result = {
        row: rowNumber,
        email: row.email,
        name: row.name,
        success: false,
        operation: 'error',
    };
    try {
        const isNewUser = !row.id || row.id.trim() === '';
        const userRole = parseInt(row.user_role, 10);
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
            const hashedPassword = await (0, password_hash_1.hashPassword)(row.password);
            // ユーザ作成
            await tx.mt_users.create({
                data: {
                    email: row.email,
                    name: row.name,
                    user_role: userRole,
                    department: row.department || '',
                    company: row.company || '',
                    password: hashedPassword,
                    is_deleted: false,
                },
            });
            result.success = true;
            result.operation = 'created';
        }
        else {
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
            const updateData = {
                email: row.email,
                name: row.name,
                user_role: userRole,
                department: row.department || '',
                company: row.company || '',
            };
            // パスワードが指定されている場合のみ更新
            if (row.password && row.password.trim() !== '') {
                updateData.password = await (0, password_hash_1.hashPassword)(row.password);
            }
            // ユーザ更新
            await tx.mt_users.update({
                where: { id: userId },
                data: updateData,
            });
            result.success = true;
            result.operation = 'updated';
        }
        return result;
    }
    catch (error) {
        result.errorMessage = error instanceof Error ? error.message : String(error);
        throw error; // トランザクションをロールバックするためにエラーを再スロー
    }
}
/**
 * メイン処理
 */
async function main() {
    const startTime = new Date();
    console.log('ユーザインポートバッチを開始します...');
    let importResultId = null;
    try {
        // 環境変数の検証
        validateEnvironmentVariables();
        const inputBucket = process.env.INPUT_S3_BUCKET;
        const inputKey = process.env.INPUT_S3_KEY;
        const outputBucket = process.env.OUTPUT_S3_BUCKET;
        const executorName = process.env.EXECUTOR_NAME || 'system';
        console.log(`入力: s3://${inputBucket}/${inputKey}`);
        // 実行開始をDBに記録（import_status=0: 実施中）
        const importRecord = await prisma.tt_import_results.create({
            data: {
                file_name: inputKey,
                import_status: 0, // 0: 実施中
                executor_name: executorName,
                import_type: 2, // 2: ユーザインポート
                count: 0,
                message: 'インポート処理を開始しました',
            },
        });
        importResultId = importRecord.id;
        console.log(`インポート実行ID: ${importResultId}`);
        // S3からCSVを読み込み
        console.log('CSVファイルを読み込み中...');
        const csvContent = await (0, s3_client_1.readCsvFromS3)(inputBucket, inputKey);
        // CSVをパース
        console.log('CSVをパース中...');
        const rows = (0, csv_parser_1.parseCsv)(csvContent);
        console.log(`${rows.length}件のユーザデータを検出しました`);
        if (rows.length === 0) {
            throw new Error('CSVにデータが含まれていません');
        }
        // 事前バリデーション
        console.log('全行のバリデーションを実行中...');
        const validation = (0, csv_parser_1.validateAllRows)(rows);
        if (!validation.valid) {
            console.error('バリデーションエラー:');
            validation.errors.forEach(err => console.error(`  - ${err}`));
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
            // S3に結果を書き込み（参考用）
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const resultJsonKey = `user-import-results/result-${timestamp}.json`;
            await (0, s3_client_1.writeResultToS3)(outputBucket, resultJsonKey, JSON.stringify({ error: errorMessage, errors: validation.errors }, null, 2));
            console.error(`\n結果ファイル: s3://${outputBucket}/${resultJsonKey}`);
            process.exit(1);
        }
        // トランザクション内で全ユーザをインポート
        console.log('ユーザデータをインポート中...');
        const results = [];
        let createdCount = 0;
        let updatedCount = 0;
        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const rowNumber = i + 2; // ヘッダー行を考慮
                console.log(`[${i + 1}/${rows.length}] ${row.email} を処理中...`);
                try {
                    const result = await importUserInTransaction(tx, row, rowNumber);
                    results.push(result);
                    if (result.operation === 'created') {
                        createdCount++;
                    }
                    else if (result.operation === 'updated') {
                        updatedCount++;
                    }
                }
                catch (error) {
                    // エラーが発生したらトランザクション全体をロールバック
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`  エラー: ${errorMessage}`);
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
        const summary = {
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
        // 結果をS3に書き込み
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultJsonKey = `user-import-results/result-${timestamp}.json`;
        const resultCsvKey = `user-import-results/result-${timestamp}.csv`;
        console.log('結果をS3に書き込み中...');
        await (0, s3_client_1.writeResultToS3)(outputBucket, resultJsonKey, JSON.stringify(summary, null, 2));
        await (0, s3_client_1.writeImportResultCsv)(outputBucket, resultCsvKey, results);
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
        // 結果を表示
        console.log('\n=== インポート完了 ===');
        console.log(successMessage);
        console.log(`\n結果ファイル:`);
        console.log(`  JSON: s3://${outputBucket}/${resultJsonKey}`);
        console.log(`  CSV: s3://${outputBucket}/${resultCsvKey}`);
    }
    catch (error) {
        console.error('ユーザインポートバッチでエラーが発生しました:', error);
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
            }
            else {
                // インポートレコード作成前のエラー
                await prisma.tt_import_results.create({
                    data: {
                        file_name: process.env.INPUT_S3_KEY || 'unknown',
                        import_status: 2, // 2: エラー
                        executor_name: process.env.EXECUTOR_NAME || 'system',
                        import_type: 2, // 2: ユーザインポート
                        count: 0,
                        message: errorMessage,
                    },
                });
            }
        }
        catch (dbError) {
            console.error('エラー記録の保存に失敗しました:', dbError);
        }
        process.exit(1);
    }
    finally {
        await prisma.$disconnect();
    }
}
// バッチ実行
main();
//# sourceMappingURL=user-import.js.map