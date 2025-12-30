import * as bcrypt from 'bcryptjs';

const saltRounds = 10;

/**
 * パスワードをハッシュ化する関数
 * @param password - ハッシュ化するパスワード
 * @returns ハッシュ化されたパスワード
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
}