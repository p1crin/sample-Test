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
    '1-01-' || LPAD((((i - 1) / 6) + 1)::text, 2, '0') || '-' || LPAD(((((i - 1) % 6) + 1))::text, 2, '0'),
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
    '1-01-' || LPAD((((tc_i - 1) / 6) + 1)::text, 2, '0') || '-' || LPAD(((((tc_i - 1) % 6) + 1))::text, 2, '0'),
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
    daily_ng_count INTEGER,
    daily_resolved_count INTEGER
);

-- 2月の実施スケジュール（期待値テーブルに基づく）
INSERT INTO daily_executions VALUES
('2025-02-01'::date, 0, 0, 0),        -- 開始日
('2025-02-02'::date, 5, 1, 0),        -- テスト消化: 5, NG摘出: 1
('2025-02-03'::date, 7, 2, 0),        -- テスト消化: 7, NG摘出: 2
('2025-02-04'::date, 7, 1, 1),        -- テスト消化: 7, NG摘出: 1, 解決: 1
('2025-02-05'::date, 0, 0, 0),
('2025-02-06'::date, 0, 0, 0),
('2025-02-07'::date, 3, 2, 0),        -- テスト消化: 3, NG摘出: 2
('2025-02-08'::date, 6, 1, 0),        -- テスト消化: 6, NG摘出: 1
('2025-02-09'::date, 4, 2, 2),        -- テスト消化: 4, NG摘出: 2, 解決: 2
('2025-02-10'::date, 10, 1, 0),       -- テスト消化: 10, NG摘出: 1
('2025-02-11'::date, 12, 0, 1),       -- テスト消化: 12, NG摘出: 0, 解決: 1
('2025-02-12'::date, 0, 0, 0),
('2025-02-13'::date, 0, 0, 0),
('2025-02-14'::date, 21, 0, 0),       -- テスト消化: 21, NG摘出: 0
('2025-02-15'::date, 10, 0, 1),       -- テスト消化: 10, NG摘出: 0, 解決: 1
('2025-02-16'::date, 5, 1, 0),        -- テスト消化: 5, NG摘出: 1
('2025-02-17'::date, 6, 0, 0),        -- テスト消化: 6, NG摘出: 0
('2025-02-18'::date, 7, 0, 2),        -- テスト消化: 7, NG摘出: 0, 解決: 2
('2025-02-19'::date, 0, 0, 0),
('2025-02-20'::date, 0, 0, 0),
('2025-02-21'::date, 6, 2, 0),        -- テスト消化: 6, NG摘出: 2
('2025-02-22'::date, 7, 1, 1),        -- テスト消化: 7, NG摘出: 1, 解決: 1
('2025-02-23'::date, 5, 0, 1),        -- テスト消化: 5, NG摘出: 0, 解決: 1
('2025-02-24'::date, 7, 2, 0),        -- テスト消化: 7, NG摘出: 2
('2025-02-25'::date, 6, 3, 0),        -- テスト消化: 6, NG摘出: 3
('2025-02-26'::date, 0, 0, 0),
('2025-02-27'::date, 0, 0, 0),
('2025-02-28'::date, 5, 1, 2),        -- テスト消化: 5, NG摘出: 1, 解決: 2
-- 3月の実施スケジュール（期待値テーブルに基づく）
('2025-03-01'::date, 9, 0, 2),        -- テスト消化: 9, NG摘出: 0, 解決: 2
('2025-03-02'::date, 10, 0, 1),       -- テスト消化: 10, NG摘出: 0, 解決: 1
('2025-03-03'::date, 10, 1, 0),       -- テスト消化: 10, NG摘出: 1
('2025-03-04'::date, 15, 2, 0),       -- テスト消化: 15, NG摘出: 2
('2025-03-05'::date, 10, 1, 1),       -- テスト消化: 10, NG摘出: 1, 解決: 1
('2025-03-06'::date, 0, 0, 0),
('2025-03-07'::date, 0, 0, 0),
('2025-03-08'::date, 18, 3, 2),       -- テスト消化: 18, NG摘出: 3（3/7分含む）, 解決: 2
('2025-03-09'::date, 22, 0, 0),       -- テスト消化: 22, NG摘出: 0
('2025-03-10'::date, 23, 1, 1),       -- テスト消化: 23, NG摘出: 1, 解決: 1
('2025-03-11'::date, 21, 0, 0),       -- テスト消化: 21, NG摘出: 0
('2025-03-12'::date, 0, 0, 0),
('2025-03-13'::date, 0, 0, 0),
('2025-03-14'::date, 9, 0, 0),        -- テスト消化: 9, NG摘出: 0
('2025-03-15'::date, 7, 0, 0),        -- テスト消化: 7, NG摘出: 0
('2025-03-16'::date, 4, 1, 1),        -- テスト消化: 4, NG摘出: 1, 解決: 1
('2025-03-17'::date, 3, 0, 1),        -- テスト消化: 3, NG摘出: 0, 解決: 1
('2025-03-18'::date, 3, 0, 2);

