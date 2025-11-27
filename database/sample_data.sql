-- テストグループとテストケースのサンプルデータ投入スクリプト
-- OEM1で統一されたサンプルデータ
-- DELETE文も含まれているため、簡単に削除できます

-- ====================================
-- 既存のOEM1データを削除（初期化）
-- ====================================
DELETE FROM tt_test_groups WHERE oem = 'OEM1';

-- ====================================
-- サンプルテストグループの投入（5グループ）
-- ====================================
INSERT INTO tt_test_groups (
  oem, model, event, variation, destination, specs,
  test_startdate, test_enddate, ng_plan_count,
  created_by, updated_by, is_deleted
) VALUES
  ('OEM1', 'Model A', 'Battery Test', 'VAR-001', 'Japan', 'バッテリー駆動時間テスト仕様書',
   '2025-01-01'::DATE, '2025-01-31'::DATE, 50, '1', '1', FALSE),
  ('OEM1', 'Model A', 'Camera Test', 'VAR-001', 'Japan', 'カメラ性能テスト仕様書',
   '2025-01-05'::DATE, '2025-02-05'::DATE, 75, '1', '1', FALSE),
  ('OEM1', 'Model A', 'Performance Test', 'VAR-001', 'Japan', 'パフォーマンステスト仕様書',
   '2025-01-10'::DATE, '2025-02-10'::DATE, 60, '1', '1', FALSE),
  ('OEM1', 'Model B', 'Display Test', 'VAR-002', 'Japan', 'ディスプレイテスト仕様書',
   '2025-02-01'::DATE, '2025-02-28'::DATE, 45, '1', '1', FALSE),
  ('OEM1', 'Model B', 'Audio Test', 'VAR-002', 'Japan', '音声テスト仕様書',
   '2025-02-05'::DATE, '2025-03-05'::DATE, 40, '1', '1', FALSE);

-- ====================================
-- サンプルテストケースの投入（グループあたり5ケース、計25ケース）
-- ====================================

-- Model A - Battery Test
INSERT INTO tt_test_cases (
  test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
  purpose, request_id, check_items, test_procedure, is_deleted
) VALUES
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Battery Test' LIMIT 1),
   'TC001', 'システム動作', 'バッテリー容量', '通常状態', '初期化後',
   'バッテリー容量の検証', 'REQ-001', 'バッテリー容量が仕様値以上であること',
   'デバイスを初期化後、バッテリー容量を確認する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Battery Test' LIMIT 1),
   'TC002', 'システム動作', 'バッテリー駆動時間', '通常使用', '画面オン時',
   'バッテリー駆動時間の検証', 'REQ-002', '駆動時間が12時間以上であること',
   '画面を常時オンで使用し、動作時間を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Battery Test' LIMIT 1),
   'TC003', 'システム動作', 'バッテリー駆動時間', 'スタンバイ', 'スクリーンオフ',
   'スタンバイ時のバッテリー消費の検証', 'REQ-003', 'スタンバイ時の消費電流が10mA以下であること',
   '画面をオフにしてスタンバイし、消費電流を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Battery Test' LIMIT 1),
   'TC004', '充放電', '充電時間', '通常充電', '0-100%',
   '充電時間の検証', 'REQ-004', '充電時間が2時間以内であること',
   '標準充電器で0%から100%まで充電し、時間を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Battery Test' LIMIT 1),
   'TC005', '充放電', '充電安全性', '過充電保護', '充電継続',
   '過充電保護機能の検証', 'REQ-005', '過充電時に自動的に充電が停止すること',
   '充電完了後も充電器に接続し、電流が流れないことを確認する', FALSE);

-- Model A - Camera Test
INSERT INTO tt_test_cases (
  test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
  purpose, request_id, check_items, test_procedure, is_deleted
) VALUES
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Camera Test' LIMIT 1),
   'TC001', '撮影機能', 'レンズ解像度', 'メインカメラ', '標準焦点',
   'メインカメラの解像度検証', 'REQ-001', '最大解像度が1600万画素以上であること',
   'カメラを起動し、最大解像度で静止画を撮影する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Camera Test' LIMIT 1),
   'TC002', '撮影機能', 'フォーカス性能', 'オートフォーカス', '近距離',
   'オートフォーカスの焦点精度検証', 'REQ-002', '近距離（10cm）でのフォーカスが正確であること',
   '近距離にある被写体にフォーカスを合わせ、画像の明瞭性を確認する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Camera Test' LIMIT 1),
   'TC003', '撮影機能', 'フォーカス性能', 'マニュアルフォーカス', '遠距離',
   'マニュアルフォーカスの焦点精度検証', 'REQ-003', '遠距離のピント合わせが可能であること',
   '手動でフォーカスを調整し、遠距離の被写体にピントが合うことを確認する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Camera Test' LIMIT 1),
   'TC004', 'ビデオ撮影', 'フレームレート', '4K撮影', '30fps',
   'ビデオ撮影フレームレート検証', 'REQ-004', '4K 30fpsでのビデオ撮影が可能であること',
   '4K 30fpsモードでビデオを撮影し、フレームレートを確認する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Camera Test' LIMIT 1),
   'TC005', 'ビデオ撮影', 'フレームレート', '1080p撮影', '60fps',
   'ハイフレームレートビデオ撮影検証', 'REQ-005', '1080p 60fpsでのビデオ撮影が可能であること',
   '1080p 60fpsモードでビデオを撮影し、スムーズに再生されることを確認する', FALSE);

