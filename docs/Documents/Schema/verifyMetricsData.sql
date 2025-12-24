-- ========================================
-- メトリクスデータ検証スクリプト
-- 実際のデータベース内のメトリクスと
-- 提供されたリファレンステーブルを比較
-- ========================================

-- ステップ1: 実際のメトリクスを取得（分析クエリ）
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
    -- 最初のNG→OK/参照OK遷移のみを取得
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
),
actual_metrics AS (
  -- 実際のメトリクス
  SELECT
    COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)::date AS execution_date,
    COALESCE(COUNT(DISTINCT CASE WHEN fe.first_execution_date IS NOT NULL THEN fe.tid || '-' || fe.test_case_no END), 0) AS actual_consumption,
    COALESCE(COUNT(DISTINCT CASE WHEN fne.first_ng_date IS NOT NULL THEN fne.tid || '-' || fne.test_case_no END), 0) AS actual_ng_detection,
    COALESCE(COUNT(DISTINCT CASE WHEN ngok.resolution_date IS NOT NULL THEN ngok.tid || '-' || ngok.test_case_no END), 0) AS actual_resolution
  FROM first_execution fe
  FULL OUTER JOIN first_ng_execution fne ON
    fe.tid = fne.tid AND fe.test_case_no = fne.test_case_no
  FULL OUTER JOIN ng_to_ok_resolution ngok ON
    fe.tid = ngok.tid AND fe.test_case_no = ngok.test_case_no
  WHERE COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)
    BETWEEN '2025-02-02' AND '2025-03-18'
  GROUP BY execution_date
),
-- ステップ2: リファレンステーブル（ユーザー提供データ）
reference_metrics AS (
  SELECT
    dates.execution_date,
    COALESCE(ref.consumption, 0) AS expected_consumption,
    COALESCE(ref.ng_detection, 0) AS expected_ng_detection,
    COALESCE(ref.resolution, 0) AS expected_resolution
  FROM (
    -- 日付範囲を生成
    SELECT DATE '2025-02-02' + (i || ' days')::interval AS execution_date
    FROM generate_series(0, 44) AS t(i)
  ) dates
  LEFT JOIN (
    -- リファレンステーブル: ユーザー提供データ
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
    ) AS ref(execution_date, consumption, ng_detection, resolution)
    ON dates.execution_date = ref.execution_date
)
),
-- ステップ3: 実際とリファレンスを比較
comparison AS (
  SELECT
    ref.execution_date,
    am.actual_consumption,
    ref.expected_consumption,
    CASE
      WHEN am.actual_consumption = ref.expected_consumption THEN '✓'
      ELSE '✗'
    END AS consumption_match,
    am.actual_ng_detection,
    ref.expected_ng_detection,
    CASE
      WHEN am.actual_ng_detection = ref.expected_ng_detection THEN '✓'
      ELSE '✗'
    END AS ng_detection_match,
    am.actual_resolution,
    ref.expected_resolution,
    CASE
      WHEN am.actual_resolution = ref.expected_resolution THEN '✓'
      ELSE '✗'
    END AS resolution_match
  FROM reference_metrics ref
  LEFT JOIN actual_metrics am ON ref.execution_date = am.execution_date
  WHERE ref.expected_consumption > 0 OR ref.expected_ng_detection > 0 OR ref.expected_resolution > 0
     OR am.actual_consumption > 0 OR am.actual_ng_detection > 0 OR am.actual_resolution > 0
)
-- ステップ4: 比較結果を表示
SELECT
  '=== メトリクス検証結果 ===' AS title,
  execution_date,
  actual_consumption,
  expected_consumption,
  consumption_match,
  actual_ng_detection,
  expected_ng_detection,
  ng_detection_match,
  actual_resolution,
  expected_resolution,
  resolution_match
FROM comparison
ORDER BY execution_date;

