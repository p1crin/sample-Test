export type ImportResultListRow = {
    id: number;
    fileName: string;
    importDate: string;
    importStatus: '実施中' | '完了' | 'エラー';
    execterName: string;
}