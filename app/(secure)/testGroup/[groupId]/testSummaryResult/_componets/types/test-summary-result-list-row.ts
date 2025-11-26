export type TestSummaryResultListRow = {
  firstLayer: string; // 第1層
  secondLayer: string; // 第2層
  totalCount: number; // 総項目数
  targetCount: number; // 対象項目数
  completedCount: number; // 実施済数
  notStartedCount: number; // 未着手
  inProgressCount: number; // 実施中
  okCount: number; // OK
  ngCount: number; // NG
  excludedCount: number; // 対象外
  okRate: number; // OK率
  progressRate: number; // 進捗率
}