-- ========================================
-- 5. テスト結果作成（期待値に基づく）
-- ========================================
WITH date_offsets AS (
    -- 各実行日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_offset
    FROM daily_executions
    WHERE daily_count > 0
),
execution_log AS (
    -- 各日付での実施ログを生成（テスト内容0～299をサイクリングで割り当てる）
    SELECT
        de.execution_date,
        ((del.cumulative_offset + seq - 1) % 300) as content_id,
        seq as position_in_day
    FROM daily_executions de
    JOIN date_offsets del ON de.execution_date = del.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_count) AS seq
    WHERE de.daily_count > 0
),
ng_offsets AS (
    -- 各NG検出日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_ng_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_ng_offset
    FROM daily_executions
    WHERE daily_ng_count > 0
),
first_ng_dates AS (
    -- 各テスト内容が最初にNG判定を受ける日付を決定（0～299をサイクリング）
    SELECT
        de.execution_date as first_ng_date,
        ((no.cumulative_ng_offset + seq - 1) % 300) as content_id
    FROM daily_executions de
    JOIN ng_offsets no ON de.execution_date = no.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_ng_count) AS seq
    WHERE de.daily_ng_count > 0
),
ng_list AS (
    -- NG判定を受けたテスト内容リスト（重複なし）
    SELECT DISTINCT
        fnd.content_id,
        ROW_NUMBER() OVER (ORDER BY MIN(fnd.first_ng_date), fnd.content_id) as ng_sequence
    FROM first_ng_dates fnd
    GROUP BY fnd.content_id
),
resolved_offsets AS (
    -- 各解決日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_resolved_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_resolved_offset
    FROM daily_executions
    WHERE daily_resolved_count > 0
),
resolved_list AS (
    -- 解決するテスト内容リスト（NG番号順）
    SELECT
        ro.cumulative_resolved_offset + seq as ng_sequence,
        de.execution_date as resolve_date
    FROM daily_executions de
    JOIN resolved_offsets ro ON de.execution_date = ro.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_resolved_count) AS seq
    WHERE de.daily_resolved_count > 0
),
last_execution AS (
    -- 各テスト内容の最後の実行日付を取得
    SELECT
        content_id,
        MAX(execution_date) as last_date
    FROM execution_log
    GROUP BY content_id
),
first_execution_per_content AS (
    -- 各テスト内容について、初回実行日を決定
    SELECT
        content_id,
        MIN(execution_date) as first_execution_date
    FROM execution_log
    GROUP BY content_id
),
final_state AS (
    -- 各テスト内容の最終状態を決定
    -- History #1の判定に基づいて最終状態を決定
    SELECT
        fepc.content_id,
        CASE
            -- 1回目でOK/参照OKなら、その判定が最終状態
            WHEN (fepc.content_id % 6) = 0 THEN 'OK'
            WHEN (fepc.content_id % 6) = 1 THEN '参照OK'
            -- 1回目でNGで、History #2で解決済み → 参照OK
            WHEN (fepc.content_id % 6) = 2 THEN '参照OK'
            -- 1回目で保留で、History #2でOK → OK
            WHEN (fepc.content_id % 6) = 3 THEN 'OK'
            -- 1回目でQA中で、History #2がNG、History #3で解決済み → 参照OK
            WHEN (fepc.content_id % 6) = 4 THEN '参照OK'
            -- 1回目で未着手で、History #2でOK → OK
            ELSE 'OK'
        END as final_judgment,
        le.last_date
    FROM last_execution le
    JOIN first_execution_per_content fepc ON le.content_id = fepc.content_id
)
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
    '1-01-' || LPAD(((fs.content_id / 10)::int / 6 + 1)::text, 2, '0') || '-' || LPAD((((fs.content_id / 10)::int % 6) + 1)::text, 2, '0'),
    ((fs.content_id % 10) + 1)::int,
    CASE WHEN fs.final_judgment = 'NG' THEN 'NG' ELSE 'OK' END,
    fs.final_judgment,
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    fs.last_date,
    CASE WHEN fs.content_id % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'Final test state for content ' || fs.content_id || ' - Status: ' || fs.final_judgment,
    NOW(),
    NOW(),
    false
