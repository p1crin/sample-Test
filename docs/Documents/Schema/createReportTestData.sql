-- ========================================
-- 日次レポート集計テスト用データ生成スクリプト（修正版）
-- テストグループ1件 + テスト内容300件
-- テスト期間2025/2/1〜3/18（46日間）
-- 実際の日次進捗に基づくデータ
-- ========================================

-- トランザクション開始
BEGIN;

-- ========================================
-- 1. テストグループ作成
-- ========================================
INSERT INTO tt_test_groups (
    oem,
    model,
    event,
    variation,
    destination,
    specs,
    test_startdate,
    test_enddate,
    ng_plan_count,
    created_at,
    updated_at,
    is_deleted
)
VALUES (
    'Toyota',
    'GR Supra 3.0L Turbo - Report Test',
    'Advanced ECU Validation - Daily Report Testing',
    'Production Line B - Report Test Variant',
    'Japan Market - Report Test',
    'ECU Software v3.1.0 Specification - Daily Tracking',
    '2025-02-01',
    '2025-03-18',
    30,
    NOW(),
    NOW(),
    false
);

-- ========================================
-- 2. テストケース 30件作成
-- ========================================
INSERT INTO tt_test_cases (
    test_group_id,
    tid,
    first_layer,
    second_layer,
    third_layer,
    fourth_layer,
    purpose,
    request_id,
    check_items,
    test_procedure,
    created_at,
    updated_at,
    is_deleted
)
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD((i / 6 + 1)::text, 2, '0') || '-' || LPAD((i % 6 + 1)::text, 2, '0'),
    CASE
        WHEN i <= 6 THEN 'Engine Management'
        WHEN i <= 12 THEN 'Transmission'
        WHEN i <= 18 THEN 'Braking System'
        WHEN i <= 24 THEN 'Suspension'
        ELSE 'Climate Control'
    END,
    CASE
        WHEN i % 6 = 1 THEN 'Fuel Control'
        WHEN i % 6 = 2 THEN 'Ignition Timing'
        WHEN i % 6 = 3 THEN 'Shift Programming'
        WHEN i % 6 = 4 THEN 'ABS Control'
        WHEN i % 6 = 5 THEN 'Damper Settings'
        ELSE 'Valve Control'
    END,
    'Layer3-' || LPAD((i % 6)::text, 2, '0'),
    'Layer4-' || LPAD((i % 3)::text, 1, '0'),
    'Daily validation test case ' || i || ' - Progressive verification across 46 days',
    'REQ-' || LPAD(i::text, 5, '0'),
    'Check point 1, Check point 2, Check point 3',
    'Initialize → Configure → Execute → Verify → Report',
    NOW(),
    NOW(),
    false
FROM generate_series(1, 30) AS i;

-- ========================================
-- 3. テスト内容作成（各ケースに10件 = 合計300件）
-- ========================================
INSERT INTO tt_test_contents (
    test_group_id,
    tid,
    test_case_no,
    test_case,
    expected_value,
    is_target,
    created_at,
    updated_at,
    is_deleted
)
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD((tc_i / 6 + 1)::text, 2, '0') || '-' || LPAD((tc_i % 6 + 1)::text, 2, '0'),
    tc_no,
    'Test case ' || tc_i || ' - Content ' || tc_no || ': Parameter verification under operational conditions',
    'Expected: Within specification range (target: ' || (50 + tc_no)::text || ' units)',
    CASE WHEN tc_no <= 8 THEN true ELSE false END,
    NOW(),
    NOW(),
    false
FROM generate_series(1, 30) AS tc_i
CROSS JOIN generate_series(1, 10) AS tc_no;

-- ========================================
-- 4. テスト実施スケジュール（日次の実施数）
-- ========================================
-- 日次の実施数を定義（2月1日～3月18日の実際の進捗に基づく）
CREATE TEMP TABLE daily_executions (
    execution_date DATE,
    daily_count INTEGER,
    cumulative_count INTEGER,
    daily_ng_count INTEGER,
    daily_resolved_count INTEGER
);

