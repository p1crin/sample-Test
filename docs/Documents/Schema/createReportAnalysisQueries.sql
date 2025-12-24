-- ========================================
-- 日次レポート分析用クエリ
-- テスト消化件数（実績）、不具合摘出件数（実績）、解決不具合数を日毎に集計
-- ========================================

-- テスト消化件数（実績）、不具合摘出件数（実績）、解決不具合数の日毎集計
WITH first_execution AS (
  -- 各テスト内容の初回実行日を取得
  SELECT
    tid,
    test_case_no,
    MIN(execution_date) AS first_execution_date
  FROM tt_test_results_history
  WHERE test_group_id = 49 AND is_deleted = false
  GROUP BY tid, test_case_no
),
first_ng_execution AS (
  -- 各テスト内容が初めてNG判定を受けた日を取得
  SELECT
    tid,
    test_case_no,
    MIN(execution_date) AS first_ng_date
  FROM tt_test_results_history
  WHERE test_group_id = 49
    AND judgment = 'NG'
    AND is_deleted = false
  GROUP BY tid, test_case_no
),
ng_to_ok_resolution AS (
  -- NGからOK/参照OKへの解決を検出（最初の解決のみ）
  SELECT DISTINCT
    h1.tid,
    h1.test_case_no,
    h2.execution_date AS resolution_date
  FROM tt_test_results_history h1
  JOIN tt_test_results_history h2 ON
    h1.test_group_id = h2.test_group_id
    AND h1.tid = h2.tid
    AND h1.test_case_no = h2.test_case_no
    AND h1.history_count < h2.history_count
  WHERE h1.test_group_id = 49
    AND h1.judgment = 'NG'
    AND h2.judgment IN ('OK', '参照OK')
    AND h2.is_deleted = false
    -- 最初のNG→OK/参照OK遷移のみを取得（それ以降の同じテストケースの遷移は除外）
    AND h2.history_count = (
      SELECT MIN(h3.history_count)
      FROM tt_test_results_history h3
      WHERE h3.test_group_id = h1.test_group_id
        AND h3.tid = h1.tid
        AND h3.test_case_no = h1.test_case_no
        AND h3.history_count > h1.history_count
        AND h3.judgment IN ('OK', '参照OK')
        AND h3.is_deleted = false
    )
)
-- 日毎の集計
SELECT
  COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)::date AS execution_date,
  COALESCE(COUNT(DISTINCT CASE WHEN fe.first_execution_date IS NOT NULL THEN fe.tid || '-' || fe.test_case_no END), 0) AS テスト消化件数_実績,
  COALESCE(COUNT(DISTINCT CASE WHEN fne.first_ng_date IS NOT NULL THEN fne.tid || '-' || fne.test_case_no END), 0) AS 不具合摘出件数_実績,
  COALESCE(COUNT(DISTINCT CASE WHEN ngok.resolution_date IS NOT NULL THEN ngok.tid || '-' || ngok.test_case_no END), 0) AS 解決不具合数
FROM first_execution fe
FULL OUTER JOIN first_ng_execution fne ON
  fe.tid = fne.tid AND fe.test_case_no = fne.test_case_no
FULL OUTER JOIN ng_to_ok_resolution ngok ON
  fe.tid = ngok.tid AND fe.test_case_no = ngok.test_case_no
WHERE COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)
  BETWEEN '2025-02-01' AND '2025-03-18'
GROUP BY execution_date
ORDER BY execution_date;
