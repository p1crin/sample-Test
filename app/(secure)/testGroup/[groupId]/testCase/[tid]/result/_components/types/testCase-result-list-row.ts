import { JudgmentOption } from "@/constants/constants";

// 項目のエンティティ型
export type TestCaseResultRow = {
  testCase: string;
  expectedValue: string;
  result: string;
  judgment: JudgmentOption;
  softwareVersion: string;
  hardwareVersion: string;
  comparatorVersion: string;
  executionDate: string;
  executor: string;
  evidence: { name: string; id: string }[];
  note: string;
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseResultRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;
