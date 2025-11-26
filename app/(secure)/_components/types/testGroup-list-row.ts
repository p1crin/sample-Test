// 項目のエンティティ型
export type TestGroupListRow = {
  id: number;
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  testDatespan: string;
  ngPlanCount: string;
  created_at: string;
  updated_at: string;
};

// 項目作成時の入力型
export type CreateTestGroupListRow = Omit<TestGroupListRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestGroupListRow = Partial<CreateTestGroupListRow>;
