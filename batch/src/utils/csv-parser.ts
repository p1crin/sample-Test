import { UserCsvRow, ValidationResult, UserRole } from '../types/user-import.types';
import { parseCsvBase, normalizeRowWithMapping } from './csv-parser-base';

/**
 * 日本語ヘッダーから英語プロパティ名へのマッピング
 */
const COLUMN_MAPPING: Record<string, keyof UserCsvRow> = {
  // 日本語ヘッダー
  'ID': 'id',
  'ID(メールアドレス)': 'email',
  '氏名': 'name',
  'パスワード': 'password',
  '部署': 'department',
  '会社名': 'company',
  '権限': 'user_role',
  'タグ': 'tags',
  'ステータス': 'status',
};

/**
 * UserCsvRowのデフォルト値
 */
const DEFAULT_USER_ROW: UserCsvRow = {
  id: '',
  name: '',
  email: '',
  user_role: '',
  department: '',
  company: '',
  password: '',
  tags: '',
  status: '',
};

/**
 * CSVの行データを正規化する（日本語ヘッダー対応）
 */
function normalizeRow(rawRow: Record<string, string>): UserCsvRow {
  return normalizeRowWithMapping(rawRow, COLUMN_MAPPING, DEFAULT_USER_ROW);
}

/**
 * CSV文字列をパースする
 */
export function parseCsv(csvContent: string): UserCsvRow[] {
  const records = parseCsvBase(csvContent);
  // 各行を正規化（日本語→英語プロパティ名に変換）
  return records.map(rawRow => normalizeRow(rawRow));
}

/**
 * メールアドレスの形式をバリデーション
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 権限のバリデーション
 */
function isValidUserRole(role: string): boolean {
  const roleNum = parseInt(role, 10);
  return !isNaN(roleNum) && [UserRole.SYSTEM_ADMIN, UserRole.TEST_MANAGER, UserRole.GENERAL].includes(roleNum);
}

/**
 * ステータスのバリデーション
 */
function isValidStatus(status: string): boolean {
  if (!status || status.trim() === '') {
    return true; // 空の場合はデフォルト値（有効）を使用
  }
  const normalized = status.trim().toLowerCase();
  return ['0', '1'].includes(normalized);
}

/**
 * ステータスをis_deletedフラグに変換
 */
export function parseStatus(status: string): boolean {
  if (!status || status.trim() === '') {
    return false; // デフォルトは有効（is_deleted=false）
  }
  const normalized = status.trim().toLowerCase();
  // 無効の場合はtrue（is_deleted=true）
  return ['1'].includes(normalized);
}

/**
 * CSV行をバリデーション
 */
export function validateUserRow(row: UserCsvRow, rowNumber: number): ValidationResult {
  const errors: string[] = [];

  // 必須項目チェック
  if (!row.name || row.name.trim() === '') {
    errors.push(`${rowNumber}行目: 氏名は必須です`);
  }

  if (!row.email || row.email.trim() === '') {
    errors.push(`${rowNumber}行目: ID(メールアドレス)は必須です`);
  } else if (!isValidEmail(row.email)) {
    errors.push(`${rowNumber}行目: メールアドレスの形式が不正です`);
  }

  if (!row.user_role && row.user_role !== '0') {
    errors.push(`${rowNumber}行目: 権限は必須です`);
  } else if (!isValidUserRole(row.user_role)) {
    errors.push(`${rowNumber}行目: 権限は0(システム管理者)、1(テスト管理者)、2(一般)のいずれかである必要があります`);
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
      errors.push(`${rowNumber}行目: IDは正の整数である必要があります`);
    }
  }

  // ステータスのバリデーション
  if (row.status && row.status.trim() !== '') {
    if (!isValidStatus(row.status)) {
      errors.push(`${rowNumber}行目: ステータスは0(有効)、1(無効)のいずれかである必要があります`);
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