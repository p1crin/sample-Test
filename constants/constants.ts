export const READMINE_URL = "https://redminestanley.com/issues/";

// 判定ステータス
export const JUDGMENT_OPTIONS = {
  EMPTY: "",
  UNTOUCHED: "未着手",
  RESERVED: "保留",
  QA_IN_PROGRESS: "QA中",
  OK: "OK",
  REFERENCE_OK: "参照OK",
  NG: "NG",
  RE_EXECUTION_EXCLUDED: "再実施対象外",
  EXCLUDED: "対象外"
} as const;

export type JudgmentOption = typeof JUDGMENT_OPTIONS[keyof typeof JUDGMENT_OPTIONS];

// ユーザ権限
export const ROLE_OPTIONS = {
  SYSTEM_ADMIN: "システム管理者",
  TEST_MANAGER: "テスト管理者",
  GENERAL: "一般"
} as const;

export type RoleOption = typeof ROLE_OPTIONS[keyof typeof ROLE_OPTIONS];

// ステータス
export const STATUS_OPTIONS = {
  ENABLE: "有効",
  DISABLE: "無効"
}

export type StatusOption = typeof STATUS_OPTIONS[keyof typeof STATUS_OPTIONS];

// インポート状況
export const IMPORT_STATUS = {
  EXECUTING: "実施中",
  COMPLETE: "完了",
  ERROR: 'エラー'
}

export type ImportStatus = typeof IMPORT_STATUS[keyof typeof IMPORT_STATUS];

// インポート種別
export const IMPORT_TYPE = {
  TEST_CASE: "テストケース",
  USER: "ユーザ",
}

export type ImportType = typeof IMPORT_TYPE[keyof typeof IMPORT_TYPE];