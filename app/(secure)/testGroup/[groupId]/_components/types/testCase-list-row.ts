import { FileInfo } from "@/utils/fileUtils";

// 項目のエンティティ型
export type TestCaseListRow = {
  tid: string;
  firstLayer: string;
  secondLayer: string;
  thirdLayer: string;
  fourthLayer: string;
  purpose: string;
  requestId: string;
  checkItems: string;
  testProcedure: string;
  createdAt: string;
  updatedAt: string;
  chartData: {
    ok_items: number;
    ng_items: number;
    not_started_items: number;
    excluded_items: number;
  };
  isCanModify: boolean;
  controlSpecFile: [] | FileInfo[];
  dataFlowFile: [] | FileInfo[];
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseListRow, 'createdAt' | 'updatedAt' | 'chartData' | 'isCanModify'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = CreateTestCaseListRow;