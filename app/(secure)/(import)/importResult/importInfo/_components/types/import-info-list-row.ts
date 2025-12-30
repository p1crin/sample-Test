export type ImportInfoListRow = {
  id: string;
  file_name: string;
  count: string;
  import_status: '実施中' | '完了' | 'エラー';
  executor_name: string;
  created_at: string;
  message: string;
}