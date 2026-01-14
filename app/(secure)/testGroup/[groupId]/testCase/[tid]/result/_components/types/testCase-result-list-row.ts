import { JudgmentOption } from "@/constants/constants";

// エビデンスファイルの型
export type EvidenceFile = {
  id: string;              // クライアント側の一時ID、またはサーバー側のevidenceId
  name: string;            // ファイル名
  type?: string;           // MIMEタイプ
  file?: File;             // アップロード前の実ファイル
  evidenceId?: number;     // アップロード済みの場合、サーバー側のID
  evidencePath?: string;   // アップロード済みの場合、ファイルパス
  testCaseNo?: number;     // テストケース番号
  historyCount?: number;   // 履歴カウント
  evidenceNo?: number;     // エビデンス番号
};

// 項目のエンティティ型
export type TestCaseResultRow = {
  testCaseNo: number;
  testCase: string;
  expectedValue: string;
  result: string;
  judgment: JudgmentOption;
  softwareVersion: string;
  hardwareVersion: string;
  comparatorVersion: string;
  executionDate: string;
  executor: string;
  evidence: EvidenceFile[] | null;
  note: string;
  historyCount?: number; // 追跡用（オプション）
  isTarget?: boolean; // 対象フラグ（trueの場合は対象、falseの場合は対象外）
};

// 項目作成時の入力型
export type CreateTestCaseListRow = Omit<TestCaseResultRow, 'id' | 'createdAt' | 'updatedAt'>;

// 項目更新時の入力型
export type UpdateTestCaseListRow = Partial<CreateTestCaseListRow>;