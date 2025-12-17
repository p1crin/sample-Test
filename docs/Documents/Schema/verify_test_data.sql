SELECT 
    execution_date, 
    COUNT(*) as daily_ok_count
FROM tt_test_results_history
WHERE test_group_id = ${groupId} 
  AND (judgment = 'OK' OR judgment = '参照OK')
  AND is_deleted = false
GROUP BY execution_date
ORDER BY execution_date;

SELECT 
    first_ng_date, 
    COUNT(*) as daily_new_defects
FROM (
    -- 各テストケースが「最初にNG」を出した日を特定する
    SELECT 
        tid, 
        test_case_no, 
        MIN(execution_date) as first_ng_date
    FROM tt_test_results_history
    WHERE test_group_id = ${groupId} 
      AND judgment = 'NG'
      AND is_deleted = false
    GROUP BY tid, test_case_no
) AS first_ng_table
GROUP BY first_ng_date
ORDER BY first_ng_date;

SELECT 
    h_now.execution_date as resolved_date,
    COUNT(*) as daily_resolved_count
FROM tt_test_results_history h_now
JOIN tt_test_results_history h_prev ON 
    h_now.tid = h_prev.tid AND 
    h_now.test_case_no = h_prev.test_case_no
WHERE h_now.test_group_id = ${groupId}
  -- 今回の結果がOK
  AND (h_now.judgment = 'OK' OR h_now.judgment = '参照OK')
  -- 前回の結果がNG（history_countで前後を判定）
  AND h_prev.judgment = 'NG'
  AND h_now.history_count = h_prev.history_count + 1
  AND h_now.is_deleted = false
GROUP BY h_now.execution_date
ORDER BY h_now.execution_date;