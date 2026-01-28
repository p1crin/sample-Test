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

    // 空の列（すべての行で値が空の列）を除去
    return removeEmptyColumns(records);
  } catch (error) {
    console.error('CSVパースエラー:', error);
    throw new Error(`CSVのパースに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * すべての行で値が空の列を除去する
 * （ヘッダーのみ存在し、データがすべて空の列を無視）
 */
export function removeEmptyColumns(records: Record<string, string>[]): Record<string, string>[] {
  if (records.length === 0) {
    return records;
  }

  // 全カラム名を取得
  const allColumns = Object.keys(records[0]);

  // すべての行で値が空の列を特定
  const emptyColumns = allColumns.filter(column =>
    records.every(record => !record[column] || record[column].trim() === '')
  );

  // 空の列がない場合はそのまま返す
  if (emptyColumns.length === 0) {
    return records;
  }

  console.log(`空の列を無視します: ${emptyColumns.join(', ')}`);

  // 空の列を除去した新しいレコード配列を返す
  return records.map(record => {
    const newRecord: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!emptyColumns.includes(key)) {
        newRecord[key] = value;
      }
    }
    return newRecord;
  });
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
