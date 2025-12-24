-- ========================================
-- メトリクス検証スクリプト
-- 提供されたリファレンステーブルと
-- 実際のデータベース内のメトリクスを比較
-- ========================================

-- グループ49のデータを使用して検証
WITH first_execution AS (
  SELECT tid, test_case_no, MIN(execution_date) AS first_execution_date
  FROM tt_test_results_history
  WHERE test_group_id = 49 AND is_deleted = false AND history_count = 1
  GROUP BY tid, test_case_no
),
first_ng_execution AS (
  SELECT tid, test_case_no, MIN(execution_date) AS first_ng_date
  FROM tt_test_results_history
  WHERE test_group_id = 49 AND judgment = 'NG' AND is_deleted = false AND history_count = 1
  GROUP BY tid, test_case_no
),
ng_to_ok_resolution AS (
  SELECT DISTINCT h1.tid, h1.test_case_no, h2.execution_date AS resolution_date
  FROM tt_test_results_history h1
  JOIN tt_test_results_history h2 ON
    h1.test_group_id = h2.test_group_id AND h1.tid = h2.tid AND h1.test_case_no = h2.test_case_no AND h1.history_count < h2.history_count
  WHERE h1.test_group_id = 49 AND h1.judgment = 'NG' AND h2.judgment IN ('OK', '参照OK') AND h2.is_deleted = false
    AND h2.history_count = (
      SELECT MIN(h3.history_count)
      FROM tt_test_results_history h3
      WHERE h3.test_group_id = h1.test_group_id AND h3.tid = h1.tid AND h3.test_case_no = h1.test_case_no
        AND h3.history_count > h1.history_count AND h3.judgment IN ('OK', '参照OK') AND h3.is_deleted = false
    )
),
actual_metrics AS (
  SELECT
    COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)::date AS execution_date,
    COUNT(DISTINCT CASE WHEN fe.first_execution_date IS NOT NULL THEN fe.tid || '-' || fe.test_case_no END)::integer AS actual_consumption,
    COUNT(DISTINCT CASE WHEN fne.first_ng_date IS NOT NULL THEN fne.tid || '-' || fne.test_case_no END)::integer AS actual_ng,
    COUNT(DISTINCT CASE WHEN ngok.resolution_date IS NOT NULL THEN ngok.tid || '-' || ngok.test_case_no END)::integer AS actual_resolution
  FROM first_execution fe
  FULL OUTER JOIN first_ng_execution fne ON fe.tid = fne.tid AND fe.test_case_no = fne.test_case_no
  FULL OUTER JOIN ng_to_ok_resolution ngok ON fe.tid = ngok.tid AND fe.test_case_no = ngok.test_case_no
  WHERE COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date) BETWEEN '2025-02-02' AND '2025-03-18'
  GROUP BY execution_date
),
expected_metrics AS (
  SELECT * FROM (VALUES
    ('2025-02-02'::date, 5, 1, 2),
    ('2025-02-03'::date, 7, 2, 1),
    ('2025-02-04'::date, 7, 1, 1),
    ('2025-02-05'::date, 5, 1, 2),
    ('2025-02-06'::date, 7, 2, 1),
    ('2025-02-07'::date, 9, 2, 2),
    ('2025-02-10'::date, 8, 1, 1),
    ('2025-02-11'::date, 10, 2, 2),
    ('2025-02-12'::date, 8, 1, 1),
    ('2025-02-13'::date, 6, 1, 2),
    ('2025-02-14'::date, 9, 2, 1),
    ('2025-02-17'::date, 8, 1, 2),
    ('2025-02-18'::date, 6, 2, 1),
    ('2025-02-19'::date, 7, 1, 2),
    ('2025-02-20'::date, 8, 2, 1),
    ('2025-02-21'::date, 5, 1, 2),
    ('2025-02-24'::date, 9, 2, 1),
    ('2025-02-25'::date, 7, 1, 2),
    ('2025-02-26'::date, 6, 2, 1),
    ('2025-02-27'::date, 8, 1, 2),
    ('2025-02-28'::date, 5, 1, 1),
    ('2025-03-03'::date, 7, 2, 2),
    ('2025-03-04'::date, 8, 1, 1),
    ('2025-03-05'::date, 6, 1, 2),
    ('2025-03-06'::date, 9, 2, 1),
    ('2025-03-07'::date, 7, 1, 2),
    ('2025-03-10'::date, 8, 2, 1),
    ('2025-03-11'::date, 6, 1, 2),
    ('2025-03-12'::date, 7, 1, 1),
    ('2025-03-13'::date, 5, 2, 2),
    ('2025-03-14'::date, 8, 1, 1),
    ('2025-03-17'::date, 3, 0, 1),
    ('2025-03-18'::date, 2, 0, 0)
  ) AS ref(execution_date, expected_consumption, expected_ng, expected_resolution)
)
SELECT
  COALESCE(e.execution_date, a.execution_date) AS date,
  COALESCE(a.actual_consumption, 0) AS actual_cons,
  e.expected_consumption AS expect_cons,
  CASE WHEN COALESCE(a.actual_consumption, 0) = e.expected_consumption THEN '✓' ELSE '✗' END AS consumption_match,
  COALESCE(a.actual_ng, 0) AS actual_ng,
  e.expected_ng AS expect_ng,
  CASE WHEN COALESCE(a.actual_ng, 0) = e.expected_ng THEN '✓' ELSE '✗' END AS ng_match,
  COALESCE(a.actual_resolution, 0) AS actual_res,
  e.expected_resolution AS expect_res,
  CASE WHEN COALESCE(a.actual_resolution, 0) = e.expected_resolution THEN '✓' ELSE '✗' END AS resolution_match
