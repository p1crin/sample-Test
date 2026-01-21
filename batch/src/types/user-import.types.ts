/**
 * CSVの1行を表す型
 */
export interface UserCsvRow {
  id: string;              // 既存ユーザの場合はID、新規の場合は空文字
  name: string;
  email: string;
  user_role: string;       // 0: システム管理者, 1: テスト管理者, 2: 一般
  department: string;
  company: string;
  password: string;        // 平文パスワード（新規または更新時のみ）
  tags: string;            // タグ（セミコロン区切り）
  status: string;          // ステータス（有効/無効）
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 1ユーザのインポート結果
 */
export interface UserImportResult {
  row: number;             // CSV行番号
  email: string;
  name: string;
  success: boolean;
  operation: 'created' | 'updated' | 'skipped' | 'error';
  errorMessage?: string;
}

/**
 * 全体のインポート結果
 */
export interface ImportSummary {
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  results: UserImportResult[];
  startedAt: string;
  completedAt: string;
}

/**
 * ユーザロール
 */
export enum UserRole {
  SYSTEM_ADMIN = 0,
  TEST_MANAGER = 1,
  GENERAL = 2
}
