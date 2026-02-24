
import { TestCaseCsvRow, Judgment, GroupedTestCase } from '../types/test-case-import.types';
import { ValidationResult } from '../types/user-import.types';
import { parseCsvBase, normalizeRowWithMapping } from './csv-parser-base';

/**
 * 日本語ヘッダーから英語プロパティ名へのマッピング
 */
const COLUMN_MAPPING: Record<string, keyof TestCaseCsvRow> = {
  'TID': 'tid',
  'No': 'no',
  '第1層': 'first_layer',
  '第2層': 'second_layer',
  '第3層': 'third_layer',
  '第4層': 'fourth_layer',
  '目的': 'purpose',
  '要求ID': 'request_id',
  '確認観点': 'check_items',
  '制御仕様': 'control_spec',
  'データフロー': 'data_flow',
  'テスト手順': 'test_procedure',
  'テストケース': 'test_case',
  '期待値': 'expected_value',
  '結果': 'result',
  '判定': 'judgment',
  '実施日': 'execution_date',
  'ソフトVer.': 'software_version',
  'ハードVer.': 'hardware_version',
  'コンパラVer.': 'comparator_version',
  '実施者': 'executor',
  'エビデンス': 'evidence',
  '備考': 'note',
};

/**
 * TestCaseCsvRowのデフォルト値
 */
const DEFAULT_TEST_CASE_ROW: TestCaseCsvRow = {
  tid: '',
  no: '',
  first_layer: '',
  second_layer: '',
  third_layer: '',
  fourth_layer: '',
  purpose: '',
  request_id: '',
  check_items: '',
  control_spec: '',
  data_flow: '',
  test_procedure: '',
  test_case: '',
  expected_value: '',
  result: '',
  judgment: '',
  execution_date: '',
  software_version: '',
  hardware_version: '',
  comparator_version: '',
  executor: '',
  evidence: '',
  note: '',
};

/**
 * CSVの行データを正規化する（日本語ヘッダー対応）
 */
function normalizeRow(rawRow: Record<string, string>): TestCaseCsvRow {
  return normalizeRowWithMapping(rawRow, COLUMN_MAPPING, DEFAULT_TEST_CASE_ROW);
}

/**
 * CSV文字列をパースする
 */
export function parseCsv(csvContent: string): TestCaseCsvRow[] {
  const records = parseCsvBase(csvContent);
  // 各行を正規化（日本語→英語プロパティ名に変換）
  return records.map(rawRow => normalizeRow(rawRow));
}

/**
 * TIDの形式をバリデーション
 */
function isValidTid(tid: string): boolean {
  // 半角ハイフンつながりの半角数字 (例: 1-1-1-1)
  const tidRegex = /^[0-9]+-[0-9]+-[0-9]+-[0-9]+$/;
  return tidRegex.test(tid);
}

/**
 * 判定値のバリデーション
 */
function isValidJudgment(judgment: string): boolean {
  const validJudgments = Object.values(Judgment);
  return validJudgments.includes(judgment as Judgment);
}

/**
 * 日付形式のバリデーション (yyyy/mm/dd)
 */
function isValidDate(dateStr: string): boolean {
  if (!dateStr || dateStr.trim() === '') {
    return true; // 空は許可（nullになる）
  }
  const dateRegex = /^\d{4}\/\d{1,2}\/\d{1,2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }
  // 実際の日付として有効かチェック
  const parts = dateStr.split('/');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return !isNaN(date.getTime());
}

/**
 * 日付文字列をDateオブジェクトに変換
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

/**
 * セミコロン区切りの文字列をパスの配列に変換
 */
export function parseFilePaths(pathStr: string): string[] {
  if (!pathStr || pathStr.trim() === '') {
    return [];
  }
  return pathStr
    .split(';')
    .map(path => path.trim())
    .filter(path => path !== '');
}

/**
 * CSV行をバリデーション
 */
