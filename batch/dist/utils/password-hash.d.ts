/**
 * パスワードをハッシュ化する
 */
export declare function hashPassword(plainPassword: string): Promise<string>;
/**
 * パスワードを検証する（既存パスワードとの比較用）
 */
export declare function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean>;
//# sourceMappingURL=password-hash.d.ts.map