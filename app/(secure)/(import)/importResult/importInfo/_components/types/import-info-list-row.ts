export type ImportInfoListRow = {
  id: string;
  fileName: string;
  count: string;
  importDate: string;
  importStatus: '実施中' | '完了' | 'エラー';
  execterName: string;
  errorDetails: string;
}