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
  createdAt: string;
  updatedAt: string;
  chartData: {
    okCount: number;
    ngCount: number;
    notStartCount: number;
    excludedCount: number;
  };
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseListRow, 'tid' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;