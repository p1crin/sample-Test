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
  isCanModify: boolean;
};

// テストグループ情報モーダル表示用エンティティ型
export type TestGroupModalRow = Omit<TestGroupListRow, 'isCanModify'>