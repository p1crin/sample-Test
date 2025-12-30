// ユーザー関連の型
export enum UserRole {
  ADMIN = 0,
  TEST_MANAGER = 1,
  GENERAL = 2,
}

export interface User {
  id: number;
  email: string;
  name: string;
  user_role: UserRole;
  department: string;
  company: string;
  password: string; // bcrypt hashed
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface Tag {
  id: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface UserTag {
  user_id: number;
  tag_id: number;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

// テストグループ関連の型
export enum TestRole {
  DESIGNER = 0,
  EXECUTOR = 1,
  VIEWER = 2,
}

export interface TestGroup {
  id: number;
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  test_startdate: Date;
  test_enddate: Date;
  ng_plan_count: number;
  created_by: number;
  updated_by: number;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface TestGroupTag {
  test_group_id: number;
  tag_id: number;
  test_role: TestRole;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

// テストケース関連の型
export interface TestCase {
  test_group_id: number;
  tid: string;
  first_layer: string;
  second_layer: string;
  third_layer: string;
  fourth_layer: string;
  purpose: string;
  request_id: string;
  check_items: string;
  test_procedure: string;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export enum FileType {
  CONTROL_SPEC = 0,
  DATA_FLOW = 1,
}

export interface TestCaseFile {
  test_group_id: number;
  tid: string;
  file_type: FileType;
  file_no: number;
  file_name: string;
  file_path: string; // S3 path
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface TestContent {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  test_case: string;
  expected_value: string;
  is_target: boolean;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

// テスト結果関連の型
export enum Judgment {
  OK = 'OK',
  NG = 'NG',
  RE_TEST_EXCLUDED = '再実施対象外',
}

export interface TestResult {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  result: string;
  judgment: Judgment | string;
  software_version: string;
  hardware_version: string;
  comparator_version: string;
  execution_date: Date;
  executor: string;
  note: string;
  version: number;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface TestResultHistory {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  history_count: number;
  result: string;
  judgment: Judgment | string;
  software_version: string;
  hardware_version: string;
  comparator_version: string;
  execution_date: Date;
  executor: string;
  note: string;
  version: number;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface TestEvidence {
  test_group_id: number;
  tid: string;
  test_case_no: number;
  history_count: number;
  evidence_no: number;
  evidence_name: string;
  evidence_path: string; // S3 path
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

// インポート関連の型
export enum ImportStatus {
  ERROR = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
}

export enum ImportType {
  USER = 0,
  TEST_CASE = 1,
}

export interface ImportResult {
  id: number;
  file_name: string;
  import_status: ImportStatus;
  executor_name: string;
  import_type: ImportType;
  count: number;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}

export interface ImportResultError {
  id: number;
  import_result_id: number;
  error_details: string;
  error_row: number;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
}