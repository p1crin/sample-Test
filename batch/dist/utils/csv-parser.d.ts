import { UserCsvRow, ValidationResult } from '../types/user-import.types';
/**
 * CSV文字列をパースする
 */
export declare function parseCsv(csvContent: string): UserCsvRow[];
/**
 * CSV行をバリデーション
 */
export declare function validateUserRow(row: UserCsvRow, rowNumber: number): ValidationResult;
/**
 * 全CSV行をバリデーション
 */
export declare function validateAllRows(rows: UserCsvRow[]): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=csv-parser.d.ts.map