-- ============================================
-- サマリー: 一致/不一致の集計
-- ============================================
WITH comparison_data AS (
  -- 比較ロジックを再度実行（上記と同じ）
  WITH first_execution AS (
    SELECT
      tid,
      test_case_no,
      MIN(execution_date) AS first_execution_date
    FROM tt_test_results_history
    WHERE test_group_id = 49 AND is_deleted = false
    GROUP BY tid, test_case_no
  ),
  first_ng_execution AS (
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
  ),
  actual_metrics AS (
    SELECT
      COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)::date AS execution_date,
      COALESCE(COUNT(DISTINCT CASE WHEN fe.first_execution_date IS NOT NULL THEN fe.tid || '-' || fe.test_case_no END), 0) AS actual_consumption,
      COALESCE(COUNT(DISTINCT CASE WHEN fne.first_ng_date IS NOT NULL THEN fne.tid || '-' || fne.test_case_no END), 0) AS actual_ng_detection,
      COALESCE(COUNT(DISTINCT CASE WHEN ngok.resolution_date IS NOT NULL THEN ngok.tid || '-' || ngok.test_case_no END), 0) AS actual_resolution
    FROM first_execution fe
    FULL OUTER JOIN first_ng_execution fne ON
      fe.tid = fne.tid AND fe.test_case_no = fne.test_case_no
    FULL OUTER JOIN ng_to_ok_resolution ngok ON
      fe.tid = ngok.tid AND fe.test_case_no = ngok.test_case_no
    WHERE COALESCE(fe.first_execution_date, fne.first_ng_date, ngok.resolution_date)
      BETWEEN '2025-02-02' AND '2025-03-18'
    GROUP BY execution_date
  ),
  reference_metrics AS (
    SELECT
      dates.execution_date,
      COALESCE(ref.consumption, 0) AS expected_consumption,
      COALESCE(ref.ng_detection, 0) AS expected_ng_detection,
      COALESCE(ref.resolution, 0) AS expected_resolution
    FROM (
      SELECT DATE '2025-02-02' + (i || ' days')::interval AS execution_date
      FROM generate_series(0, 44) AS t(i)
    ) dates
    LEFT JOIN (
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
      ) AS ref(execution_date, consumption, ng_detection, resolution)
    ) ON dates.execution_date = ref.execution_date
  ),
  comparison AS (
    SELECT
      ref.execution_date,
      CASE
        WHEN am.actual_consumption = ref.expected_consumption THEN 1
        ELSE 0
      END AS consumption_match,
      CASE
        WHEN am.actual_ng_detection = ref.expected_ng_detection THEN 1
        ELSE 0
      END AS ng_detection_match,
      CASE
        WHEN am.actual_resolution = ref.expected_resolution THEN 1
        ELSE 0
      END AS resolution_match
    FROM reference_metrics ref
    LEFT JOIN actual_metrics am ON ref.execution_date = am.execution_date
    WHERE ref.expected_consumption > 0 OR ref.expected_ng_detection > 0 OR ref.expected_resolution > 0
       OR am.actual_consumption > 0 OR am.actual_ng_detection > 0 OR am.actual_resolution > 0
  )
  SELECT * FROM comparison
)
SELECT
  '検証サマリー' AS title,
  COUNT(*) AS total_days_verified,
  SUM(consumption_match) AS consumption_matched_days,
  SUM(ng_detection_match) AS ng_detection_matched_days,
  SUM(resolution_match) AS resolution_matched_days,
  COUNT(*) FILTER (WHERE consumption_match = 1 AND ng_detection_match = 1 AND resolution_match = 1) AS all_metrics_matched_days,
  ROUND(100.0 * SUM(consumption_match) / COUNT(*), 1) AS consumption_match_pct,
  ROUND(100.0 * SUM(ng_detection_match) / COUNT(*), 1) AS ng_detection_match_pct,
  ROUND(100.0 * SUM(resolution_match) / COUNT(*), 1) AS resolution_match_pct
FROM comparison_data;