-- 2月の実施スケジュール
INSERT INTO daily_executions VALUES
('2025-02-01'::date, 0, 0, 0, 0),      -- 開始日
('2025-02-02'::date, 5, 5, 1, 0),
('2025-02-03'::date, 7, 12, 2, 0),
('2025-02-04'::date, 7, 19, 1, 1),
('2025-02-05'::date, 0, 19, 0, 0),
('2025-02-06'::date, 0, 19, 0, 0),
('2025-02-07'::date, 3, 22, 0, 0),
('2025-02-08'::date, 6, 28, 0, 0),
('2025-02-09'::date, 4, 32, 2, 0),
('2025-02-10'::date, 10, 42, 0, 0),
('2025-02-11'::date, 12, 54, 1, 0),
('2025-02-12'::date, 0, 54, 0, 0),
('2025-02-13'::date, 0, 54, 0, 0),
('2025-02-14'::date, 21, 75, 0, 0),
('2025-02-15'::date, 10, 85, 0, 1),
('2025-02-16'::date, 5, 90, 1, 0),
('2025-02-17'::date, 6, 96, 0, 0),
('2025-02-18'::date, 7, 103, 2, 0),
('2025-02-19'::date, 0, 103, 0, 0),
('2025-02-20'::date, 0, 103, 0, 0),
('2025-02-21'::date, 6, 109, 0, 0),
('2025-02-22'::date, 7, 116, 1, 1),
('2025-02-23'::date, 5, 121, 0, 1),
('2025-02-24'::date, 7, 128, 2, 0),
('2025-02-25'::date, 6, 134, 3, 0),
('2025-02-26'::date, 0, 134, 0, 0),
('2025-02-27'::date, 0, 134, 0, 0),
('2025-02-28'::date, 5, 139, 1, 2),
-- 3月の実施スケジュール
('2025-03-01'::date, 9, 148, 0, 2),
('2025-03-02'::date, 10, 158, 0, 1),
('2025-03-03'::date, 10, 168, 1, 0),
('2025-03-04'::date, 15, 183, 2, 0),
('2025-03-05'::date, 10, 193, 1, 1),
('2025-03-06'::date, 0, 193, 0, 0),
('2025-03-07'::date, 0, 193, 0, 0),
('2025-03-08'::date, 18, 211, 0, 2),
('2025-03-09'::date, 22, 233, 0, 0),
('2025-03-10'::date, 23, 256, 1, 1),
('2025-03-11'::date, 21, 277, 0, 0),
('2025-03-12'::date, 0, 277, 0, 0),
('2025-03-13'::date, 0, 277, 0, 0),
('2025-03-14'::date, 9, 286, 0, 0),
('2025-03-15'::date, 7, 293, 0, 0),
('2025-03-16'::date, 4, 297, 1, 1),
('2025-03-17'::date, 3, 300, 0, 1),
('2025-03-18'::date, 0, 300, 0, 2);

-- ========================================
-- 5. テスト結果作成（実際の日次実施に基づく）
-- ========================================
INSERT INTO tt_test_results (
    test_group_id,
    tid,
    test_case_no,
    result,
    judgment,
    software_version,
    hardware_version,
    comparator_version,
    execution_date,
    executor,
    note,
    created_at,
    updated_at,
    is_deleted
)
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((((t.row_num - 1) / 10 + 1) / 6) + 1)::text, 2, '0') || '-' || LPAD((((t.row_num - 1) / 10 + 1) % 6 + 1)::text, 2, '0'),
    ((t.row_num - 1) % 10) + 1,
    CASE
        -- NG判定を受けるケース（約10%）
        WHEN t.row_num % 10 = 0 THEN 'NG'
        -- その他
        ELSE 'OK'
    END,
    CASE
        -- NG判定を受けるケース
        WHEN t.row_num % 10 = 0 THEN 'NG'
        -- QA中（約5%）
        WHEN t.row_num % 20 = 5 THEN 'QA中'
        -- 参照OK（約5%）
        WHEN t.row_num % 20 = 15 THEN '参照OK'
        -- その他
        ELSE 'OK'
    END,
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    t.execution_date,
    CASE WHEN t.row_num % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'Daily execution for test content ' || t.row_num,
    NOW(),
    NOW(),
    false
FROM (
    SELECT
        de.execution_date,
        de.daily_count,
        ROW_NUMBER() OVER (ORDER BY de.execution_date, seq) as row_num
    FROM daily_executions de
    CROSS JOIN LATERAL generate_series(1, de.daily_count) AS seq
    WHERE de.daily_count > 0
) t;

