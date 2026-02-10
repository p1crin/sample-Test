const ExcelJS = require('exceljs');

/**
 * テストケースインポートバッチ 結合テスト仕様書 生成スクリプト
 *
 * セル結合対応：テスト項目が同一のテストケースはテスト項目列を結合する
 */
async function generateTestImportBatchSpec() {
  const workbook = new ExcelJS.Workbook();

  // ==================== 共通スタイル定義 ====================
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  const cellStyle = {
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  const cellStyleCenter = {
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  };

  // ==================== ヘルパー関数 ====================

  /**
   * シートにテストケースを追加し、テスト項目列のセル結合を行う
   */
  function addTestCasesWithMerge(sheet, testCases, startDataRow) {
    const dataStartRow = startDataRow;

    // テストケースデータ追加
    testCases.forEach((tc, index) => {
      const rowNum = dataStartRow + index;
      const row = sheet.getRow(rowNum);
      row.values = [
        tc.testId,
        tc.testItem,
        tc.testPoint,
        tc.precondition,
        tc.testSteps,
        tc.expectedResult,
        tc.actualResult || '',
        tc.remarks || '',
      ];
      row.height = 80;
      row.eachCell((cell, colNumber) => {
        if (colNumber <= 2) {
          cell.style = { ...cellStyleCenter };
        } else {
          cell.style = { ...cellStyle };
        }
      });
    });

    // テスト項目列（B列=2列目）のセル結合
    if (testCases.length > 0) {
      let mergeStartRow = dataStartRow;
      let currentItem = testCases[0].testItem;

      for (let i = 1; i <= testCases.length; i++) {
        const currentRow = dataStartRow + i;
        const nextItem = i < testCases.length ? testCases[i].testItem : null;

        if (nextItem !== currentItem) {
          const mergeEndRow = dataStartRow + i - 1;
          // 2行以上の場合のみ結合
          if (mergeEndRow > mergeStartRow) {
            sheet.mergeCells(mergeStartRow, 2, mergeEndRow, 2);
            const mergedCell = sheet.getCell(mergeStartRow, 2);
            mergedCell.style = {
              ...cellStyleCenter,
              alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
            };
          }
          mergeStartRow = currentRow;
          currentItem = nextItem;
        }
      }
    }
  }

  /**
   * 共通のシート設定
   */
  function setupSheet(sheet) {
    sheet.columns = [
      { key: 'testId', width: 12 },
      { key: 'testItem', width: 24 },
      { key: 'testPoint', width: 32 },
      { key: 'precondition', width: 32 },
      { key: 'testSteps', width: 44 },
      { key: 'expectedResult', width: 44 },
      { key: 'actualResult', width: 12 },
      { key: 'remarks', width: 18 },
    ];

    // ヘッダー行
    const headerRow = sheet.getRow(1);
    headerRow.values = [
      'テストID',
      'テスト項目',
      'テスト観点',
      '前提条件',
      'テスト手順',
      '期待結果',
      '結果',
      '備考',
    ];
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.style = headerStyle;
    });
  }

  // ==================== IT1シート: 正常系処理 ====================
  const it1Sheet = workbook.addWorksheet('IT1_正常系処理');
  setupSheet(it1Sheet);

  const it1TestCases = [
    // ---------- 環境変数検証 ----------
    {
      testId: 'IT1-001',
      testItem: '環境変数検証',
      testPoint: '必須環境変数が全て設定されている場合にバッチが開始されること',
      precondition: 'INPUT_S3_BUCKET, INPUT_S3_KEY, OUTPUT_S3_BUCKET, DATABASE_URL, TEST_GROUP_ID が全て設定済み',
      testSteps: '1. 全必須環境変数を設定\n2. バッチを実行',
      expectedResult: '・バッチが正常に開始される\n・「テストケースインポートバッチを開始します...」がログ出力される',
    },
    {
      testId: 'IT1-002',
      testItem: '環境変数検証',
      testPoint: 'TEST_GROUP_IDが正の整数として検証されること',
      precondition: 'TEST_GROUP_ID=5 で設定',
      testSteps: '1. TEST_GROUP_ID に正の整数を設定\n2. バッチを実行',
      expectedResult: '・TEST_GROUP_IDが正常に解析される\n・「テストグループID: 5」がログ出力される',
    },
    {
      testId: 'IT1-003',
      testItem: '環境変数検証',
      testPoint: 'S3モードでFILE_S3_BUCKETが検証されること',
      precondition: 'STORAGE_MODE=s3, FILE_S3_BUCKET が設定済み',
      testSteps: '1. STORAGE_MODE=s3 に設定\n2. FILE_S3_BUCKET を設定\n3. バッチを実行',
      expectedResult: '・FILE_S3_BUCKETの検証が成功する\n・S3ストレージモードで処理が進行する',
    },
    // ---------- テストグループ存在確認 ----------
    {
      testId: 'IT1-004',
      testItem: 'テストグループ存在確認',
      testPoint: '指定されたテストグループが存在する場合に処理が続行すること',
      precondition: 'TEST_GROUP_ID で指定したテストグループがDBに存在\nis_deleted=false',
      testSteps: '1. 存在するテストグループIDを指定\n2. バッチを実行',
      expectedResult: '・テストグループの存在確認が成功する\n・処理が続行される',
    },
    // ---------- インポート結果記録開始 ----------
    {
      testId: 'IT1-005',
      testItem: 'インポート結果記録',
      testPoint: 'インポート開始時にtt_import_resultsにレコードが作成されること',
      precondition: 'バッチが正常に開始された状態',
      testSteps: '1. バッチを実行\n2. tt_import_resultsテーブルを確認',
      expectedResult: '・import_status=0（実施中）のレコードが作成される\n・file_nameにINPUT_S3_KEYが設定される\n・executor_nameにEXECUTOR_NAMEが設定される\n・import_type=1（テストケースインポート）\n・「インポート処理を開始しました」がmessageに設定される',
    },
    // ---------- ZIP読み込み・解凍 ----------
    {
      testId: 'IT1-006',
      testItem: 'ZIP読み込み・解凍',
      testPoint: 'S3からZIPファイルを正常に読み込めること',
      precondition: 'S3に正常なZIPファイルがアップロード済み',
      testSteps: '1. バッチを実行\n2. S3読み込みログを確認',
      expectedResult: '・「ZIPファイルを読み込み中...」がログ出力される\n・S3からZIPファイルが正常に読み込まれる',
    },
    {
      testId: 'IT1-007',
      testItem: 'ZIP読み込み・解凍',
      testPoint: 'ZIPファイルからCSVと添付ファイルが抽出されること',
      precondition: 'ZIPにCSV1ファイルと複数の添付ファイルが含まれている',
      testSteps: '1. バッチを実行\n2. 解凍結果ログを確認',
      expectedResult: '・「ZIPファイルを解凍中...」がログ出力される\n・CSVコンテンツが抽出される\n・添付ファイルがMapに格納される\n・「ZIPからN個のファイルを抽出しました」がログ出力される',
    },
    {
      testId: 'IT1-008',
      testItem: 'ZIP読み込み・解凍',
      testPoint: 'ZIPファイルのパス正規化が行われること',
      precondition: 'ZIP内のファイルパスに「./」プレフィックスが含まれている',
      testSteps: '1. 「./evidence/file.png」のようなパスのファイルを含むZIPでバッチ実行',
      expectedResult: '・先頭の「./」が除去される\n・「evidence/file.png」として正規化される\n・ファイルの参照が正しく動作する',
    },
    // ---------- CSVパース ----------
    {
      testId: 'IT1-009',
      testItem: 'CSVパース',
      testPoint: 'CSVが正しくパースされること',
      precondition: 'ZIPにヘッダー付きCSVが含まれている',
      testSteps: '1. バッチを実行\n2. パース結果ログを確認',
      expectedResult: '・「CSVをパース中...」がログ出力される\n・「N件のテストデータを検出しました」がログ出力される\n・全23列が正しく読み取られる',
    },
    {
      testId: 'IT1-010',
      testItem: 'CSVパース',
      testPoint: '日本語ヘッダーが英語プロパティ名にマッピングされること',
      precondition: 'CSVヘッダーが日本語（TID, No, 第1層, ...）',
      testSteps: '1. 日本語ヘッダーのCSVを含むZIPでバッチ実行',
      expectedResult: '・TID → tid\n・No → no\n・第1層 → first_layer\n・確認観点 → check_items\n・等の全23列が正しくマッピングされる',
    },
    // ---------- バリデーション ----------
    {
      testId: 'IT1-011',
      testItem: 'バリデーション',
      testPoint: '全行のバリデーションが正常に通過すること',
      precondition: 'CSV全行のデータが正しい形式である',
      testSteps: '1. 正しいデータのCSVでバッチ実行',
      expectedResult: '・「全行のバリデーションを実行中...」がログ出力される\n・バリデーションが成功し処理が続行される',
    },
    {
      testId: 'IT1-012',
      testItem: 'バリデーション',
      testPoint: 'TID形式（半角ハイフンつながり）が検証されること',
      precondition: 'TIDが「1-1-1-1」形式で設定されている',
      testSteps: '1. TID=\"1-2-3-4\" のデータでバッチ実行',
      expectedResult: '・TIDの形式バリデーションが成功する\n・正規表現 /^[0-9]+-[0-9]+-[0-9]+-[0-9]+$/ にマッチする',
    },
    {
      testId: 'IT1-013',
      testItem: 'バリデーション',
      testPoint: '判定値が列挙型として検証されること',
      precondition: '判定値に有効な値（OK, NG等）が設定されている',
      testSteps: '1. 判定=\"OK\" のデータでバッチ実行',
      expectedResult: '・判定値バリデーションが成功する\n・有効な値: 未着手, 保留, QA中, OK, 参照OK, NG, 再実施対象外, 対象外',
    },
    {
      testId: 'IT1-014',
      testItem: 'バリデーション',
      testPoint: '日付形式（yyyy/mm/dd）が検証されること',
      precondition: '実施日が「2025/01/15」形式で設定されている',
      testSteps: '1. 実施日=\"2025/01/15\" のデータでバッチ実行',
      expectedResult: '・日付形式バリデーションが成功する\n・実際の日付として有効であることが確認される',
    },
    {
      testId: 'IT1-015',
      testItem: 'バリデーション',
      testPoint: '必須項目（23項目）が全て検証されること',
      precondition: '全必須項目に値が設定されている',
      testSteps: '1. 全項目に値があるCSVでバッチ実行',
      expectedResult: '・TID, No, 第1層〜第4層, 目的, 要求ID, 確認観点, 制御仕様, データフロー, テスト手順, テストケース, 期待値, 結果, 判定, 実施日, ソフトVer., ハードVer., コンパラVer., 実施者, 備考 の必須チェックが成功する',
    },
    {
      testId: 'IT1-016',
      testItem: 'バリデーション',
      testPoint: '文字数制限（255文字）が検証されること',
      precondition: '各フィールドの文字数が255文字以内',
      testSteps: '1. 文字数制限内のデータでバッチ実行',
      expectedResult: '・第1層〜第4層, 目的, 要求ID, ソフトVer., ハードVer., コンパラVer., 実施者 の文字数チェックが成功する（各255文字以内）',
    },
    // ---------- ファイル存在確認 ----------
    {
      testId: 'IT1-017',
      testItem: 'ファイル存在確認',
      testPoint: 'CSV内で参照されている全ファイルがZIP内に存在することが確認されること',
      precondition: 'CSV内の制御仕様、データフロー、エビデンスで参照されるファイルがZIP内に存在',
      testSteps: '1. 全参照ファイルを含むZIPでバッチ実行',
      expectedResult: '・「参照ファイルの存在確認中...」がログ出力される\n・全ファイルの存在確認が成功する',
    },
    {
      testId: 'IT1-018',
      testItem: 'ファイル存在確認',
      testPoint: 'セミコロン区切りの複数ファイルパスが正しく解析されること',
      precondition: '制御仕様=\"spec1.pdf;spec2.pdf\" のように複数ファイルが指定されている',
      testSteps: '1. セミコロン区切りの複数ファイル参照を含むCSVでバッチ実行',
      expectedResult: '・セミコロンで分割されて各ファイルパスが個別に検証される\n・前後の空白がトリミングされる\n・空文字列はフィルタリングされる',
    },
    // ---------- TIDグループ化 ----------
    {
      testId: 'IT1-019',
      testItem: 'TIDグループ化',
      testPoint: 'CSV行がTIDごとに正しくグループ化されること',
      precondition: '同一TIDに複数のNo（テスト内容）がある',
      testSteps: '1. TID=\"1-1-1-1\" にNo=1,2,3 の3行があるCSVでバッチ実行',
      expectedResult: '・「テストケースをグループ化中...」がログ出力される\n・同一TIDの行が1つのGroupedTestCaseにまとまる\n・contentsに3つのTestContentが含まれる\n・「N個のテストケース（TID）を検出しました」がログ出力される',
    },
    {
      testId: 'IT1-020',
      testItem: 'TIDグループ化',
      testPoint: 'グループ化時にテストケース共通情報が最初の行から取得されること',
      precondition: '同一TIDに複数行があるCSV',
      testSteps: '1. バッチ実行\n2. グループ化結果を確認',
      expectedResult: '・first_layer〜fourth_layer, purpose, request_id, check_items, test_procedureは最初の行の値が使用される\n・control_spec_paths, data_flow_pathsは最初の行から取得される',
    },
    {
      testId: 'IT1-021',
      testItem: 'TIDグループ化',
      testPoint: '判定が「対象外」のテスト内容のis_targetがfalseになること',
      precondition: '判定=\"対象外\" のデータがCSVに含まれている',
      testSteps: '1. 判定=\"対象外\" の行を含むCSVでバッチ実行',
      expectedResult: '・判定=\"対象外\" の場合 is_target=false\n・それ以外の判定の場合 is_target=true',
    },
    // ---------- テストケース登録（DB） ----------
    {
      testId: 'IT1-022',
      testItem: 'テストケース登録',
      testPoint: 'tt_test_casesテーブルにテストケースが登録されること',
      precondition: 'バリデーション、グループ化が完了\nTIDが未登録',
      testSteps: '1. バッチ実行\n2. tt_test_casesテーブルを確認',
      expectedResult: '・test_group_id, tid, first_layer〜fourth_layer, purpose, request_id, check_items, test_procedureが登録される',
    },
    {
      testId: 'IT1-023',
      testItem: 'テストケース登録',
      testPoint: 'tt_test_contentsテーブルにテスト内容が登録されること',
      precondition: 'テストケースが正常に登録された状態',
      testSteps: '1. バッチ実行\n2. tt_test_contentsテーブルを確認',
      expectedResult: '・test_group_id, tid, test_case_no, test_case, expected_value, is_targetが登録される\n・各No（行）ごとにレコードが作成される',
    },
    {
      testId: 'IT1-024',
      testItem: 'テストケース登録',
      testPoint: 'tt_test_resultsテーブルにテスト結果が登録されること',
      precondition: 'テスト内容が正常に登録された状態',
      testSteps: '1. バッチ実行\n2. tt_test_resultsテーブルを確認',
      expectedResult: '・test_group_id, tid, test_case_no, result, judgment, software/hardware/comparator_version, execution_date, executor, noteが登録される',
    },
    {
      testId: 'IT1-025',
      testItem: 'テストケース登録',
      testPoint: 'tt_test_results_historyテーブルに履歴が登録されること',
      precondition: 'テスト結果が正常に登録された状態',
      testSteps: '1. バッチ実行\n2. tt_test_results_historyテーブルを確認',
      expectedResult: '・history_count=1固定で履歴レコードが作成される\n・result, judgment等のフィールドがtt_test_resultsと同一の値で登録される',
    },
    {
      testId: 'IT1-026',
      testItem: 'テストケース登録',
      testPoint: 'トランザクション内で全テストケースが一括登録されること',
      precondition: '複数TIDのテストケースがCSVに含まれている',
      testSteps: '1. 5個のTIDを含むCSVでバッチ実行',
      expectedResult: '・prisma.$transaction内で全テストケースが処理される\n・maxWait=60秒, timeout=5分が設定される\n・全件が正常に登録される',
    },
    // ---------- ファイルアップロード ----------
    {
      testId: 'IT1-027',
      testItem: 'ファイルアップロード（S3）',
      testPoint: '制御仕様ファイルがS3にアップロードされること',
      precondition: 'STORAGE_MODE=s3\n制御仕様ファイルがZIP内に存在',
      testSteps: '1. 制御仕様ファイルを参照するCSVでバッチ実行\n2. S3を確認',
      expectedResult: '・S3キー: uploads/test-cases/{testGroupId}/{tid}/{fileName}\n・tt_test_case_filesにfile_type=0（CONTROL_SPEC）で登録される\n・file_pathに「/{S3キー}」が設定される',
    },
    {
      testId: 'IT1-028',
      testItem: 'ファイルアップロード（S3）',
      testPoint: 'データフローファイルがS3にアップロードされること',
      precondition: 'STORAGE_MODE=s3\nデータフローファイルがZIP内に存在',
      testSteps: '1. データフローファイルを参照するCSVでバッチ実行\n2. S3を確認',
      expectedResult: '・S3キー: uploads/test-cases/{testGroupId}/{tid}/{fileName}\n・tt_test_case_filesにfile_type=1（DATA_FLOW）で登録される\n・file_noが制御仕様の続番で設定される',
    },
    {
      testId: 'IT1-029',
      testItem: 'ファイルアップロード（S3）',
      testPoint: 'エビデンスファイルがS3にアップロードされること',
      precondition: 'STORAGE_MODE=s3\nエビデンスファイルがZIP内に存在',
      testSteps: '1. エビデンスファイルを参照するCSVでバッチ実行\n2. S3を確認',
      expectedResult: '・S3キー: evidences/{testGroupId}/{tid}/{fileName}\n・tt_test_evidencesにhistory_count=1で登録される\n・evidence_noが連番で設定される',
    },
    {
      testId: 'IT1-030',
      testItem: 'ファイルアップロード（ローカル）',
      testPoint: 'ローカルモードでファイルが保存されること',
      precondition: 'STORAGE_MODE=local\nLOCAL_UPLOAD_BASE_PATH が設定済み',
      testSteps: '1. STORAGE_MODE=local でバッチ実行\n2. ローカルファイルシステムを確認',
      expectedResult: '・制御仕様/データフロー: {BASE_PATH}/uploads/test-cases/{testGroupId}/{tid}/{fileName}\n・エビデンス: {BASE_PATH}/evidences/{testGroupId}/{tid}/{fileName}\n・ディレクトリが自動作成される（recursive: true）',
    },
    // ---------- 結果出力 ----------
    {
      testId: 'IT1-031',
      testItem: '結果出力',
      testPoint: 'インポート結果JSONがS3に出力されること',
      precondition: 'インポートが正常に完了',
      testSteps: '1. バッチ実行完了\n2. S3の結果ファイルを確認',
      expectedResult: '・S3キー: test-case-import-results/result-{timestamp}.json\n・ImportSummary構造（totalTestCases, totalContents, successCount, results, startedAt, completedAt等）のJSONが出力される',
    },
    {
      testId: 'IT1-032',
      testItem: '結果出力',
      testPoint: 'インポート結果CSVがS3に出力されること',
      precondition: 'インポートが正常に完了',
      testSteps: '1. バッチ実行完了\n2. S3の結果ファイルを確認',
      expectedResult: '・S3キー: test-case-import-results/result-{timestamp}.csv\n・各TIDごとのインポート結果（row, tid, success, operation, errorMessage, contentCount）が出力される',
    },
    {
      testId: 'IT1-033',
      testItem: '結果出力',
      testPoint: 'tt_import_resultsが成功ステータスに更新されること',
      precondition: 'インポートが正常に完了',
      testSteps: '1. バッチ実行完了\n2. tt_import_resultsテーブルを確認',
      expectedResult: '・import_status=1（成功）に更新される\n・countに登録件数が設定される\n・messageに「N件のテストケースを正常にインポートしました（テスト内容: M件, ファイル: L件）」が設定される',
    },
    // ---------- ログ出力 ----------
    {
      testId: 'IT1-034',
      testItem: 'ログ出力',
      testPoint: '処理進捗のログが正しく出力されること',
      precondition: 'バッチ実行中',
      testSteps: '1. バッチを実行\n2. ログ出力を確認',
      expectedResult: '・各TIDの処理時に「[i/N] TID: xxx を処理中...」がログ出力される\n・完了時に「=== インポート完了 ===」がログ出力される\n・結果ファイルのS3パスが出力される',
    },
  ];

  addTestCasesWithMerge(it1Sheet, it1TestCases, 2);

  // ==================== IT2シート: データ検証・DB連携 ====================
  const it2Sheet = workbook.addWorksheet('IT2_データ検証DB連携');
  setupSheet(it2Sheet);

  const it2TestCases = [
    // ---------- TID重複チェック ----------
    {
      testId: 'IT2-001',
      testItem: 'TID重複チェック',
      testPoint: '既存TIDと重複しないテストケースが正常に登録されること',
      precondition: 'テストグループ内にTID「1-1-1-1」が未登録',
      testSteps: '1. TID=\"1-1-1-1\" のCSVでバッチ実行',
      expectedResult: '・重複チェックが成功する\n・テストケースが正常に登録される\n・operation=\"created\" が結果に設定される',
    },
    {
      testId: 'IT2-002',
      testItem: 'TID重複チェック',
      testPoint: '既存TIDとの重複がエラーになること',
      precondition: 'テストグループ内にTID「1-1-1-1」が既に登録済み',
      testSteps: '1. 既存TIDと同じTID=\"1-1-1-1\" のCSVでバッチ実行',
      expectedResult: '・「TID「1-1-1-1」は既に登録されています」エラーが発生する\n・トランザクション全体がロールバックされる',
    },
    {
      testId: 'IT2-003',
      testItem: 'TID重複チェック',
      testPoint: 'テストグループIDとTIDの複合キーで重複チェックが行われること',
      precondition: '別のテストグループにTID「1-1-1-1」が登録済み',
      testSteps: '1. 別テストグループの同TIDでバッチ実行',
      expectedResult: '・テストグループIDが異なるため重複チェックは成功する\n・テストケースが正常に登録される',
    },
    // ---------- DB登録データ整合性 ----------
    {
      testId: 'IT2-004',
      testItem: 'DB登録データ整合性',
      testPoint: 'テストケースとテスト内容のリレーションが正しいこと',
      precondition: 'TID「1-1-1-1」にNo=1,2,3 の3件のテスト内容がある',
      testSteps: '1. バッチ実行\n2. DBの各テーブルを確認',
      expectedResult: '・tt_test_cases: 1レコード（TID）\n・tt_test_contents: 3レコード（No毎）\n・tt_test_results: 3レコード（No毎）\n・tt_test_results_history: 3レコード（No毎、history_count=1）\n・全テーブルでtest_group_id, tidが一致',
    },
    {
      testId: 'IT2-005',
      testItem: 'DB登録データ整合性',
      testPoint: 'ファイルレコードのfile_noが正しい連番であること',
      precondition: '制御仕様2ファイル、データフロー1ファイルが参照されている',
      testSteps: '1. バッチ実行\n2. tt_test_case_filesを確認',
      expectedResult: '・制御仕様: file_no=1, file_no=2\n・データフロー: file_no=3\n・file_typeが正しく設定される（0=制御仕様, 1=データフロー）',
    },
    {
      testId: 'IT2-006',
      testItem: 'DB登録データ整合性',
      testPoint: 'エビデンスレコードのevidence_noが正しい連番であること',
      precondition: '1つのテスト内容にエビデンスが3ファイル参照されている',
      testSteps: '1. バッチ実行\n2. tt_test_evidencesを確認',
      expectedResult: '・evidence_no=1, 2, 3 の連番で登録される\n・history_count=1 固定\n・test_case_noが正しく設定される',
    },
    {
      testId: 'IT2-007',
      testItem: 'DB登録データ整合性',
      testPoint: 'NULL許容フィールドが正しく処理されること',
      precondition: 'result, software_version等が空文字のCSV行がある',
      testSteps: '1. 一部フィールドが空のCSVでバッチ実行\n2. DBの値を確認',
      expectedResult: '・空文字列のフィールドはnullとしてDBに登録される\n・result, software_version, hardware_version, comparator_version, executor, noteが対象',
    },
    {
      testId: 'IT2-008',
      testItem: 'DB登録データ整合性',
      testPoint: '日付文字列がDateオブジェクトに正しく変換されること',
      precondition: '実施日=\"2025/03/15\" のCSVデータ',
      testSteps: '1. バッチ実行\n2. tt_test_resultsのexecution_dateを確認',
      expectedResult: '・「2025/03/15」がDate(2025, 2, 15)に変換される\n・月は0始まりで処理される\n・DBにDate型として保存される',
    },
    // ---------- トランザクション管理 ----------
    {
      testId: 'IT2-009',
      testItem: 'トランザクション管理',
      testPoint: '全テストケースが1つのトランザクション内で処理されること',
      precondition: '5個のTIDを含むCSV',
      testSteps: '1. バッチ実行\n2. DB内容を確認',
      expectedResult: '・prisma.$transactionが使用される\n・全5件のTIDが正常に登録される\n・途中でエラーがなければ全件コミットされる',
    },
    {
      testId: 'IT2-010',
      testItem: 'トランザクション管理',
      testPoint: 'トランザクション途中でエラーが発生した場合に全件ロールバックされること',
      precondition: '3番目のTIDで重複エラーが発生する状況',
      testSteps: '1. 3番目のTIDが重複するCSVでバッチ実行\n2. DB内容を確認',
      expectedResult: '・エラーメッセージに行番号とTIDが含まれる\n・1番目、2番目のTIDも含め全件ロールバックされる\n・DBに一切のデータが残らない',
    },
    {
      testId: 'IT2-011',
      testItem: 'トランザクション管理',
      testPoint: 'トランザクションのタイムアウト設定が適切であること',
      precondition: '大量データ（100TID以上）のCSV',
      testSteps: '1. 大量データのCSVでバッチ実行',
      expectedResult: '・maxWait=60秒（接続待ち）\n・timeout=300秒（5分、トランザクション全体）\n・設定内で処理が完了する',
    },
    // ---------- S3連携 ----------
    {
      testId: 'IT2-012',
      testItem: 'S3連携',
      testPoint: 'S3からZIPファイルを読み込めること',
      precondition: 'INPUT_S3_BUCKET, INPUT_S3_KEY が正しく設定されている',
      testSteps: '1. バッチ実行',
      expectedResult: '・readZipFromS3関数が正しいバケット、キーで呼ばれる\n・ZIPのバイナリデータがBufferとして取得される',
    },
    {
      testId: 'IT2-013',
      testItem: 'S3連携',
      testPoint: '結果ファイルがS3に書き込まれること',
      precondition: 'OUTPUT_S3_BUCKET が設定されている',
      testSteps: '1. バッチ実行完了\n2. S3を確認',
      expectedResult: '・writeResultToS3でJSONファイルが書き込まれる\n・writeTestCaseImportResultCsvでCSVファイルが書き込まれる\n・タイムスタンプ付きのキーが使用される',
    },
    {
      testId: 'IT2-014',
      testItem: 'S3連携',
      testPoint: 'ファイルアップロードのS3パスが正しいこと',
      precondition: 'STORAGE_MODE=s3, FILE_S3_BUCKET が設定済み',
      testSteps: '1. バッチ実行\n2. S3のパスを確認',
      expectedResult: '・制御仕様/データフロー: uploads/test-cases/{groupId}/{tid}/{fileName}\n・エビデンス: evidences/{groupId}/{tid}/{fileName}\n・FILE_S3_BUCKETに保存される',
    },
    // ---------- インポート結果記録 ----------
    {
      testId: 'IT2-015',
      testItem: 'インポート結果記録',
      testPoint: '成功時にtt_import_resultsが正しく更新されること',
      precondition: 'インポートが正常に完了',
      testSteps: '1. バッチ実行完了\n2. tt_import_resultsを確認',
      expectedResult: '・import_status=1（成功）\n・countに登録テストケース数\n・messageに詳細情報（テストケース数、テスト内容数、ファイル数）',
    },
    {
      testId: 'IT2-016',
      testItem: 'インポート結果記録',
      testPoint: 'バリデーションエラー時にtt_import_resultsがエラーステータスに更新されること',
      precondition: 'CSVバリデーションでエラーが発生',
      testSteps: '1. 不正なCSVでバッチ実行\n2. tt_import_resultsを確認',
      expectedResult: '・import_status=2（エラー）\n・messageに「バリデーションエラーがN件発生したため実行されませんでした」と詳細',
    },
    {
      testId: 'IT2-017',
      testItem: 'インポート結果記録',
      testPoint: 'ファイル存在エラー時にtt_import_resultsがエラーステータスに更新されること',
      precondition: 'CSV内の参照ファイルがZIP内に存在しない',
      testSteps: '1. 不足ファイルのZIPでバッチ実行\n2. tt_import_resultsを確認',
      expectedResult: '・import_status=2（エラー）\n・messageに「ファイル存在エラーがN件発生したため実行されませんでした」と詳細',
    },
    // ---------- ImportSummary構造 ----------
    {
      testId: 'IT2-018',
      testItem: 'ImportSummary構造',
      testPoint: 'サマリ情報が正しく計算されること',
      precondition: '3TID（No合計8件）、ファイル5個のCSV',
      testSteps: '1. バッチ実行完了\n2. 結果JSONを確認',
      expectedResult: '・totalTestCases=3\n・totalContents=8\n・successCount=3\n・errorCount=0\n・createdTestCases=3\n・createdContents=8\n・uploadedFiles=5\n・startedAt, completedAtが正しいISO形式',
    },
  ];

  addTestCasesWithMerge(it2Sheet, it2TestCases, 2);

  // ==================== 異常系シート ====================
  const errorSheet = workbook.addWorksheet('異常系テスト');
  setupSheet(errorSheet);

  const errorTestCases = [
    // ---------- 環境変数エラー ----------
    {
      testId: 'ERR-001',
      testItem: '環境変数エラー',
      testPoint: '必須環境変数が未設定の場合にエラーになること',
      precondition: 'INPUT_S3_BUCKET が未設定',
      testSteps: '1. INPUT_S3_BUCKET を未設定にしてバッチ実行',
      expectedResult: '・「必須の環境変数が設定されていません: INPUT_S3_BUCKET」エラーがスローされる\n・バッチがexit(1)で終了する',
    },
    {
      testId: 'ERR-002',
      testItem: '環境変数エラー',
      testPoint: '複数の必須環境変数が未設定の場合にまとめてエラー表示されること',
      precondition: 'INPUT_S3_BUCKET, DATABASE_URL が未設定',
      testSteps: '1. 複数の環境変数を未設定にしてバッチ実行',
      expectedResult: '・「必須の環境変数が設定されていません: INPUT_S3_BUCKET, DATABASE_URL」エラーがスローされる\n・未設定の変数名がカンマ区切りで列挙される',
    },
    {
      testId: 'ERR-003',
      testItem: '環境変数エラー',
      testPoint: 'TEST_GROUP_IDが不正な値の場合にエラーになること',
      precondition: 'TEST_GROUP_ID=abc（文字列）',
      testSteps: '1. TEST_GROUP_ID に非数値を設定してバッチ実行',
      expectedResult: '・「TEST_GROUP_IDは正の整数である必要があります」エラーがスローされる',
    },
    {
      testId: 'ERR-004',
      testItem: '環境変数エラー',
      testPoint: 'TEST_GROUP_IDが0以下の場合にエラーになること',
      precondition: 'TEST_GROUP_ID=0 または TEST_GROUP_ID=-1',
      testSteps: '1. TEST_GROUP_ID に0以下の値を設定してバッチ実行',
      expectedResult: '・「TEST_GROUP_IDは正の整数である必要があります」エラーがスローされる',
    },
    {
      testId: 'ERR-005',
      testItem: '環境変数エラー',
      testPoint: 'S3モードでFILE_S3_BUCKETが未設定の場合にエラーになること',
      precondition: 'STORAGE_MODE=s3, FILE_S3_BUCKET が未設定',
      testSteps: '1. FILE_S3_BUCKET を未設定にしてバッチ実行',
      expectedResult: '・「S3モードで必須の環境変数が設定されていません: FILE_S3_BUCKET」エラーがスローされる',
    },
    // ---------- テストグループエラー ----------
    {
      testId: 'ERR-006',
      testItem: 'テストグループエラー',
      testPoint: '指定テストグループが存在しない場合にエラーになること',
      precondition: 'TEST_GROUP_ID=99999（存在しないID）',
      testSteps: '1. 存在しないテストグループIDでバッチ実行',
      expectedResult: '・「テストグループID 99999 が見つかりません」エラーがスローされる\n・tt_import_resultsにエラーが記録される',
    },
    {
      testId: 'ERR-007',
      testItem: 'テストグループエラー',
      testPoint: '論理削除されたテストグループの場合にエラーになること',
      precondition: 'TEST_GROUP_IDのテストグループが is_deleted=true',
      testSteps: '1. 論理削除済みのテストグループIDでバッチ実行',
      expectedResult: '・テストグループが見つからないエラーが発生する\n・findUniqueのwhere条件にis_deleted: falseが含まれる',
    },
    // ---------- ZIPファイルエラー ----------
    {
      testId: 'ERR-008',
      testItem: 'ZIPファイルエラー',
      testPoint: 'ZIP内にCSVファイルがない場合にエラーになること',
      precondition: 'CSVを含まないZIPファイルがS3にアップロード済み',
      testSteps: '1. CSVなしのZIPでバッチ実行',
      expectedResult: '・「ZIPファイル内にCSVファイルが見つかりません。」エラーがスローされる',
    },
    {
      testId: 'ERR-009',
      testItem: 'ZIPファイルエラー',
      testPoint: 'ZIP内にCSVファイルが複数ある場合にエラーになること',
      precondition: 'CSVが2ファイル以上含まれるZIPがS3にアップロード済み',
      testSteps: '1. CSV2ファイルのZIPでバッチ実行',
      expectedResult: '・「ZIPファイル内にCSVファイルが複数含まれています。CSVファイルは1つだけにしてください。」エラーがスローされる',
    },
    {
      testId: 'ERR-010',
      testItem: 'ZIPファイルエラー',
      testPoint: 'CSVにデータ行がない場合にエラーになること',
      precondition: 'ヘッダーのみのCSVを含むZIP',
      testSteps: '1. 空CSVのZIPでバッチ実行',
      expectedResult: '・「CSVにデータが含まれていません」エラーがスローされる',
    },
    // ---------- バリデーションエラー ----------
    {
      testId: 'ERR-011',
      testItem: 'バリデーションエラー',
      testPoint: 'TID形式が不正な場合にエラーになること',
      precondition: 'TID=\"abc\" のデータが含まれるCSV',
      testSteps: '1. 不正なTIDのCSVでバッチ実行',
      expectedResult: '・「N行目: TIDは半角ハイフンつながりの半角数字である必要があります（例: 1-1-1-1）」エラー\n・全件ロールバック\n・S3に結果JSONが出力される',
    },
    {
      testId: 'ERR-012',
      testItem: 'バリデーションエラー',
      testPoint: '必須項目が空の場合にエラーになること',
      precondition: '第1層が空のデータが含まれるCSV',
      testSteps: '1. 第1層が空のCSVでバッチ実行',
      expectedResult: '・「N行目: 第1層は必須です」エラー\n・バリデーションエラーとしてまとめて報告される',
    },
    {
      testId: 'ERR-013',
      testItem: 'バリデーションエラー',
      testPoint: '文字数が255文字を超える場合にエラーになること',
      precondition: '第1層に256文字以上の値があるCSV',
      testSteps: '1. 255文字超のデータでバッチ実行',
      expectedResult: '・「N行目: 第1層は255文字以内である必要があります」エラー',
    },
    {
      testId: 'ERR-014',
      testItem: 'バリデーションエラー',
      testPoint: '判定値が無効な場合にエラーになること',
      precondition: '判定=\"不正な値\" のデータが含まれるCSV',
      testSteps: '1. 無効な判定値のCSVでバッチ実行',
      expectedResult: '・「N行目: 判定は「未着手、保留、QA中、OK、参照OK、NG、再実施対象外、対象外」のいずれかである必要があります」エラー',
    },
    {
      testId: 'ERR-015',
      testItem: 'バリデーションエラー',
      testPoint: '実施日の形式が不正な場合にエラーになること',
      precondition: '実施日=\"2025-01-15」（ハイフン区切り）のCSV',
      testSteps: '1. 不正な日付形式のCSVでバッチ実行',
      expectedResult: '・「N行目: 実施日はyyyy/mm/dd形式である必要があります（例: 2025/01/01）」エラー',
    },
    {
      testId: 'ERR-016',
      testItem: 'バリデーションエラー',
      testPoint: 'Noが正の整数でない場合にエラーになること',
      precondition: 'No=\"abc\" のデータが含まれるCSV',
      testSteps: '1. 不正なNoのCSVでバッチ実行',
      expectedResult: '・「N行目: Noは正の整数である必要があります」エラー',
    },
    {
      testId: 'ERR-017',
      testItem: 'バリデーションエラー',
      testPoint: '複数行でバリデーションエラーがある場合にすべてのエラーが報告されること',
      precondition: '2行目と5行目にバリデーションエラーがあるCSV',
      testSteps: '1. 複数エラーのCSVでバッチ実行',
      expectedResult: '・全行のバリデーションが実行される\n・全エラーがまとめてmessageに記録される\n・「バリデーションエラーがN件発生したため実行されませんでした」メッセージ',
    },
    // ---------- ファイル存在エラー ----------
    {
      testId: 'ERR-018',
      testItem: 'ファイル存在エラー',
      testPoint: '制御仕様ファイルがZIP内にない場合にエラーになること',
      precondition: 'CSV内の制御仕様に参照されるファイルがZIP内に不在',
      testSteps: '1. 不足ファイルのZIPでバッチ実行',
      expectedResult: '・「ファイル存在エラーがN件発生したため実行されませんでした」エラー\n・不足ファイル名がエラーメッセージに含まれる',
    },
    {
      testId: 'ERR-019',
      testItem: 'ファイル存在エラー',
      testPoint: 'データフローファイルがZIP内にない場合にエラーになること',
      precondition: 'CSV内のデータフローに参照されるファイルがZIP内に不在',
      testSteps: '1. 不足ファイルのZIPでバッチ実行',
      expectedResult: '・「データフローファイル「xxx」がZIP内に見つかりません」エラー',
    },
    {
      testId: 'ERR-020',
      testItem: 'ファイル存在エラー',
      testPoint: 'エビデンスファイルがZIP内にない場合にエラーになること',
      precondition: 'CSV内のエビデンスに参照されるファイルがZIP内に不在',
      testSteps: '1. 不足ファイルのZIPでバッチ実行',
      expectedResult: '・「エビデンスファイル「xxx」がZIP内に見つかりません」エラー\n・トランザクション全体がロールバックされる',
    },
    // ---------- DB接続エラー ----------
    {
      testId: 'ERR-021',
      testItem: 'DB接続エラー',
      testPoint: 'データベース接続が失敗した場合にエラーになること',
      precondition: 'DATABASE_URLが無効な値',
      testSteps: '1. 無効なDATABASE_URLでバッチ実行',
      expectedResult: '・接続エラーがキャッチされる\n・tt_import_resultsにエラーが記録される（可能な場合）\n・バッチがexit(1)で終了する',
    },
    {
      testId: 'ERR-022',
      testItem: 'DB接続エラー',
      testPoint: 'トランザクションタイムアウトの場合にエラーになること',
      precondition: 'トランザクション処理が5分以上かかる状況',
      testSteps: '1. 大量データでバッチ実行し、タイムアウトさせる',
      expectedResult: '・トランザクションタイムアウトエラーが発生する\n・全件ロールバックされる\n・tt_import_resultsにエラーが記録される\n・バッチがexit(1)で終了する',
    },
    // ---------- S3エラー ----------
    {
      testId: 'ERR-023',
      testItem: 'S3エラー',
      testPoint: 'S3からZIP読み込みが失敗した場合にエラーになること',
      precondition: 'S3のキーが存在しないまたはアクセス権限がない',
      testSteps: '1. 不正なS3キーでバッチ実行',
      expectedResult: '・S3読み込みエラーがキャッチされる\n・tt_import_resultsにエラーが記録される\n・バッチがexit(1)で終了する',
    },
    {
      testId: 'ERR-024',
      testItem: 'S3エラー',
      testPoint: 'ファイルアップロードが失敗した場合にエラーになること',
      precondition: 'FILE_S3_BUCKETへの書き込み権限がない',
      testSteps: '1. 書き込み権限のないバケットでバッチ実行',
      expectedResult: '・アップロードエラーがキャッチされる\n・トランザクション全体がロールバックされる\n・tt_import_resultsにエラーが記録される',
    },
    // ---------- エラー記録の失敗 ----------
    {
      testId: 'ERR-025',
      testItem: 'エラー記録の失敗',
      testPoint: 'インポートレコード作成前のエラーでもtt_import_resultsに記録されること',
      precondition: '環境変数検証前にエラーが発生する状況',
      testSteps: '1. importResultId が null の状態でエラー発生',
      expectedResult: '・tt_import_resultsに新規レコードがcreateされる（importResultIdがnullの場合）\n・file_nameに「unknown」が設定される\n・import_status=2, import_type=1',
    },
    {
      testId: 'ERR-026',
      testItem: 'エラー記録の失敗',
      testPoint: 'エラー記録自体の保存が失敗した場合にハンドリングされること',
      precondition: 'DB完全障害',
      testSteps: '1. DB接続不可の状態でバッチ実行',
      expectedResult: '・「エラー記録の保存に失敗しました」がログ出力される\n・バッチがexit(1)で終了する\n・例外が握り潰されない',
    },
    // ---------- クリーンアップ ----------
    {
      testId: 'ERR-027',
      testItem: 'クリーンアップ',
      testPoint: 'バッチ終了時にDB接続がクローズされること',
      precondition: 'バッチ実行完了（正常・異常問わず）',
      testSteps: '1. バッチを実行して完了させる\n2. DB接続状態を確認',
      expectedResult: '・finallyブロックでprisma.$disconnect()が呼ばれる\n・正常終了でもエラー終了でも接続がクローズされる',
    },
  ];

  addTestCasesWithMerge(errorSheet, errorTestCases, 2);

  // ==================== テスト概要シート ====================
  const summarySheet = workbook.addWorksheet('テスト概要');
  summarySheet.columns = [
    { key: 'item', width: 30 },
    { key: 'value', width: 75 },
  ];

  // タイトル行（セル結合）
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'テストケースインポートバッチ 結合テスト仕様書（IT1/IT2）';
  titleCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  summarySheet.getRow(1).height = 35;

  const summaryData = [
    { item: 'テスト対象', value: 'テストケースインポートバッチ (test-case-import.ts)' },
    { item: 'ファイルパス', value: 'batch/src/test-case-import.ts' },
    {
      item: '関連ファイル',
      value:
        'batch/src/utils/test-case-csv-parser.ts\nbatch/src/utils/zip-handler.ts\nbatch/src/utils/s3-client.ts\nbatch/src/types/test-case-import.types.ts',
    },
    { item: 'テスト観点', value: 'IT1: 正常系処理、IT2: データ検証/DB連携、異常系テスト' },
    { item: '', value: '' },
    { item: 'IT1テストケース数', value: `${it1TestCases.length}件` },
    { item: 'IT2テストケース数', value: `${it2TestCases.length}件` },
    { item: '異常系テストケース数', value: `${errorTestCases.length}件` },
    {
      item: '合計テストケース数',
      value: `${it1TestCases.length + it2TestCases.length + errorTestCases.length}件`,
    },
    { item: '', value: '' },
    {
      item: '処理概要',
      value:
        '1. 環境変数検証\n2. テストグループ存在確認\n3. インポート結果レコード作成（実施中）\n4. S3からZIPファイル読み込み\n5. ZIP解凍（CSV + 添付ファイル抽出）\n6. CSVパース（日本語ヘッダー対応）\n7. 全行バリデーション\n8. TIDごとにグループ化\n9. 参照ファイル存在確認\n10. トランザクション内でDB登録（テストケース/テスト内容/テスト結果/履歴/エビデンス）\n11. ファイルアップロード（S3 or ローカル）\n12. 結果出力（JSON/CSV）\n13. インポート結果レコード更新（成功/エラー）',
    },
    { item: '', value: '' },
    {
      item: 'CSVフォーマット（23列）',
      value:
        'TID, No, 第1層, 第2層, 第3層, 第4層, 目的, 要求ID, 確認観点, 制御仕様, データフロー, テスト手順, テストケース, 期待値, 結果, 判定, 実施日, ソフトVer., ハードVer., コンパラVer., 実施者, エビデンス, 備考',
    },
    {
      item: '判定値（Judgment enum）',
      value: '未着手, 保留, QA中, OK, 参照OK, NG, 再実施対象外, 対象外',
    },
    {
      item: 'ストレージモード',
      value: 'S3モード（STORAGE_MODE=s3）: AWS S3に保存\nローカルモード（STORAGE_MODE=local）: ローカルファイルシステムに保存',
    },
    { item: '', value: '' },
    {
      item: 'IT1観点の詳細',
      value:
        '・環境変数検証（必須項目、TEST_GROUP_ID形式、S3モード設定）\n・テストグループ存在確認\n・インポート結果記録（開始時のレコード作成）\n・ZIP読み込み/解凍（S3読み込み、CSVとファイル抽出、パス正規化）\n・CSVパース（23列、日本語ヘッダーマッピング）\n・バリデーション（TID形式、判定値、日付形式、必須項目、文字数制限）\n・ファイル存在確認（セミコロン区切り解析）\n・TIDグループ化（共通情報取得、is_target判定）\n・テストケース登録（5テーブル連携、トランザクション）\n・ファイルアップロード（S3/ローカル、パス構造）\n・結果出力（JSON/CSV、DB更新）\n・ログ出力',
    },
    {
      item: 'IT2観点の詳細',
      value:
        '・TID重複チェック（同一グループ内、別グループ間）\n・DB登録データ整合性（リレーション、file_no連番、evidence_no連番、NULL許容、日付変換）\n・トランザクション管理（一括処理、ロールバック、タイムアウト）\n・S3連携（読み込み、書き込み、パス構造）\n・インポート結果記録（成功/バリデーションエラー/ファイルエラー）\n・ImportSummary構造',
    },
    {
      item: '異常系観点の詳細',
      value:
        '・環境変数エラー（未設定、不正値、S3モード固有）\n・テストグループエラー（不存在、論理削除済み）\n・ZIPファイルエラー（CSVなし、CSV複数、空データ）\n・バリデーションエラー（TID形式、必須項目、文字数、判定値、日付形式、No形式、複数行エラー）\n・ファイル存在エラー（制御仕様、データフロー、エビデンス）\n・DB接続エラー（接続失敗、タイムアウト）\n・S3エラー（読み込み失敗、アップロード失敗）\n・エラー記録の失敗（レコード作成前エラー、記録保存失敗）\n・クリーンアップ（DB接続クローズ）',
    },
  ];

  summaryData.forEach((data) => {
    const row = summarySheet.addRow(data);
    if (data.item === '') {
      row.height = 10;
    } else {
      const lineCount = data.value.split('\n').length;
      row.height = lineCount > 5 ? 160 : lineCount > 3 ? 100 : 40;
      row.getCell('item').style = {
        font: { bold: true },
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        },
      };
      row.getCell('value').style = {
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        },
      };
    }
  });

  // シートの並び順を設定（テスト概要を先頭に）
  const worksheets = workbook.worksheets;
  worksheets[0].orderNo = 1;
  worksheets[1].orderNo = 2;
  worksheets[2].orderNo = 3;
  worksheets[3].orderNo = 0;

  // ファイル保存
  const fileName = 'docs/IT1_IT2_試験項目書_テストケースインポートバッチ.xlsx';
  await workbook.xlsx.writeFile(fileName);
  console.log(`テスト仕様書を生成しました: ${fileName}`);
  console.log(`テストケース合計: ${it1TestCases.length + it2TestCases.length + errorTestCases.length}件`);
  console.log(`  - IT1（正常系処理）: ${it1TestCases.length}件`);
  console.log(`  - IT2（データ検証/DB連携）: ${it2TestCases.length}件`);
  console.log(`  - 異常系テスト: ${errorTestCases.length}件`);
}

generateTestImportBatchSpec().catch(console.error);
