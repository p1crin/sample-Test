-- エビデンステーブルをテスト結果履歴から分離する
-- history_count をPKから除外し、nullable な参照フィールドに変更する

-- 1. 既存のPK制約を削除
ALTER TABLE "tt_test_evidences" DROP CONSTRAINT "tt_test_evidences_pkey";

-- 2. history_count を nullable に変更
ALTER TABLE "tt_test_evidences" ALTER COLUMN "history_count" DROP NOT NULL;

-- 3. 新しいPKを (test_group_id, tid, test_case_no, evidence_no) に再定義
ALTER TABLE "tt_test_evidences" ADD CONSTRAINT "tt_test_evidences_pkey" PRIMARY KEY ("test_group_id", "tid", "test_case_no", "evidence_no");
