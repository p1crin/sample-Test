"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsv = parseCsv;
exports.validateUserRow = validateUserRow;
exports.validateAllRows = validateAllRows;
const sync_1 = require("csv-parse/sync");
const user_import_types_1 = require("../types/user-import.types");
/**
 * CSV文字列をパースする
 */
function parseCsv(csvContent) {
    try {
        const records = (0, sync_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true, // BOM対応
        });
        return records;
    }
    catch (error) {
        console.error('CSVパースエラー:', error);
        throw new Error(`CSVのパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * メールアドレスの形式をバリデーション
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
/**
 * ユーザロールのバリデーション
 */
function isValidUserRole(role) {
    const roleNum = parseInt(role, 10);
    return !isNaN(roleNum) && [user_import_types_1.UserRole.SYSTEM_ADMIN, user_import_types_1.UserRole.TEST_MANAGER, user_import_types_1.UserRole.GENERAL].includes(roleNum);
}
/**
 * CSV行をバリデーション
 */
function validateUserRow(row, rowNumber) {
    const errors = [];
    // 必須項目チェック
    if (!row.name || row.name.trim() === '') {
        errors.push(`${rowNumber}行目: 名前は必須です`);
    }
    if (!row.email || row.email.trim() === '') {
        errors.push(`${rowNumber}行目: メールアドレスは必須です`);
    }
    else if (!isValidEmail(row.email)) {
        errors.push(`${rowNumber}行目: メールアドレスの形式が不正です`);
    }
    if (!row.user_role && row.user_role !== '0') {
        errors.push(`${rowNumber}行目: ユーザロールは必須です`);
    }
    else if (!isValidUserRole(row.user_role)) {
        errors.push(`${rowNumber}行目: ユーザロールは0(システム管理者)、1(テスト管理者)、2(一般)のいずれかである必要があります`);
    }
    // 新規ユーザの場合（IDが空）、パスワードは必須
    const isNewUser = !row.id || row.id.trim() === '';
    if (isNewUser) {
        if (!row.password || row.password.trim() === '') {
            errors.push(`${rowNumber}行目: 新規ユーザの場合、パスワードは必須です`);
        }
    }
    // IDが指定されている場合、数値かチェック
    if (row.id && row.id.trim() !== '') {
        const userId = parseInt(row.id, 10);
        if (isNaN(userId) || userId <= 0) {
            errors.push(`${rowNumber}行目: ユーザIDは正の整数である必要があります`);
        }
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * 全CSV行をバリデーション
 */
function validateAllRows(rows) {
    const allErrors = [];
    rows.forEach((row, index) => {
        const rowNumber = index + 2; // ヘッダー行を考慮して+2
        const result = validateUserRow(row, rowNumber);
        if (!result.valid) {
            allErrors.push(...result.errors);
        }
    });
    return {
        valid: allErrors.length === 0,
        errors: allErrors,
    };
}
//# sourceMappingURL=csv-parser.js.map