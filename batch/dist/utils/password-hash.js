"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const SALT_ROUNDS = 10;
/**
 * パスワードをハッシュ化する
 */
async function hashPassword(plainPassword) {
    try {
        const hashedPassword = await bcrypt_1.default.hash(plainPassword, SALT_ROUNDS);
        return hashedPassword;
    }
    catch (error) {
        console.error('パスワードハッシュ化エラー:', error);
        throw new Error(`パスワードのハッシュ化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * パスワードを検証する（既存パスワードとの比較用）
 */
async function verifyPassword(plainPassword, hashedPassword) {
    try {
        return await bcrypt_1.default.compare(plainPassword, hashedPassword);
    }
    catch (error) {
        console.error('パスワード検証エラー:', error);
        return false;
    }
}
//# sourceMappingURL=password-hash.js.map