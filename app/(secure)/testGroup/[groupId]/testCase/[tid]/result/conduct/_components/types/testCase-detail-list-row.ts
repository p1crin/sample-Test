// 項目のエンティティ型
export type TestCaseDetailRow = {
  tid: string;
  firstLayer: string;
  secondLayer: string;
  thirdLayer: string;
  fourthLayer: string;
  purpose: string;
  checkItems: string;
  requestId: string;
  controlSpec: string;
  dataFlow: string;
  testProcedure: string;
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseDetailRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;
