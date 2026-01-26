import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * パスワードをハッシュ化する
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    console.error('パスワードハッシュ化エラー:', error);
    throw new Error(`パスワードのハッシュ化に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * パスワードを検証する（既存パスワードとの比較用）
 */
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('パスワード検証エラー:', error);
    return false;
  }
}