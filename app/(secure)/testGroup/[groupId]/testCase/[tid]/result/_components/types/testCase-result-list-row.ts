import { JudgmentOption } from "@/constants/constants";

// 項目のエンティティ型
export type TestCaseResultRow = {
  checked?: boolean;
  test_case_no: number;
  test_case: string;
  expected_value: string;
  result: string;
  judgment: JudgmentOption;
  softwareVersion: string;
  hardwareVersion: string;
  comparatorVersion: string;
  executionDate: string;
  executor: string;
  evidence: string[] | null;
  note: string;
  is_target: boolean;
  historyCount?: number; // 追跡用（オプション）
};

export type ResultWithHistory = {
  latestValidResult: Record<string, unknown>;
  allHistory: Record<string, unknown>[];
  historyCounts: number[];
}

export type TestResultsData = {
  [testCaseNo: string]: ResultWithHistory;
}

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseResultRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;