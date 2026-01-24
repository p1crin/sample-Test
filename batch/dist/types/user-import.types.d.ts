/**
 * CSVの1行を表す型
 */
export interface UserCsvRow {
    id: string;
    name: string;
    email: string;
    user_role: string;
    department: string;
    company: string;
    password: string;
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
    row: number;
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
export declare enum UserRole {
    SYSTEM_ADMIN = 0,
    TEST_MANAGER = 1,
    GENERAL = 2
}
//# sourceMappingURL=user-import.types.d.ts.map