FROM final_state fs
ORDER BY fs.content_id;

-- ========================================
-- 6. テスト結果履歴作成（期待値に基づく）
-- ========================================
WITH date_offsets AS (
    -- 各実行日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_offset
    FROM daily_executions
    WHERE daily_count > 0
),
all_executions AS (
    -- 全実行のログ（テスト内容0～299をサイクリングで割り当てる）
    SELECT
        de.execution_date,
        ((del.cumulative_offset + seq - 1) % 300) as content_id,
        seq as position_in_day
    FROM daily_executions de
    JOIN date_offsets del ON de.execution_date = del.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_count) AS seq
    WHERE de.daily_count > 0
),
ng_offsets AS (
    -- 各NG検出日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_ng_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_ng_offset
    FROM daily_executions
    WHERE daily_ng_count > 0
),
first_ng_dates AS (
    -- 各テスト内容が最初にNG判定を受ける日付を決定（0～299をサイクリング）
    SELECT
        de.execution_date as first_ng_date,
        ((no.cumulative_ng_offset + seq - 1) % 300) as content_id
    FROM daily_executions de
    JOIN ng_offsets no ON de.execution_date = no.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_ng_count) AS seq
    WHERE de.daily_ng_count > 0
),
ng_list AS (
    -- NG判定を受けたテスト内容リスト（重複なし）
    SELECT DISTINCT
        fnd.content_id,
        ROW_NUMBER() OVER (ORDER BY MIN(fnd.first_ng_date), fnd.content_id) as ng_sequence
    FROM first_ng_dates fnd
    GROUP BY fnd.content_id
),
resolved_offsets AS (
    -- 各解決日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_resolved_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_resolved_offset
    FROM daily_executions
    WHERE daily_resolved_count > 0
),
resolved_list AS (
    -- 解決するテスト内容リスト（NG番号順）
    SELECT
        ro.cumulative_resolved_offset + seq as ng_sequence,
        de.execution_date as resolve_date
    FROM daily_executions de
    JOIN resolved_offsets ro ON de.execution_date = ro.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_resolved_count) AS seq
    WHERE de.daily_resolved_count > 0
),
first_execution_per_content AS (
    -- 各テスト内容について、初回実行日を決定
    SELECT
        content_id,
        MIN(execution_date) as first_execution_date
    FROM all_executions
    GROUP BY content_id
),
first_executions AS (
    -- 各テスト内容の初回実行（history_count=1として記録）
    -- NOTE: content_id ごとに 1 つのレコードのみ（主キー制約により）
    -- 判定バリエーション：content_id % 6 により判定を割り当て
    SELECT
        fepc.content_id,
        fepc.first_execution_date,
        CASE
            WHEN (fepc.content_id % 6) = 0 THEN 'OK'           -- 1回目でOK→以降は再実施対象外
            WHEN (fepc.content_id % 6) = 1 THEN '参照OK'       -- 1回目で参照OK→以降は再実施対象外
            WHEN (fepc.content_id % 6) = 2 THEN 'NG'           -- 1回目でNG→2回目で解決
            WHEN (fepc.content_id % 6) = 3 THEN '保留'         -- 1回目で保留→2回目で再テスト
            WHEN (fepc.content_id % 6) = 4 THEN 'QA中'         -- 1回目でQA中→2回目で再テスト
            ELSE '未着手'                                        -- 1回目で未着手→2回目で実施
        END as judgment
    FROM first_execution_per_content fepc
)
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
-- History #1: 初回実行時の判定
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((fe.content_id / 10)::int / 6 + 1)::text, 2, '0') || '-' || LPAD((((fe.content_id / 10)::int % 6) + 1)::text, 2, '0'),
    ((fe.content_id % 10) + 1)::int,
    1,
    CASE WHEN fe.judgment = 'NG' THEN 'NG' ELSE 'OK' END,
    fe.judgment,
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    fe.first_execution_date,
    CASE WHEN fe.content_id % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'History #1 - Initial execution for content ' || fe.content_id,
    NOW(),
    NOW(),
    false