FROM actual_metrics a
FULL OUTER JOIN expected_metrics e ON a.execution_date = e.execution_date
WHERE COALESCE(e.expected_consumption, e.expected_ng, e.expected_resolution, 0) > 0
   OR COALESCE(a.actual_consumption, a.actual_ng, a.actual_resolution, 0) > 0
ORDER BY COALESCE(e.execution_date, a.execution_date);

-- ========================================
-- 検証サマリー
-- ========================================

WITH first_execution AS (
  SELECT tid, test_case_no, MIN(execution_date) AS first_execution_date
  FROM tt_test_results_history
  WHERE test_group_id = 49 AND is_deleted = false AND history_count = 1
  GROUP BY tid, test_case_no
),
first_ng_execution AS (
  SELECT tid, test_case_no, MIN(execution_date) AS first_ng_date
  FROM tt_test_results_history
  WHERE test_group_id = 49 AND judgment = 'NG' AND is_deleted = false AND history_count = 1
  GROUP BY tid, test_case_no
),
ng_to_ok_resolution AS (
  SELECT DISTINCT h1.tid, h1.test_case_no, h2.execution_date AS resolution_date
  FROM tt_test_results_history h1
  JOIN tt_test_results_history h2 ON
    h1.test_group_id = h2.test_group_id AND h1.tid = h2.tid AND h1.test_case_no = h2.test_case_no AND h1.history_count < h2.history_count
  WHERE h1.test_group_id = 49 AND h1.judgment = 'NG' AND h2.judgment IN ('OK', '参照OK') AND h2.is_deleted = false
    AND h2.history_count = (
      SELECT MIN(h3.history_count)
      FROM tt_test_results_history h3
      WHERE h3.test_group_id = h1.test_group_id AND h3.tid = h1.tid AND h3.test_case_no = h1.test_case_no
        AND h3.history_count > h1.history_count AND h3.judgment IN ('OK', '参照OK') AND h3.is_deleted = false
    )
),
actual_metrics AS (
  SELECT
    COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)::date AS execution_date,
    COUNT(DISTINCT CASE WHEN fe.first_execution_date IS NOT NULL THEN fe.tid || '-' || fe.test_case_no END)::integer AS actual_consumption,
    COUNT(DISTINCT CASE WHEN fne.first_ng_date IS NOT NULL THEN fne.tid || '-' || fne.test_case_no END)::integer AS actual_ng,
    COUNT(DISTINCT CASE WHEN ngok.resolution_date IS NOT NULL THEN ngok.tid || '-' || ngok.test_case_no END)::integer AS actual_resolution
  FROM first_execution fe
  FULL OUTER JOIN first_ng_execution fne ON fe.tid = fne.tid AND fe.test_case_no = fne.test_case_no
  FULL OUTER JOIN ng_to_ok_resolution ngok ON fe.tid = ngok.tid AND fe.test_case_no = ngok.test_case_no
  WHERE COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date) BETWEEN '2025-02-02' AND '2025-03-18'
  GROUP BY execution_date
),
expected_metrics AS (
  SELECT * FROM (VALUES
    ('2025-02-02'::date, 5, 1, 2),
    ('2025-02-03'::date, 7, 2, 1),
    ('2025-02-04'::date, 7, 1, 1),
    ('2025-02-05'::date, 5, 1, 2),
    ('2025-02-06'::date, 7, 2, 1),
    ('2025-02-07'::date, 9, 2, 2),
    ('2025-02-10'::date, 8, 1, 1),
    ('2025-02-11'::date, 10, 2, 2),
    ('2025-02-12'::date, 8, 1, 1),
    ('2025-02-13'::date, 6, 1, 2),
    ('2025-02-14'::date, 9, 2, 1),
    ('2025-02-17'::date, 8, 1, 2),
    ('2025-02-18'::date, 6, 2, 1),
    ('2025-02-19'::date, 7, 1, 2),
    ('2025-02-20'::date, 8, 2, 1),
    ('2025-02-21'::date, 5, 1, 2),
    ('2025-02-24'::date, 9, 2, 1),
    ('2025-02-25'::date, 7, 1, 2),
    ('2025-02-26'::date, 6, 2, 1),
    ('2025-02-27'::date, 8, 1, 2),
    ('2025-02-28'::date, 5, 1, 1),
    ('2025-03-03'::date, 7, 2, 2),
    ('2025-03-04'::date, 8, 1, 1),
    ('2025-03-05'::date, 6, 1, 2),
    ('2025-03-06'::date, 9, 2, 1),
    ('2025-03-07'::date, 7, 1, 2),
    ('2025-03-10'::date, 8, 2, 1),
    ('2025-03-11'::date, 6, 1, 2),
    ('2025-03-12'::date, 7, 1, 1),
    ('2025-03-13'::date, 5, 2, 2),
    ('2025-03-14'::date, 8, 1, 1),
    ('2025-03-17'::date, 3, 0, 1),
    ('2025-03-18'::date, 2, 0, 0)
  ) AS ref(execution_date, expected_consumption, expected_ng, expected_resolution)
),
comparison AS (
  SELECT
    COALESCE(e.execution_date, a.execution_date) AS execution_date,
    CASE WHEN COALESCE(a.actual_consumption, 0) = e.expected_consumption THEN 1 ELSE 0 END AS consumption_match,
    CASE WHEN COALESCE(a.actual_ng, 0) = e.expected_ng THEN 1 ELSE 0 END AS ng_match,
    CASE WHEN COALESCE(a.actual_resolution, 0) = e.expected_resolution THEN 1 ELSE 0 END AS resolution_match
  FROM actual_metrics a
  FULL OUTER JOIN expected_metrics e ON a.execution_date = e.execution_date
  WHERE COALESCE(e.expected_consumption, e.expected_ng, e.expected_resolution, 0) > 0
     OR COALESCE(a.actual_consumption, a.actual_ng, a.actual_resolution, 0) > 0
)
SELECT
  'メトリクス検証結果サマリー' AS summary_title,
  COUNT(*)::integer AS total_days_checked,
  SUM(consumption_match)::integer AS consumption_matched_days,
  SUM(ng_match)::integer AS ng_matched_days,
  SUM(resolution_match)::integer AS resolution_matched_days,
  COUNT(*) FILTER (WHERE consumption_match = 1 AND ng_match = 1 AND resolution_match = 1)::integer AS fully_matched_days,
  ROUND(100.0 * SUM(consumption_match) / COUNT(*), 1)::numeric AS consumption_match_pct,
  ROUND(100.0 * SUM(ng_match) / COUNT(*), 1)::numeric AS ng_match_pct,
  ROUND(100.0 * SUM(resolution_match) / COUNT(*), 1)::numeric AS resolution_match_pct,
  CASE
    WHEN COUNT(*) FILTER (WHERE consumption_match = 1 AND ng_match = 1 AND resolution_match = 1) = COUNT(*) THEN '✓ PERFECT MATCH'
    ELSE '✗ MISMATCH DETECTED'
  END AS verification_status
FROM comparison;
