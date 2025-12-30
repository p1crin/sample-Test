// 項目のエンティティ型
export type TestCaseListRow = {
  tid: string;
  first_layer: string;
  second_layer: string;
  third_layer: string;
  fourth_layer: string;
  purpose: string;
  request_id: string;
  checkItems: string;
  created_at: string;
  updated_at: string;
  chartData: {
    ok_items: number;
    ng_items: number;
    not_started_items: number;
    excluded_items: number;
  };
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseListRow, 'tid' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;