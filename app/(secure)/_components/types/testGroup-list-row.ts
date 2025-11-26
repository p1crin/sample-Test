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

// フォーム入力用の型（新規登録・編集共通）
export type TestGroupFormData = {
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  test_startdate: string;
  test_enddate: string;
  ngPlanCount: string;
  designerTag: string[];
  executerTag: string[];
  viewerTag: string[];
  created_at?: string;
  updated_at?: string;
};

// 項目作成時の入力型
export type CreateTestGroupListRow = Omit<TestGroupFormData, 'created_at' | 'updated_at'>;

// 項目更新時の入力型
export type UpdateTestGroupListRow = Partial<CreateTestGroupListRow>;