-- ========================================
-- 6. テスト結果履歴作成（NG検出と解決を記録）
-- ========================================
INSERT INTO tt_test_results_history (
    test_group_id,
    tid,
    test_case_no,
    history_count,
    result,
    judgment,
    software_version,
    hardware_version,
    comparator_version,
    execution_date,
    executor,
    note,
    created_at,
    updated_at,
    is_deleted
)
-- 初回実行（すべてのテスト結果）
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((((t.row_num - 1) / 10 + 1) / 6) + 1)::text, 2, '0') || '-' || LPAD((((t.row_num - 1) / 10 + 1) % 6 + 1)::text, 2, '0'),
    ((t.row_num - 1) % 10) + 1,
    1,
    CASE WHEN t.row_num % 10 = 0 THEN 'NG' ELSE 'OK' END,
    CASE
        WHEN t.row_num % 10 = 0 THEN 'NG'
        WHEN t.row_num % 20 = 5 THEN 'QA中'
        WHEN t.row_num % 20 = 15 THEN '参照OK'
        ELSE 'OK'
    END,
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    t.execution_date,
    CASE WHEN t.row_num % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'History execution #1 for test content ' || t.row_num,
    NOW(),
    NOW(),
    false
FROM (
    SELECT
        de.execution_date,
        de.daily_count,
        ROW_NUMBER() OVER (ORDER BY de.execution_date, seq) as row_num
    FROM daily_executions de
    CROSS JOIN LATERAL generate_series(1, de.daily_count) AS seq
    WHERE de.daily_count > 0
) t
UNION ALL
-- 再実行（NG→OK/参照OKへの解決を記録）
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((((t.row_num - 1) / 10 + 1) / 6) + 1)::text, 2, '0') || '-' || LPAD((((t.row_num - 1) / 10 + 1) % 6 + 1)::text, 2, '0'),
    ((t.row_num - 1) % 10) + 1,
    2,
    CASE WHEN t.row_num % 10 = 0 THEN 'OK' ELSE 'OK' END,
    CASE WHEN t.row_num % 10 = 0 THEN '参照OK' ELSE 'OK' END,
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    t.execution_date + interval '5 day',
    CASE WHEN t.row_num % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'History execution #2 - NG fixed or verified',
    NOW(),
    NOW(),
    false
FROM (
    SELECT * FROM (
        SELECT
            de.execution_date,
            de.daily_count,
            ROW_NUMBER() OVER (ORDER BY de.execution_date, seq) as row_num
        FROM daily_executions de
        CROSS JOIN LATERAL generate_series(1, de.daily_count) AS seq
        WHERE de.daily_count > 0
    ) inner_t
    WHERE inner_t.row_num % 10 = 0  -- NGだったケースのみ
) t;

-- ========================================
-- 7. テストエビデンス作成
-- ========================================
INSERT INTO tt_test_evidences (
    test_group_id,
    tid,
    test_case_no,
    history_count,
    evidence_no,
    evidence_name,
    evidence_path,
    created_at,
    updated_at,
    is_deleted
)
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((((t.row_num - 1) / 10 + 1) / 6) + 1)::text, 2, '0') || '-' || LPAD((((t.row_num - 1) / 10 + 1) % 6 + 1)::text, 2, '0'),
    ((t.row_num - 1) % 10) + 1,
    1,
    ev_no,
    'Evidence_Report_Content' || LPAD(t.row_num::text, 3, '0') || '_H1_E' || ev_no || '.png',
    '/images/dummy.png',
    NOW(),
    NOW(),
    false
FROM (
    SELECT * FROM (
        SELECT
            de.execution_date,
            de.daily_count,
            ROW_NUMBER() OVER (ORDER BY de.execution_date, seq) as row_num
        FROM daily_executions de
        CROSS JOIN LATERAL generate_series(1, de.daily_count) AS seq
        WHERE de.daily_count > 0
    ) inner_t
    WHERE inner_t.row_num % 10 = 0  -- NGだったケースのみ
) t
CROSS JOIN generate_series(1, 1) AS ev_no;

-- クリーンアップ
DROP TABLE daily_executions;

-- ========================================
-- 8. トランザクション終了
-- ========================================
COMMIT;

-- ========================================
-- 9. 確認用クエリ
-- ========================================
SELECT
    'テストグループ数' as item,
    COUNT(*) as count
FROM tt_test_groups
WHERE created_at > NOW() - INTERVAL '1 minute' AND is_deleted = false
UNION ALL
SELECT 'テストケース数', COUNT(*) FROM tt_test_cases WHERE is_deleted = false
UNION ALL
SELECT 'テスト内容数', COUNT(*) FROM tt_test_contents WHERE is_deleted = false
UNION ALL
SELECT 'テスト結果数', COUNT(*) FROM tt_test_results WHERE is_deleted = false
UNION ALL
SELECT 'テスト結果履歴数', COUNT(*) FROM tt_test_results_history WHERE is_deleted = false
UNION ALL
SELECT 'テストエビデンス数', COUNT(*) FROM tt_test_evidences WHERE is_deleted = false;
