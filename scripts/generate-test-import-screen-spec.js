const ExcelJS = require('exceljs');

/**
 * テストケースインポート画面 結合テスト仕様書 生成スクリプト
 *
 * セル結合対応：テスト項目が同一のテストケースはテスト項目列を結合する
 */
async function generateTestImportScreenSpec() {
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

  const categoryHeaderStyle = {
    font: { bold: true, size: 10 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
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
      { key: 'testItem', width: 22 },
      { key: 'testPoint', width: 30 },
      { key: 'precondition', width: 30 },
      { key: 'testSteps', width: 42 },
      { key: 'expectedResult', width: 42 },
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

  // ==================== IT1シート ====================
  const it1Sheet = workbook.addWorksheet('IT1_画面表示UI操作');
  setupSheet(it1Sheet);

  const it1TestCases = [
    // ---------- 初期表示 ----------
    {
      testId: 'IT1-001',
      testItem: '初期表示',
      testPoint: '画面タイトルが正しく表示されること',
      precondition: 'テスト管理者または管理者でログイン済み\nテストグループが存在する',
      testSteps: '1. テストケース一覧画面からインポートボタンをクリック\n2. テストインポート実施画面が表示される',
      expectedResult: '・画面タイトル「テストインポート実施」が表示される',
    },
    {
      testId: 'IT1-002',
      testItem: '初期表示',
      testPoint: 'ファイルアップロード欄が表示されること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. ファイル選択エリアを確認する',
      expectedResult: '・「テストファイル（zip形式）」ラベルが表示される\n・ファイル選択のinput（type=file）が表示される',
    },
    {
      testId: 'IT1-003',
      testItem: '初期表示',
      testPoint: 'ボタン群が正しく表示されること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. 画面下部のボタン群を確認する',
      expectedResult: '・「インポート」ボタンが表示される\n・「戻る」ボタンが表示される',
    },
    {
      testId: 'IT1-004',
      testItem: '初期表示',
      testPoint: 'テストグループ情報モーダルボタンが表示されること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. 画面上部のタイトル横を確認する',
      expectedResult: '・テストグループ情報モーダルボタン（TestGroupInfoTableModal）が表示される',
    },
    // ---------- ファイル選択操作 ----------
    {
      testId: 'IT1-005',
      testItem: 'ファイル選択操作',
      testPoint: 'ZIPファイルを選択できること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. ファイル選択ボタンをクリック\n2. 正常なZIPファイルを選択する',
      expectedResult: '・ファイルが選択される\n・選択したファイル名が表示される\n・PapaParseによるCSVパースが実行される',
    },
    {
      testId: 'IT1-006',
      testItem: 'ファイル選択操作',
      testPoint: 'CSVの内容がShift-JISエンコーディングで正しく読み込まれること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. Shift-JISエンコーディングのCSVを含むZIPファイルを選択する',
      expectedResult: '・CSVデータがShift-JISで正しくパースされる\n・日本語文字が文字化けしない\n・csvContent状態にデータが格納される',
    },
    {
      testId: 'IT1-007',
      testItem: 'ファイル選択操作',
      testPoint: 'ファイル選択をキャンセルした場合の動作',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. ファイル選択ダイアログを開く\n2. キャンセルをクリック',
      expectedResult: '・ファイルは選択されない\n・csvContentは空のまま\n・エラーは発生しない',
    },
    {
      testId: 'IT1-008',
      testItem: 'ファイル選択操作',
      testPoint: 'ファイルを再選択できること',
      precondition: 'すでにファイルが選択されている状態',
      testSteps: '1. ファイル選択ボタンを再度クリック\n2. 別のZIPファイルを選択する',
      expectedResult: '・新しいファイルが選択される\n・csvContentが新しいファイルのデータで更新される',
    },
    // ---------- インポートボタン ----------
    {
      testId: 'IT1-009',
      testItem: 'インポートボタン',
      testPoint: 'CSVデータ読み込み済みの状態でインポート実行できること',
      precondition: 'ZIPファイルを選択しCSVデータが読み込まれた状態',
      testSteps: '1. インポートボタンをクリック',
      expectedResult: '・インポート処理が実行される\n・/importResult画面に遷移する',
    },
    {
      testId: 'IT1-010',
      testItem: 'インポートボタン',
      testPoint: 'CSVデータ未読み込みの場合はインポート実行されないこと',
      precondition: 'ファイルが未選択の状態',
      testSteps: '1. ファイルを選択せずにインポートボタンをクリック',
      expectedResult: '・インポート処理は実行されない\n・画面遷移は行われない\n・コンソールに「CSVファイルの内容が読み込まれていません」が出力される',
    },
    // ---------- 戻るボタン ----------
    {
      testId: 'IT1-011',
      testItem: '戻るボタン',
      testPoint: '戻るボタンで前の画面に戻れること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. 戻るボタンをクリック',
      expectedResult: '・前の画面（テストケース一覧画面）に戻る\n・history.back()が呼び出される',
    },
    {
      testId: 'IT1-012',
      testItem: '戻るボタン',
      testPoint: 'ファイル選択後に戻るボタンをクリックした場合',
      precondition: 'ZIPファイルを選択済みの状態',
      testSteps: '1. ZIPファイルを選択する\n2. 戻るボタンをクリック',
      expectedResult: '・確認なしで前の画面に戻る\n・選択したファイル情報は破棄される',
    },
    // ---------- テストグループ情報モーダル ----------
    {
      testId: 'IT1-013',
      testItem: 'テストグループ情報モーダル',
      testPoint: 'テストグループ情報モーダルを開けること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. テストグループ情報モーダルボタンをクリック',
      expectedResult: '・テストグループの詳細情報がモーダルで表示される',
    },
    {
      testId: 'IT1-014',
      testItem: 'テストグループ情報モーダル',
      testPoint: 'テストグループ情報モーダルを閉じれること',
      precondition: 'テストグループ情報モーダルが表示されている',
      testSteps: '1. モーダルの閉じるボタンをクリック',
      expectedResult: '・モーダルが閉じる\n・テストインポート実施画面に戻る',
    },
    // ---------- URLパラメータ ----------
    {
      testId: 'IT1-015',
      testItem: 'URLパラメータ',
      testPoint: 'typeパラメータがURL経由で取得できること',
      precondition: 'URL に ?type=xxx パラメータが付与されている',
      testSteps: '1. ?type=test を付与してテストインポート実施画面にアクセス',
      expectedResult: '・searchParamsからtypeが取得できる\n・画面が正常に表示される',
    },
    // ---------- レイアウト ----------
    {
      testId: 'IT1-016',
      testItem: 'レイアウト',
      testPoint: 'フォームのレイアウトが縦型であること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. 画面全体のレイアウトを確認する',
      expectedResult: '・VerticalFormコンポーネントが使用されている\n・フォームが縦方向に配置されている\n・ボタンがフォームの下部に表示される',
    },
  ];

  addTestCasesWithMerge(it1Sheet, it1TestCases, 2);

  // ==================== IT2シート ====================
  const it2Sheet = workbook.addWorksheet('IT2_API連携と画面遷移');
  setupSheet(it2Sheet);

  const it2TestCases = [
    // ---------- プリサインドURL取得API ----------
    {
      testId: 'IT2-001',
      testItem: 'プリサインドURL取得API',
      testPoint: 'ZIPファイルアップロード用のプリサインドURLを取得できること',
      precondition: '管理者権限でログイン済み\nS3バケットが設定済み',
      testSteps: '1. テストインポート実施画面でファイルを選択\n2. POST /api/batch/upload-url にリクエストが送信されることを確認',
      expectedResult: '・APIが正常に呼び出される\n・レスポンスにuploadUrl, key, bucket, expiresInが含まれる\n・expiresInは900秒（15分）',
    },
    {
      testId: 'IT2-002',
      testItem: 'プリサインドURL取得API',
      testPoint: 'ファイル名がサニタイズされること',
      precondition: '管理者権限でログイン済み',
      testSteps: '1. 日本語名や特殊文字を含むファイル名のZIPを選択\n2. APIリクエストを確認',
      expectedResult: '・ファイル名の特殊文字がアンダースコアに置換される\n・S3キーが「test-import/{timestamp}_{sanitizedFileName}」形式で生成される',
    },
    {
      testId: 'IT2-003',
      testItem: 'プリサインドURL取得API',
      testPoint: '権限チェックが行われること',
      precondition: '一般ユーザーでログイン済み',
      testSteps: '1. POST /api/batch/upload-url にリクエストを送信',
      expectedResult: '・403 Forbiddenエラーが返される\n・システム管理者以外はアクセスできない',
    },
    // ---------- S3アップロード ----------
    {
      testId: 'IT2-004',
      testItem: 'S3アップロード',
      testPoint: 'プリサインドURLを使用してZIPファイルをS3にアップロードできること',
      precondition: 'プリサインドURLが取得済み',
      testSteps: '1. 取得したプリサインドURLにZIPファイルをPUT\n2. S3に正常にアップロードされることを確認',
      expectedResult: '・S3にZIPファイルがアップロードされる\n・アップロードされたファイルのS3キーが正しい',
    },
    // ---------- バッチジョブ起動 ----------
    {
      testId: 'IT2-005',
      testItem: 'バッチジョブ起動',
      testPoint: 'AWS Batchジョブが正常に起動されること',
      precondition: 'ZIPファイルがS3にアップロード済み\n管理者権限でログイン済み',
      testSteps: '1. インポートボタンをクリック\n2. バッチジョブの起動を確認',
      expectedResult: '・AWS Batchジョブが起動される\n・環境変数（INPUT_S3_BUCKET, INPUT_S3_KEY, TEST_GROUP_ID等）が正しく設定される\n・jobIdが返される',
    },
    {
      testId: 'IT2-006',
      testItem: 'バッチジョブ起動',
      testPoint: 'バッチジョブのステータスを確認できること',
      precondition: 'バッチジョブが起動済み',
      testSteps: '1. GET /api/batch/status/{jobId} にリクエストを送信\n2. レスポンスを確認',
      expectedResult: '・ジョブのステータス（SUBMITTED/PENDING/RUNNABLE/STARTING/RUNNING/SUCCEEDED/FAILED）が返される\n・タイミング情報が含まれる',
    },
    // ---------- 画面遷移 ----------
    {
      testId: 'IT2-007',
      testItem: '画面遷移',
      testPoint: 'インポート実行後にインポート結果一覧画面に遷移すること',
      precondition: 'CSVデータが読み込まれた状態',
      testSteps: '1. インポートボタンをクリック',
      expectedResult: '・router.push(\'/importResult\')が呼び出される\n・インポート結果一覧画面に遷移する',
    },
    {
      testId: 'IT2-008',
      testItem: '画面遷移',
      testPoint: '戻るボタンで前画面に遷移すること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. 戻るボタンをクリック',
      expectedResult: '・history.back()が呼び出される\n・テストケース一覧画面に戻る',
    },
    {
      testId: 'IT2-009',
      testItem: '画面遷移',
      testPoint: 'テストケース一覧画面から正しいURLで遷移できること',
      precondition: 'テストケース一覧画面を表示中',
      testSteps: '1. テストケース一覧画面のインポートボタンをクリック',
      expectedResult: '・/testGroup/{groupId}/testCase/testImportExecute に遷移する\n・groupIdがURLに正しく含まれる',
    },
    // ---------- インポート結果一覧表示 ----------
    {
      testId: 'IT2-010',
      testItem: 'インポート結果一覧表示',
      testPoint: 'インポート結果一覧がAPI経由で取得できること',
      precondition: 'インポート結果が1件以上存在する',
      testSteps: '1. インポート結果一覧画面にアクセス\n2. GET /api/import-results が呼ばれることを確認',
      expectedResult: '・APIが正常に呼び出される\n・レスポンスにdata配列とtotalCountが含まれる\n・各結果にfile_name, import_type, created_at, import_status, executor_nameが含まれる',
    },
    {
      testId: 'IT2-011',
      testItem: 'インポート結果一覧表示',
      testPoint: 'ステータスが正しく表示されること',
      precondition: 'インポート結果が存在する',
      testSteps: '1. インポート結果一覧画面を確認',
      expectedResult: '・import_status=0: 実施中\n・import_status=1: 完了\n・import_status=2: エラー\n・日時がJST形式でフォーマットされる',
    },
    {
      testId: 'IT2-012',
      testItem: 'インポート結果一覧表示',
      testPoint: 'インポート種別が正しく表示されること',
      precondition: 'ユーザーインポートとテストケースインポートの結果が存在する',
      testSteps: '1. インポート結果一覧画面を確認',
      expectedResult: '・import_type=0: ユーザーインポート\n・import_type=1: テストケースインポート',
    },
    {
      testId: 'IT2-013',
      testItem: 'インポート結果一覧表示',
      testPoint: 'ページネーションが正しく動作すること',
      precondition: 'インポート結果が11件以上存在する',
      testSteps: '1. インポート結果一覧画面にアクセス\n2. 次ページボタンをクリック',
      expectedResult: '・1ページ10件で表示される\n・ページ遷移が正常に動作する\n・URLパラメータにpageが付与される',
    },
    {
      testId: 'IT2-014',
      testItem: 'インポート結果一覧表示',
      testPoint: 'ソート機能が正しく動作すること',
      precondition: 'インポート結果が複数件存在する',
      testSteps: '1. 各カラムのヘッダーをクリック',
      expectedResult: '・クリックしたカラムで昇順ソートされる\n・再度クリックで降順に切り替わる\n・ソートインジケータが表示される',
    },
    // ---------- インポート結果詳細 ----------
    {
      testId: 'IT2-015',
      testItem: 'インポート結果詳細',
      testPoint: '確認ボタンでインポート結果詳細画面に遷移すること',
      precondition: 'インポート結果一覧画面を表示中',
      testSteps: '1. 任意のインポート結果の確認ボタンをクリック',
      expectedResult: '・/importResult/importInfo/{id} に遷移する\n・該当するインポート結果の詳細が表示される',
    },
    {
      testId: 'IT2-016',
      testItem: 'インポート結果詳細',
      testPoint: 'インポート結果の詳細情報が正しく表示されること',
      precondition: 'インポート結果詳細画面にアクセス済み',
      testSteps: '1. 詳細画面の表示内容を確認',
      expectedResult: '・ファイル名、件数、インポート日時、ステータス、実施者が表示される\n・エラーの場合はエラー詳細が表示される\n・戻るボタンが表示される',
    },
    // ---------- ログ出力 ----------
    {
      testId: 'IT2-017',
      testItem: 'ログ出力',
      testPoint: '各操作でログが出力されること',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. ファイルを選択\n2. インポートボタンをクリック\n3. 戻るボタンをクリック\n4. コンソールログを確認',
      expectedResult: '・ファイル選択時: ファイル情報がコンソールに出力される\n・インポート実行時: 「インポートされました」が出力される\n・キャンセル時: 「キャンセルされました」が出力される',
    },
  ];

  addTestCasesWithMerge(it2Sheet, it2TestCases, 2);

  // ==================== 異常系シート ====================
  const errorSheet = workbook.addWorksheet('異常系テスト');
  setupSheet(errorSheet);

  const errorTestCases = [
    // ---------- ファイル選択エラー ----------
    {
      testId: 'ERR-001',
      testItem: 'ファイル選択エラー',
      testPoint: 'ZIP以外のファイルが選択された場合の動作',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. Excel(.xlsx)ファイルを選択する',
      expectedResult: '・PapaParseによるパースが実行されるが正常なCSVデータが取得できない\n・csvContentが空または不正なデータになる\n・システムエラーは発生しない',
    },
    {
      testId: 'ERR-002',
      testItem: 'ファイル選択エラー',
      testPoint: '空のZIPファイルが選択された場合の動作',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. CSVを含まない空のZIPファイルを選択する',
      expectedResult: '・PapaParseのパース結果が空になる\n・csvContentが空配列になる\n・インポートボタンクリック時に「CSVファイルの内容が読み込まれていません」が出力される',
    },
    {
      testId: 'ERR-003',
      testItem: 'ファイル選択エラー',
      testPoint: '大容量ファイルが選択された場合の動作',
      precondition: 'テストインポート実施画面にアクセス済み',
      testSteps: '1. 非常に大きなZIPファイル（100MB以上）を選択する',
      expectedResult: '・ブラウザのメモリ制限内で処理される\n・必要に応じてエラーハンドリングされる',
    },
    // ---------- API通信エラー ----------
    {
      testId: 'ERR-004',
      testItem: 'API通信エラー',
      testPoint: 'プリサインドURL取得APIがエラーを返した場合',
      precondition: 'APIがエラーを返す状態',
      testSteps: '1. ファイルを選択\n2. インポートボタンをクリック\n3. APIがエラーを返す',
      expectedResult: '・エラーが適切にハンドリングされる\n・ユーザーにエラーが通知される\n・画面遷移は行われない',
    },
    {
      testId: 'ERR-005',
      testItem: 'API通信エラー',
      testPoint: 'S3アップロードが失敗した場合',
      precondition: 'プリサインドURLは取得済み\nS3へのアップロードがタイムアウト',
      testSteps: '1. ファイルを選択\n2. インポートを実行\n3. S3アップロードが失敗',
      expectedResult: '・エラーが適切にハンドリングされる\n・ユーザーにエラーが通知される',
    },
    {
      testId: 'ERR-006',
      testItem: 'API通信エラー',
      testPoint: 'バッチジョブ起動APIがエラーを返した場合',
      precondition: 'ZIPファイルはS3にアップロード済み',
      testSteps: '1. バッチジョブ起動APIが500エラーを返す',
      expectedResult: '・エラーが適切にハンドリングされる\n・ユーザーにエラーが通知される\n・S3にアップロードされたファイルはそのまま残る',
    },
    {
      testId: 'ERR-007',
      testItem: 'API通信エラー',
      testPoint: 'ネットワーク切断時の動作',
      precondition: 'ネットワークが切断された状態',
      testSteps: '1. インポートボタンをクリック',
      expectedResult: '・ネットワークエラーが発生する\n・エラーが適切にハンドリングされる\n・画面遷移は行われない',
    },
    // ---------- 認証・認可エラー ----------
    {
      testId: 'ERR-008',
      testItem: '認証・認可エラー',
      testPoint: 'セッション切れの場合の動作',
      precondition: 'セッションが期限切れ',
      testSteps: '1. テストインポート実施画面にアクセス',
      expectedResult: '・ログイン画面にリダイレクトされる\n・適切なエラーメッセージが表示される',
    },
    {
      testId: 'ERR-009',
      testItem: '認証・認可エラー',
      testPoint: '権限のないユーザーがアクセスした場合',
      precondition: '一般ユーザー（テスト管理者でも管理者でもない）でログイン',
      testSteps: '1. テストインポート実施画面のURLに直接アクセス',
      expectedResult: '・権限エラーが表示される\n・インポート操作は実行できない',
    },
    {
      testId: 'ERR-010',
      testItem: '認証・認可エラー',
      testPoint: 'プリサインドURL取得APIの権限チェック',
      precondition: '一般ユーザーでログイン済み',
      testSteps: '1. POST /api/batch/upload-url にリクエストを送信',
      expectedResult: '・403 Forbiddenエラーが返される\n・アップロードは実行されない',
    },
    // ---------- S3設定エラー ----------
    {
      testId: 'ERR-011',
      testItem: 'S3設定エラー',
      testPoint: 'S3バケットが未設定の場合',
      precondition: 'INPUT_S3_BUCKET環境変数が未設定',
      testSteps: '1. POST /api/batch/upload-url にリクエストを送信',
      expectedResult: '・500 Internal Server Errorが返される\n・「S3バケットが設定されていません」エラーメッセージが返される',
    },
    // ---------- インポート結果表示エラー ----------
    {
      testId: 'ERR-012',
      testItem: 'インポート結果表示エラー',
      testPoint: 'インポート結果一覧取得APIがエラーの場合',
      precondition: 'APIがエラーを返す状態',
      testSteps: '1. インポート結果一覧画面にアクセス',
      expectedResult: '・エラーログが出力される\n・menuItemsが空配列になる\n・エラーバウンダリでエラーが処理される',
    },
    {
      testId: 'ERR-013',
      testItem: 'インポート結果表示エラー',
      testPoint: 'インポート結果が0件の場合',
      precondition: 'インポート結果がデータベースに存在しない',
      testSteps: '1. インポート結果一覧画面にアクセス',
      expectedResult: '・「インポート結果がありません」というメッセージが表示される\n・一覧テーブルは表示されない',
    },
    {
      testId: 'ERR-014',
      testItem: 'インポート結果表示エラー',
      testPoint: 'インポート結果詳細のIDが不正な場合',
      precondition: 'ログイン済み',
      testSteps: '1. /importResult/importInfo/999999 など存在しないIDのURLにアクセス',
      expectedResult: '・エラーが適切にハンドリングされる\n・データが見つからない旨が表示される',
    },
    // ---------- 同時操作エラー ----------
    {
      testId: 'ERR-015',
      testItem: '同時操作エラー',
      testPoint: 'インポートボタンの連打防止',
      precondition: 'ZIPファイルを選択済み',
      testSteps: '1. インポートボタンを連続してクリック',
      expectedResult: '・二重送信が防止される\n・インポート処理は1回のみ実行される',
    },
  ];

  addTestCasesWithMerge(errorSheet, errorTestCases, 2);

  // ==================== テスト概要シート ====================
  const summarySheet = workbook.addWorksheet('テスト概要');
  summarySheet.columns = [
    { key: 'item', width: 30 },
    { key: 'value', width: 70 },
  ];

  // タイトル行（セル結合）
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'テストケースインポート画面 結合テスト仕様書（IT1/IT2）';
  titleCell.style = {
    font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  };
  summarySheet.getRow(1).height = 35;

  const summaryData = [
    { item: 'テスト対象画面', value: 'テストケースインポート実施画面 (testImportExecute/page.tsx)' },
    { item: 'ファイルパス', value: 'app/(secure)/testGroup/[groupId]/testCase/testImportExecute/page.tsx' },
    { item: '関連API', value: 'POST /api/batch/upload-url\nGET /api/batch/status/[jobId]\nGET /api/import-results' },
    { item: 'テスト観点', value: 'IT1: 画面表示/UI操作、IT2: API連携/画面遷移、異常系テスト' },
    { item: '', value: '' },
    { item: 'IT1テストケース数', value: `${it1TestCases.length}件` },
    { item: 'IT2テストケース数', value: `${it2TestCases.length}件` },
    { item: '異常系テストケース数', value: `${errorTestCases.length}件` },
    { item: '合計テストケース数', value: `${it1TestCases.length + it2TestCases.length + errorTestCases.length}件` },
    { item: '', value: '' },
    {
      item: '主な機能',
      value:
        '・ZIPファイル選択（CSV + エビデンス/仕様書ファイル）\n・PapaParseによるCSVパース（Shift-JIS対応）\n・S3プリサインドURL経由のファイルアップロード\n・AWS Batchジョブ起動\n・インポート結果一覧/詳細表示\n・テストグループ情報モーダル表示',
    },
    { item: '', value: '' },
    {
      item: 'IT1観点の詳細',
      value:
        '・初期表示（タイトル、フォーム、ボタン表示）\n・ファイル選択操作（ZIP選択、Shift-JISパース、再選択）\n・インポートボタン（実行、未選択時のガード）\n・戻るボタン（画面遷移）\n・テストグループ情報モーダル（開閉）\n・URLパラメータ（type取得）\n・レイアウト（VerticalForm）',
    },
    {
      item: 'IT2観点の詳細',
      value:
        '・プリサインドURL取得API（正常、サニタイズ、権限チェック）\n・S3アップロード連携\n・バッチジョブ起動/ステータス確認\n・画面遷移（インポート結果、戻る）\n・インポート結果一覧（取得、ステータス表示、種別表示、ページネーション、ソート）\n・インポート結果詳細表示\n・ログ出力',
    },
    {
      item: '異常系観点の詳細',
      value:
        '・ファイル選択エラー（不正形式、空ZIP、大容量）\n・API通信エラー（URL取得失敗、S3アップロード失敗、ジョブ起動失敗、ネットワーク切断）\n・認証・認可エラー（セッション切れ、権限不足）\n・S3設定エラー（バケット未設定）\n・インポート結果表示エラー（API失敗、0件、不正ID）\n・同時操作エラー（連打防止）',
    },
  ];

  summaryData.forEach((data) => {
    const row = summarySheet.addRow(data);
    if (data.item === '') {
      row.height = 10;
    } else {
      row.height = data.value.split('\n').length > 3 ? 100 : 40;
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
  const fileName = 'docs/IT1_IT2_試験項目書_テストケースインポート画面.xlsx';
  await workbook.xlsx.writeFile(fileName);
  console.log(`テスト仕様書を生成しました: ${fileName}`);
  console.log(`テストケース合計: ${it1TestCases.length + it2TestCases.length + errorTestCases.length}件`);
  console.log(`  - IT1（画面表示/UI操作）: ${it1TestCases.length}件`);
  console.log(`  - IT2（API連携/画面遷移）: ${it2TestCases.length}件`);
  console.log(`  - 異常系テスト: ${errorTestCases.length}件`);
}

generateTestImportScreenSpec().catch(console.error);
