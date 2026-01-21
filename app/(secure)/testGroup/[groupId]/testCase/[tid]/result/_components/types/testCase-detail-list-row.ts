// 項目のエンティティ型
export type TestCaseDetailRow = {
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
  created_at: string;
  updated_at: string;
  control_spec: { file_name: string; file_path: string }[];
  data_flow: { file_name: string; file_path: string }[];
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseDetailRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;