export function validateTestCaseRow(row: TestCaseCsvRow, rowNumber: number): ValidationResult {
  const errors: string[] = [];

  // 必須項目チェック
  if (!row.tid || row.tid.trim() === '') {
    errors.push(`${rowNumber}行目: TIDは必須です`);
  } else if (!isValidTid(row.tid)) {
    errors.push(`${rowNumber}行目: TIDは半角ハイフンつながりの半角数字である必要があります（例: 1-1-1-1）`);
  }

  if (!row.no || row.no.trim() === '') {
    errors.push(`${rowNumber}行目: Noは必須です`);
  } else {
    const no = parseInt(row.no, 10);
    if (isNaN(no) || no <= 0) {
      errors.push(`${rowNumber}行目: Noは正の整数である必要があります`);
    }
  }

  if (!row.first_layer || row.first_layer.trim() === '') {
    errors.push(`${rowNumber}行目: 第1層は必須です`);
  } else if (row.first_layer.length > 255) {
    errors.push(`${rowNumber}行目: 第1層は255文字以内である必要があります`);
  }

  if (!row.second_layer || row.second_layer.trim() === '') {
    errors.push(`${rowNumber}行目: 第2層は必須です`);
  } else if (row.second_layer.length > 255) {
    errors.push(`${rowNumber}行目: 第2層は255文字以内である必要があります`);
  }

  if (!row.third_layer || row.third_layer.trim() === '') {
    errors.push(`${rowNumber}行目: 第3層は必須です`);
  } else if (row.third_layer.length > 255) {
    errors.push(`${rowNumber}行目: 第3層は255文字以内である必要があります`);
  }

  if (!row.fourth_layer || row.fourth_layer.trim() === '') {
    errors.push(`${rowNumber}行目: 第4層は必須です`);
  } else if (row.fourth_layer.length > 255) {
    errors.push(`${rowNumber}行目: 第4層は255文字以内である必要があります`);
  }

  if (!row.purpose || row.purpose.trim() === '') {
    errors.push(`${rowNumber}行目: 目的は必須です`);
  } else if (row.purpose.length > 255) {
    errors.push(`${rowNumber}行目: 目的は255文字以内である必要があります`);
  }

  if (!row.request_id || row.request_id.trim() === '') {
    errors.push(`${rowNumber}行目: 要求IDは必須です`);
  } else if (row.request_id.length > 255) {
    errors.push(`${rowNumber}行目: 要求IDは255文字以内である必要があります`);
  }

  if (!row.check_items || row.check_items.trim() === '') {
    errors.push(`${rowNumber}行目: 確認観点は必須です`);
  }

  if (!row.control_spec || row.control_spec.trim() === '') {
    errors.push(`${rowNumber}行目: 制御仕様は必須です`);
  }

  if (!row.data_flow || row.data_flow.trim() === '') {
    errors.push(`${rowNumber}行目: データフローは必須です`);
  }

  if (!row.test_procedure || row.test_procedure.trim() === '') {
    errors.push(`${rowNumber}行目: テスト手順は必須です`);
  }

  if (!row.test_case || row.test_case.trim() === '') {
    errors.push(`${rowNumber}行目: テストケースは必須です`);
  }

  if (!row.expected_value || row.expected_value.trim() === '') {
    errors.push(`${rowNumber}行目: 期待値は必須です`);
  }

  if (!row.judgment || row.judgment.trim() === '') {
    row.judgment = Judgment.NOT_STARTED;
  } else if (!isValidJudgment(row.judgment)) {
    errors.push(`${rowNumber}行目: 判定は「未着手、保留、QA中、OK、参照OK、NG、再実施対象外、対象外」のいずれかである必要があります`);
  }

  if (!isValidDate(row.execution_date)) {
    errors.push(`${rowNumber}行目: 実施日はyyyy/mm/dd形式である必要があります（例: 2025/01/01）`);
  }

  if (row.software_version.length > 255) {
    errors.push(`${rowNumber}行目: ソフトVer.は255文字以内である必要があります`);
  }

  if (row.hardware_version.length > 255) {
    errors.push(`${rowNumber}行目: ハードVer.は255文字以内である必要があります`);
  }

  if (row.comparator_version.length > 255) {
    errors.push(`${rowNumber}行目: コンパラVer.は255文字以内である必要があります`);
  }

  if (row.executor.length > 255) {
    errors.push(`${rowNumber}行目: 実施者は255文字以内である必要があります`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 全CSV行をバリデーション
 */
export function validateAllRows(rows: TestCaseCsvRow[]): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // ヘッダー行を考慮して+2
    const result = validateTestCaseRow(row, rowNumber);
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * CSV行をTIDごとにグループ化
 */
export function groupByTid(rows: TestCaseCsvRow[]): GroupedTestCase[] {
  const grouped = new Map<string, GroupedTestCase>();

  rows.forEach(row => {
    const tid = row.tid;

    if (!grouped.has(tid)) {
      // 新しいTIDの場合、グループを作成
      grouped.set(tid, {
        tid,
        first_layer: row.first_layer,
        second_layer: row.second_layer,
        third_layer: row.third_layer,
        fourth_layer: row.fourth_layer,
        purpose: row.purpose,
        request_id: row.request_id,
        check_items: row.check_items,
        test_procedure: row.test_procedure,
        control_spec_paths: parseFilePaths(row.control_spec),
        data_flow_paths: parseFilePaths(row.data_flow),
        contents: [],
      });
    }

    // テスト内容を追加
    const group = grouped.get(tid)!;
    const testCaseNo = parseInt(row.no, 10);
    const isTarget = row.judgment !== Judgment.EXCLUDED;

    group.contents.push({
      test_case_no: testCaseNo,
      test_case: row.test_case,
      expected_value: row.expected_value,
      is_target: isTarget,
      result: row.result.trim() !== '' ? row.result : null,
      judgment: row.judgment,
      execution_date: parseDate(row.execution_date),
      software_version: row.software_version.trim() !== '' ? row.software_version : null,
      hardware_version: row.hardware_version.trim() !== '' ? row.hardware_version : null,
      comparator_version: row.comparator_version.trim() !== '' ? row.comparator_version : null,
      executor: row.executor.trim() !== '' ? row.executor : null,
      evidence_paths: parseFilePaths(row.evidence),
      note: row.note.trim() !== '' ? row.note : null,
    });
  });

  return Array.from(grouped.values());
}