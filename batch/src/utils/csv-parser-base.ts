import { parse } from 'csv-parse/sync';

/**
 * 基本的なCSVパース処理（共通基盤）
 * 各ドメイン固有のパーサーから利用される
 */
export function parseCsvBase(csvContent: string): Record<string, string>[] {
  try {
    const records = parse(csvContent, {
      columns: true,  // ヘッダー行を自動認識
      skip_empty_lines: true,
      trim: true,
      bom: true, // BOM対応
    }) as Record<string, string>[];

    return records;
  } catch (error) {
    console.error('CSVパースエラー:', error);
    throw new Error(`CSVのパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 日本語ヘッダーをマッピングして正規化する汎用関数
 */
export function normalizeRowWithMapping<T>(
  rawRow: Record<string, string>,
  columnMapping: Record<string, keyof T>,
  defaultValues: T
): T {
  const normalized: Partial<T> = {};

  for (const [key, value] of Object.entries(rawRow)) {
    const mappedKey = columnMapping[key];
    if (mappedKey) {
      normalized[mappedKey] = (value || '') as T[keyof T];
    }
  }

  // デフォルト値をマージ
  return { ...defaultValues, ...normalized };
}

/**
 * バリデーションエラーを集約する汎用関数
 */
export function validateAllRowsGeneric<T>(
  rows: T[],
  validateRow: (row: T, rowNumber: number) => { valid: boolean; errors: string[] }
): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // ヘッダー行を考慮して+2
    const result = validateRow(row, rowNumber);
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
