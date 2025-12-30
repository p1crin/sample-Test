export type ImportResultListRow = {
    id: number;
    file_name: string;
    created_at: string;
    import_type: 'テストケースインポート' | 'ユーザインポート';
    import_status: '実施中' | '完了' | 'エラー';
    executor_name: string;
}