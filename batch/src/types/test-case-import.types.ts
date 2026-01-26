/**
 * CSVの1行を表す型
 */
export interface TestCaseCsvRow {
  tid: string;                    // TID (例: 1-1-1-1)
  no: string;                     // No (test_case_no)
  first_layer: string;            // 第1層
  second_layer: string;           // 第2層
  third_layer: string;            // 第3層
  fourth_layer: string;           // 第4層
  purpose: string;                // 目的
  request_id: string;             // 要求ID
  check_items: string;            // 確認観点
  control_spec: string;           // 制御仕様 (セミコロン区切りのファイルパス)
  data_flow: string;              // データフロー (セミコロン区切りのファイルパス)
  test_procedure: string;         // テスト手順
  test_case: string;              // テストケース
  expected_value: string;         // 期待値
  result: string;                 // 結果
  judgment: string;               // 判定
  execution_date: string;         // 実施日 (yyyy/mm/dd)
  software_version: string;       // ソフトVer.
  hardware_version: string;       // ハードVer.
  comparator_version: string;     // コンパラVer.
  executor: string;               // 実施者
  evidence: string;               // エビデンス (セミコロン区切りのファイルパス)
  note: string;                   // 備考
}

/**
 * TIDでグループ化されたテストケースデータ
 */
export interface GroupedTestCase {
  tid: string;
  first_layer: string;
  second_layer: string;
  third_layer: string;
  fourth_layer: string;
  purpose: string;
  request_id: string;
  check_items: string;
  test_procedure: string;
  control_spec_paths: string[];   // 制御仕様ファイルパス配列
  data_flow_paths: string[];      // データフローファイルパス配列
  contents: TestContent[];        // テスト内容配列
}

/**
 * テスト内容（1つのNo）
 */
export interface TestContent {
  test_case_no: number;           // No
  test_case: string;              // テストケース
  expected_value: string;         // 期待値
  is_target: boolean;             // 対象外かどうか（判定から判定）
  result: string | null;          // 結果
  judgment: string;               // 判定
  execution_date: Date | null;    // 実施日
  software_version: string | null;
  hardware_version: string | null;
  comparator_version: string | null;
  executor: string | null;
  evidence_paths: string[];       // エビデンスファイルパス配列
  note: string | null;            // 備考
}

/**
 * ZIPファイル内のファイル情報
 */
export interface ZipFileEntry {
  path: string;                   // ZIP内の相対パス
  buffer: Buffer;                 // ファイル内容
  originalName: string;           // オリジナルファイル名
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 1テストケースのインポート結果
 */
export interface TestCaseImportResult {
  row: number;                    // CSV開始行番号
  tid: string;
  success: boolean;
  operation: 'created' | 'error';
  errorMessage?: string;
  contentCount?: number;          // 登録したテスト内容数
}

/**
 * 全体のインポート結果
 */
export interface ImportSummary {
  totalTestCases: number;         // 総テストケース数（TIDの数）
  totalContents: number;          // 総テスト内容数（Noの数）
  successCount: number;           // 成功したテストケース数
  errorCount: number;
  createdTestCases: number;
  createdContents: number;
  uploadedFiles: number;          // アップロードしたファイル数
  results: TestCaseImportResult[];
  startedAt: string;
  completedAt: string;
}

/**
 * 判定の型
 */
export enum Judgment {
  NOT_STARTED = '未着手',
  PENDING = '保留',
  QA = 'QA中',
  OK = 'OK',
  REFERENCE_OK = '参照OK',
  NG = 'NG',
  RE_TEST_EXCLUDED = '再実施対象外',
  EXCLUDED = '対象外'
}

/**
 * ファイルタイプ
 */
export enum FileType {
  CONTROL_SPEC = 0,    // 制御仕様
  DATA_FLOW = 1        // データフロー
}