FROM first_executions fe
UNION ALL
-- History #2: 2回目実行（1回目の判定に応じて異なる処理）
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((fe.content_id / 10)::int / 6 + 1)::text, 2, '0') || '-' || LPAD((((fe.content_id / 10)::int % 6) + 1)::text, 2, '0'),
    ((fe.content_id % 10) + 1)::int,
    2,
    CASE
        -- 1回目でOK/参照OKなら再実施対象外（resultはOK固定）
        WHEN fe.judgment IN ('OK', '参照OK') THEN 'OK'
        -- その他なら新たな判定を割り当て
        WHEN (fe.content_id % 6) = 2 AND fe.judgment = 'NG' THEN 'OK'        -- NG→OK解決
        WHEN (fe.content_id % 6) = 3 AND fe.judgment = '保留' THEN 'OK'      -- 保留→OK
        WHEN (fe.content_id % 6) = 4 AND fe.judgment = 'QA中' THEN 'NG'      -- QA中→NG（NG判定）
        ELSE 'OK'
    END as result,
    CASE
        -- 1回目でOK/参照OKなら再実施対象外
        WHEN fe.judgment IN ('OK', '参照OK') THEN '再実施対象外'
        -- その他なら新たな判定を割り当て
        WHEN (fe.content_id % 6) = 2 AND fe.judgment = 'NG' THEN '参照OK'     -- NG→OK解決
        WHEN (fe.content_id % 6) = 3 AND fe.judgment = '保留' THEN 'OK'      -- 保留→OK
        WHEN (fe.content_id % 6) = 4 AND fe.judgment = 'QA中' THEN 'NG'      -- QA中→NG
        ELSE 'OK'
    END as judgment,
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    (fe.first_execution_date + INTERVAL '1 day')::date,
    CASE WHEN fe.content_id % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'History #2 - Second execution for content ' || fe.content_id || ' - First judgment was: ' || fe.judgment,
    NOW(),
    NOW(),
    false
FROM first_executions fe
UNION ALL
-- History #3: 3回目実行（QA中がNGになったケースの解決）
-- (content_id % 6) = 4 の場合、History #2がNG → History #3で参照OKへ解決
SELECT
    currval('tt_test_groups_id_seq'),
    '1-01-' || LPAD(((fe.content_id / 10)::int / 6 + 1)::text, 2, '0') || '-' || LPAD((((fe.content_id / 10)::int % 6) + 1)::text, 2, '0'),
    ((fe.content_id % 10) + 1)::int,
    3,
    'OK',
    '参照OK',
    'v3.1.0',
    'HW-v1.2',
    'CMP-v2.0',
    (fe.first_execution_date + INTERVAL '2 days')::date,
    CASE WHEN fe.content_id % 2 = 0 THEN 'Engineer A' ELSE 'Engineer B' END,
    'History #3 - QA中のNG判定が解決され参照OK for content ' || fe.content_id,
    NOW(),
    NOW(),
    false
FROM first_executions fe
WHERE (fe.content_id % 6) = 4;

-- ========================================
-- 7. テストエビデンス作成
-- ========================================
WITH ng_offsets_ev AS (
    -- 各NG検出日付の累積カウントを計算
    SELECT
        execution_date,
        COALESCE((SUM(daily_ng_count) OVER (ORDER BY execution_date ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING))::int, 0) as cumulative_ng_offset
    FROM daily_executions
    WHERE daily_ng_count > 0
),
ng_evidence_list AS (
    -- NG判定を受けたテスト内容リスト（0～299をサイクリング）
    SELECT DISTINCT
        ((no.cumulative_ng_offset + seq - 1) % 300) as content_id,
        ROW_NUMBER() OVER (ORDER BY ((no.cumulative_ng_offset + seq - 1) % 300)) as ng_sequence
    FROM daily_executions de
    JOIN ng_offsets_ev no ON de.execution_date = no.execution_date
    CROSS JOIN LATERAL generate_series(1, de.daily_ng_count) AS seq
    WHERE de.daily_ng_count > 0
)
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
    '1-01-' || LPAD(((nel.content_id / 10)::int / 6 + 1)::text, 2, '0') || '-' || LPAD((((nel.content_id / 10)::int % 6) + 1)::text, 2, '0'),
    ((nel.content_id % 10) + 1)::int,
    1,
    ev_no,
    'Evidence_Report_Content' || LPAD(nel.content_id::text, 3, '0') || '_H1_E' || ev_no || '.png',
    '/images/dummy.png',
    NOW(),
    NOW(),
    false
FROM ng_evidence_list nel
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