-- Model A - Performance Test
INSERT INTO tt_test_cases (
  test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
  purpose, request_id, check_items, test_procedure, is_deleted
) VALUES
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Performance Test' LIMIT 1),
   'TC001', 'CPU性能', 'シングルコア性能', 'ベンチマーク', 'スコア測定',
   'CPU シングルコア性能の検証', 'REQ-001', 'シングルコアスコアが1500以上であること',
   '標準ベンチマークツールを使用してシングルコア性能を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Performance Test' LIMIT 1),
   'TC002', 'CPU性能', 'マルチコア性能', 'ベンチマーク', 'スコア測定',
   'CPUマルチコア性能の検証', 'REQ-002', 'マルチコアスコアが6000以上であること',
   'ベンチマークツールでマルチコア性能を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Performance Test' LIMIT 1),
   'TC003', 'メモリ性能', 'RAM速度', 'ランダムアクセス', '読み込み',
   'RAM読み込み速度の検証', 'REQ-003', '読み込み速度が30,000 MB/s以上であること',
   'メモリベンチマークで読み込み速度を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Performance Test' LIMIT 1),
   'TC004', 'ストレージ性能', 'SSD速度', 'シーケンシャル', '読み込み',
   'ストレージ読み込み速度の検証', 'REQ-004', '読み込み速度が200 MB/s以上であること',
   'ストレージベンチマークで読み込み速度を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Performance Test' LIMIT 1),
   'TC005', 'GPU性能', 'グラフィック処理', '3D描画', 'フレームレート',
   'GPU 3Dグラフィック性能の検証', 'REQ-005', '3Dゲームが60fpsで動作すること',
   '標準的な3Dゲームを起動し、フレームレートを確認する', FALSE);

-- Model B - Display Test
INSERT INTO tt_test_cases (
  test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
  purpose, request_id, check_items, test_procedure, is_deleted
) VALUES
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Display Test' LIMIT 1),
   'TC001', 'ディスプレイ表示', '色精度', 'RGB色', '標準色',
   'RGB色表示精度の検証', 'REQ-001', 'RGB各色が正確に表示されること',
   'テストパターンを表示して色精度を確認する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Display Test' LIMIT 1),
   'TC002', 'ディスプレイ表示', '輝度', '最大輝度', '光源下',
   '最大輝度の検証', 'REQ-002', '最大輝度が500nits以上であること',
   '明るい場所でディスプレイの輝度を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Display Test' LIMIT 1),
   'TC003', 'ディスプレイ表示', 'コントラスト比', 'OLED', '黒表現',
   'OLED コントラスト比の検証', 'REQ-003', 'コントラスト比が1000:1以上であること',
   '黒と白の表示を比較してコントラスト比を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Display Test' LIMIT 1),
   'TC004', 'ディスプレイ応答性', '応答時間', 'タッチ入力', 'レスポンス',
   'タッチ入力レスポンスの検証', 'REQ-004', 'タッチ応答時間が50ms以内であること',
   'タッチスクリーンをタップして応答時間を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Display Test' LIMIT 1),
   'TC005', 'ディスプレイ耐久性', 'バーンイン保護', '静止画表示', '長時間',
   'バーンイン防止機能の検証', 'REQ-005', 'バーンイン防止機能が働くこと',
   '同じ画像を長時間表示してバーンイン防止機能を確認する', FALSE);

-- Model B - Audio Test
INSERT INTO tt_test_cases (
  test_group_id, tid, first_layer, second_layer, third_layer, fourth_layer,
  purpose, request_id, check_items, test_procedure, is_deleted
) VALUES
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Audio Test' LIMIT 1),
   'TC001', 'スピーカー', 'スピーカー音質', 'ステレオスピーカー', '周波数特性',
   'ステレオスピーカー周波数特性の検証', 'REQ-001', '周波数範囲が20Hz～20kHzをカバーしていること',
   'スイープ信号を再生して周波数特性を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Audio Test' LIMIT 1),
   'TC002', 'スピーカー', 'スピーカー音量', '最大音量', 'SPL測定',
   'スピーカー最大音量の検証', 'REQ-002', '最大音量が80dB以上であること',
   '最大音量で音を再生してSPLを測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Audio Test' LIMIT 1),
   'TC003', 'マイク', 'マイク感度', 'メインマイク', '会話音量',
   'マイク感度の検証', 'REQ-003', '通常会話音量（70dB）で明確に音声が録音されること',
   '会話音量で音声を録音して感度を確認する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Audio Test' LIMIT 1),
   'TC004', 'マイク', 'ノイズキャンセレーション', 'バックグラウンドノイズ', '削減効果',
   'ノイズキャンセレーション機能の検証', 'REQ-004', 'バックグラウンドノイズが50%以上削減されること',
   '騒音環境で音声を録音してノイズ削減効果を測定する', FALSE),
  ((SELECT id FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model B' AND event = 'Audio Test' LIMIT 1),
   'TC005', 'オーディオフォーマット', '対応フォーマット', '音質比較', 'MP3/FLAC',
   'オーディオフォーマット対応の検証', 'REQ-005', 'MP3、FLAC等複数のフォーマットが再生できること',
   '複数のフォーマットで音声を再生して確認する', FALSE);

-- ====================================
-- DELETE用のクエリ（参考）
-- ====================================
-- OEM1のすべてのテストグループとテストケースを削除する場合：
-- DELETE FROM tt_test_groups WHERE oem = 'OEM1';
-- （テストケースはCASCADE DELETEで自動削除されます）
--
-- 特定のテストグループのみ削除する場合：
-- DELETE FROM tt_test_groups WHERE oem = 'OEM1' AND model = 'Model A' AND event = 'Battery Test';
--
-- 論理削除（ソフトデリート）を使う場合：
-- UPDATE tt_test_groups SET is_deleted = TRUE, updated_by = '1' WHERE oem = 'OEM1';
-- UPDATE tt_test_cases SET is_deleted = TRUE WHERE test_group_id IN (SELECT id FROM tt_test_groups WHERE oem = 'OEM1');
