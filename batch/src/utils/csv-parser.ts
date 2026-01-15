import { parse } from 'csv-parse/sync';
import { UserCsvRow, ValidationResult, UserRole } from '../types/user-import.types';

/**
 * CSV文字列をパースする
 */
export function parseCsv(csvContent: string): UserCsvRow[] {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // BOM対応
    }) as UserCsvRow[];

    return records;
  } catch (error) {
    console.error('CSVパースエラー:', error);
    throw new Error(`CSVのパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * メールアドレスの形式をバリデーション
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * ユーザロールのバリデーション
 */
function isValidUserRole(role: string): boolean {
  const roleNum = parseInt(role, 10);
  return !isNaN(roleNum) && [UserRole.SYSTEM_ADMIN, UserRole.TEST_MANAGER, UserRole.GENERAL].includes(roleNum);
}

/**
 * CSV行をバリデーション
 */
export function validateUserRow(row: UserCsvRow, rowNumber: number): ValidationResult {
  const errors: string[] = [];

  // 必須項目チェック
  if (!row.name || row.name.trim() === '') {
    errors.push(`${rowNumber}行目: 名前は必須です`);
  }

  if (!row.email || row.email.trim() === '') {
    errors.push(`${rowNumber}行目: メールアドレスは必須です`);
  } else if (!isValidEmail(row.email)) {
    errors.push(`${rowNumber}行目: メールアドレスの形式が不正です`);
  }

  if (!row.user_role && row.user_role !== '0') {
    errors.push(`${rowNumber}行目: ユーザロールは必須です`);
  } else if (!isValidUserRole(row.user_role)) {
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
export function validateAllRows(rows: UserCsvRow[]): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];

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
