const ExcelJS = require('exceljs');

async function generateTestSpecification() {
  const workbook = new ExcelJS.Workbook();

  // 共通のヘッダースタイル
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  const cellStyle = {
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  };

  // IT1シート: 画面表示/UI操作
  const it1Sheet = workbook.addWorksheet('IT1_画面表示UI操作');
  it1Sheet.columns = [
    { key: 'testId', width: 12 },
    { key: 'testItem', width: 30 },
    { key: 'testPoint', width: 25 },
    { key: 'precondition', width: 30 },
    { key: 'testSteps', width: 40 },
    { key: 'expectedResult', width: 40 },
    { key: 'actualResult', width: 15 },
    { key: 'remarks', width: 20 }
  ];

  // IT1ヘッダー
  it1Sheet.getRow(1).values = [
    'テストID',
    'テスト項目',
    'テスト観点',
    '前提条件',
    'テスト手順',
    '期待結果',
    '実行結果',
    '備考'
  ];
  it1Sheet.getRow(1).height = 25;
  it1Sheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
  });

  // IT1テストケース
  const it1TestCases = [
    {
      testId: 'IT1-001',
      testItem: '初期表示',
      testPoint: '画面の初期表示が正常に行われること',
      precondition: 'ログイン済み',
      testSteps: '1. テストグループ一覧画面にアクセスする',
      expectedResult: '・検索フォーム（OEM、機種、イベント、バリエーション、仕向）が表示される\n・テストグループ新規登録ボタンが表示される\n・テストグループの一覧が表示される（最大10件）\n・ページネーションが表示される'
    },
    {
      testId: 'IT1-002',
      testItem: 'データがない場合の表示',
      testPoint: 'テストグループが存在しない場合の表示',
      precondition: 'ログイン済み、テストグループが0件',
      testSteps: '1. テストグループ一覧画面にアクセスする',
      expectedResult: '「テストグループがありません」というメッセージが表示される'
    },
    {
      testId: 'IT1-003',
      testItem: '一覧の表示項目',
      testPoint: '一覧に正しい項目が表示されること',
      precondition: 'ログイン済み、テストグループが1件以上存在',
      testSteps: '1. テストグループ一覧画面にアクセスする\n2. 一覧の表示項目を確認する',
      expectedResult: '以下の項目が表示される：\n・ID（リンク）\n・OEM\n・機種\n・イベント\n・バリエーション\n・仕向\n・作成日\n・更新日\n・アクションボタン（編集、削除、集計、複製）'
    },
    {
      testId: 'IT1-004',
      testItem: '検索機能 - OEM',
      testPoint: 'OEMで検索できること',
      precondition: 'ログイン済み、複数のテストグループが存在',
      testSteps: '1. OEM検索フィールドに「Toyota」と入力\n2. 検索ボタンをクリック',
      expectedResult: '・OEMが「Toyota」のテストグループのみが表示される\n・URLパラメータに「oem=Toyota」が付与される\n・ページが1にリセットされる'
    },
    {
      testId: 'IT1-005',
      testItem: '検索機能 - 機種',
      testPoint: '機種で検索できること',
      precondition: 'ログイン済み、複数のテストグループが存在',
      testSteps: '1. 機種検索フィールドに検索値を入力\n2. 検索ボタンをクリック',
      expectedResult: '・入力した機種に一致するテストグループのみが表示される\n・URLパラメータに機種が付与される'
    },
    {
      testId: 'IT1-006',
      testItem: '検索機能 - 複合条件',
      testPoint: '複数の条件で検索できること',
      precondition: 'ログイン済み、複数のテストグループが存在',
      testSteps: '1. OEM、機種、イベントの各フィールドに値を入力\n2. 検索ボタンをクリック',
      expectedResult: '・すべての条件に一致するテストグループのみが表示される\n・URLパラメータにすべての検索条件が付与される'
    },
    {
      testId: 'IT1-007',
      testItem: '検索条件のクリア',
      testPoint: '検索条件をクリアして全件表示できること',
      precondition: '検索条件が入力された状態',
      testSteps: '1. すべての検索フィールドをクリア\n2. 検索ボタンをクリック',
      expectedResult: '・すべてのテストグループが表示される\n・URLパラメータから検索条件が削除される'
    },
    {
      testId: 'IT1-008',
      testItem: 'ページネーション - 次ページ',
      testPoint: '次のページに遷移できること',
      precondition: 'ログイン済み、テストグループが11件以上存在',
      testSteps: '1. 1ページ目を表示\n2. 「次へ」または「2」ボタンをクリック',
      expectedResult: '・2ページ目の内容が表示される（11件目以降）\n・URLパラメータに「page=2」が付与される'
    },
    {
      testId: 'IT1-009',
      testItem: 'ページネーション - 前ページ',
      testPoint: '前のページに戻れること',
      precondition: '2ページ目を表示中',
      testSteps: '1. 2ページ目を表示\n2. 「前へ」または「1」ボタンをクリック',
      expectedResult: '・1ページ目の内容が表示される\n・URLパラメータが「page=1」に更新される'
    },
    {
      testId: 'IT1-010',
      testItem: 'ページネーション - 件数表示',
      testPoint: '総件数が正しく表示されること',
      precondition: 'ログイン済み、テストグループが複数存在',
      testSteps: '1. テストグループ一覧画面にアクセス\n2. 総件数を確認',
      expectedResult: '・総件数が正しく表示される\n・総ページ数が正しく計算される（総件数÷10の切り上げ）'
    },
    {
      testId: 'IT1-011',
      testItem: 'ソート機能 - ID昇順',
      testPoint: 'IDで昇順ソートできること',
      precondition: 'ログイン済み、複数のテストグループが存在',
      testSteps: '1. IDカラムのヘッダーをクリック',
      expectedResult: '・IDの小さい順に並び替えられる\n・ソートインジケータが表示される'
    },
    {
      testId: 'IT1-012',
      testItem: 'ソート機能 - ID降順',
      testPoint: 'IDで降順ソートできること',
      precondition: 'ID昇順でソート済み',
      testSteps: '1. IDカラムのヘッダーを再度クリック',
      expectedResult: '・IDの大きい順に並び替えられる\n・ソートインジケータの向きが変わる'
    },
    {
      testId: 'IT1-013',
      testItem: 'ソート機能 - 各カラム',
      testPoint: 'すべてのカラムでソートできること',
      precondition: 'ログイン済み、複数のテストグループが存在',
      testSteps: '1. OEM、機種、イベント、バリエーション、仕向、作成日、更新日の各カラムでソートを試す',
      expectedResult: '・各カラムで昇順/降順のソートが正常に動作する'
    },
    {
      testId: 'IT1-014',
      testItem: 'IDリンク',
      testPoint: 'IDをクリックするとテストケース一覧に遷移すること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. 任意のテストグループのIDをクリック',
      expectedResult: '・「/testGroup/{id}/testCase」に遷移する\n・該当テストグループのテストケース一覧画面が表示される'
    },
    {
      testId: 'IT1-015',
      testItem: '新規登録ボタン - 権限あり',
      testPoint: '権限があるユーザーは新規登録ボタンが活性化されること',
      precondition: 'テスト管理者または管理者でログイン',
      testSteps: '1. テストグループ一覧画面を表示\n2. テストグループ新規登録ボタンの状態を確認',
      expectedResult: '・ボタンが活性化されている\n・クリック可能'
    },
    {
      testId: 'IT1-016',
      testItem: '新規登録ボタン - 権限なし',
      testPoint: '権限がないユーザーは新規登録ボタンが非活性化されること',
      precondition: '一般ユーザー（権限レベル2以上）でログイン',
      testSteps: '1. テストグループ一覧画面を表示\n2. テストグループ新規登録ボタンの状態を確認',
      expectedResult: '・ボタンが非活性化されている\n・クリック不可'
    },
    {
      testId: 'IT1-017',
      testItem: '編集ボタン - 権限あり',
      testPoint: '権限があるユーザーは編集ボタンが活性化されること',
      precondition: 'テスト管理者または管理者でログイン、isCanModify=trueのテストグループが存在',
      testSteps: '1. テストグループ一覧画面を表示\n2. 編集ボタンの状態を確認',
      expectedResult: '・編集ボタンが活性化されている'
    },
    {
      testId: 'IT1-018',
      testItem: '編集ボタン - 権限なし（isCanModify）',
      testPoint: 'isCanModify=falseの場合は編集ボタンが非活性化されること',
      precondition: 'ログイン済み、isCanModify=falseのテストグループが存在',
      testSteps: '1. テストグループ一覧画面を表示\n2. 該当テストグループの編集ボタンの状態を確認',
      expectedResult: '・編集ボタンが非活性化されている'
    },
    {
      testId: 'IT1-019',
      testItem: '削除ボタン',
      testPoint: '削除ボタンをクリックすると確認モーダルが表示されること',
      precondition: 'ログイン済み、isCanModify=trueのテストグループが存在',
      testSteps: '1. 削除ボタンをクリック',
      expectedResult: '・削除確認モーダルが表示される\n・「本当にこのテストグループを削除しますか？」というメッセージが表示される\n・関連するテストケース件数が表示される\n・対象テストグループIDが表示される\n・削除ボタンと閉じるボタンが表示される'
    },
    {
      testId: 'IT1-020',
      testItem: '削除モーダル - 2段階確認',
      testPoint: '削除は2段階の確認が必要なこと',
      precondition: '削除確認モーダルが表示されている',
      testSteps: '1. 最初の削除ボタンをクリック\n2. 2回目の確認メッセージを確認\n3. 2回目の削除ボタンをクリック',
      expectedResult: '・1回目のクリックで「本当に削除しますか？」という2段階目の確認が表示される\n・2回目のクリックで削除処理が実行される'
    },
    {
      testId: 'IT1-021',
      testItem: '削除モーダル - 閉じる',
      testPoint: '閉じるボタンで削除をキャンセルできること',
      precondition: '削除確認モーダルが表示されている',
      testSteps: '1. 閉じるボタンをクリック',
      expectedResult: '・モーダルが閉じる\n・削除処理は実行されない\n・一覧画面に戻る'
    },
    {
      testId: 'IT1-022',
      testItem: '集計ボタン',
      testPoint: '集計ボタンは常に活性化されていること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. テストグループ一覧画面を表示\n2. 集計ボタンの状態を確認',
      expectedResult: '・集計ボタンが活性化されている（権限に関わらず）'
    },
    {
      testId: 'IT1-023',
      testItem: '複製ボタン - 活性/非活性',
      testPoint: '複製ボタンの活性/非活性がisCanModifyに応じて制御されること',
      precondition: 'ログイン済み、複数のテストグループが存在',
      testSteps: '1. isCanModify=trueとfalseのテストグループの複製ボタンを確認',
      expectedResult: '・isCanModify=trueの場合：複製ボタンが活性化\n・isCanModify=falseの場合：複製ボタンが非活性化'
    },
    {
      testId: 'IT1-024',
      testItem: 'ローディング表示 - データ取得中',
      testPoint: 'データ取得中はローディング表示がされること',
      precondition: 'ログイン済み',
      testSteps: '1. テストグループ一覧画面にアクセス\n2. データ取得中の表示を確認',
      expectedResult: '・「データ読み込み中...」というメッセージとローディングアイコンが表示される\n・データ取得完了後、一覧が表示される'
    },
    {
      testId: 'IT1-025',
      testItem: 'ローディング表示 - 削除処理中',
      testPoint: '削除処理中はローディング表示がされること',
      precondition: '削除処理を実行',
      testSteps: '1. 削除ボタンをクリックして削除を実行\n2. 処理中の表示を確認',
      expectedResult: '・「データ削除中...」というメッセージとローディングアイコンが表示される\n・削除完了後、結果モーダルが表示される'
    },
    {
      testId: 'IT1-026',
      testItem: 'URL同期 - 検索条件',
      testPoint: '検索条件がURLパラメータと同期されること',
      precondition: 'ログイン済み',
      testSteps: '1. 検索条件を入力して検索\n2. URLを確認\n3. ブラウザをリロード',
      expectedResult: '・URLに検索条件がパラメータとして付与される\n・リロード後も検索条件が保持される'
    },
    {
      testId: 'IT1-027',
      testItem: 'URL同期 - ページ番号',
      testPoint: 'ページ番号がURLパラメータと同期されること',
      precondition: 'ログイン済み、複数ページ存在',
      testSteps: '1. 2ページ目に遷移\n2. URLを確認\n3. ブラウザをリロード',
      expectedResult: '・URLに「page=2」が付与される\n・リロード後も2ページ目が表示される'
    },
    {
      testId: 'IT1-028',
      testItem: '日付フォーマット',
      testPoint: '作成日・更新日が日本時間で正しくフォーマットされること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. テストグループ一覧画面を表示\n2. 作成日・更新日の表示を確認',
      expectedResult: '・日付が日本時間（JST）で表示される\n・フォーマットが統一されている'
    }
  ];

  // IT1データ追加
  it1TestCases.forEach((testCase, index) => {
    const row = it1Sheet.addRow({
      testId: testCase.testId,
      testItem: testCase.testItem,
      testPoint: testCase.testPoint,
      precondition: testCase.precondition,
      testSteps: testCase.testSteps,
      expectedResult: testCase.expectedResult,
      actualResult: '',
      remarks: ''
    });
    row.height = 80;
    row.eachCell((cell) => {
      cell.style = cellStyle;
    });
  });

  // IT2シート: API連携/データ + 画面遷移
  const it2Sheet = workbook.addWorksheet('IT2_API連携と画面遷移');
  it2Sheet.columns = [
    { key: 'testId', width: 12 },
    { key: 'testItem', width: 30 },
    { key: 'testPoint', width: 25 },
    { key: 'precondition', width: 30 },
    { key: 'testSteps', width: 40 },
    { key: 'expectedResult', width: 40 },
    { key: 'actualResult', width: 15 },
    { key: 'remarks', width: 20 }
  ];

  // IT2ヘッダー
  it2Sheet.getRow(1).values = [
    'テストID',
    'テスト項目',
    'テスト観点',
    '前提条件',
    'テスト手順',
    '期待結果',
    '実行結果',
    '備考'
  ];
  it2Sheet.getRow(1).height = 25;
  it2Sheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
  });

  // IT2テストケース
  const it2TestCases = [
    // API連携
    {
      testId: 'IT2-001',
      testItem: 'テストグループ一覧取得API',
      testPoint: 'API経由でテストグループ一覧を正しく取得できること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. テストグループ一覧画面にアクセス\n2. API「GET /api/test-groups」が呼ばれることを確認\n3. レスポンスを確認',
      expectedResult: '・APIが正常に呼び出される\n・レスポンスにdata配列とtotalCountが含まれる\n・各テストグループに必要な項目（id, oem, model, event, variation, destination, created_at, updated_at, isCanModify）が含まれる'
    },
    {
      testId: 'IT2-002',
      testItem: 'テストグループ一覧取得API - ページング',
      testPoint: 'ページングパラメータが正しく送信されること',
      precondition: 'ログイン済み、テストグループが11件以上存在',
      testSteps: '1. 1ページ目を表示\n2. APIリクエストのクエリパラメータを確認\n3. 2ページ目に遷移\n4. APIリクエストのクエリパラメータを確認',
      expectedResult: '・1ページ目：page=1, pageSize=10\n・2ページ目：page=2, pageSize=10\n・各ページで正しいデータが返される'
    },
    {
      testId: 'IT2-003',
      testItem: 'テストグループ一覧取得API - 検索パラメータ',
      testPoint: '検索条件がAPIリクエストに含まれること',
      precondition: 'ログイン済み',
      testSteps: '1. OEM=\"Toyota\"、機種=\"Camry\"で検索\n2. APIリクエストのクエリパラメータを確認',
      expectedResult: '・クエリパラメータにoem=Toyota&model=Camryが含まれる\n・該当するテストグループのみが返される'
    },
    {
      testId: 'IT2-004',
      testItem: '関連テストケース件数取得API',
      testPoint: '削除ボタン押下時に関連テストケース件数を取得すること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. 削除ボタンをクリック\n2. API「GET /api/test-groups/{id}/cases」が呼ばれることを確認',
      expectedResult: '・APIが正常に呼び出される\n・totalCountが返される\n・モーダルに件数が表示される'
    },
    {
      testId: 'IT2-005',
      testItem: 'テストグループ削除API',
      testPoint: 'API経由でテストグループを削除できること',
      precondition: 'ログイン済み、削除可能なテストグループが存在',
      testSteps: '1. 削除ボタンをクリック\n2. 2段階の確認を経て削除を実行\n3. API「DELETE /api/test-groups/{id}」が呼ばれることを確認',
      expectedResult: '・APIが正常に呼び出される\n・レスポンスでsuccess=trueが返される\n・削除後、一覧が再取得される\n・削除されたテストグループが一覧から消える'
    },
    {
      testId: 'IT2-006',
      testItem: '削除後の一覧再取得',
      testPoint: '削除成功後に一覧が自動的に再取得されること',
      precondition: 'テストグループ削除が成功',
      testSteps: '1. テストグループを削除\n2. 削除成功後のAPI呼び出しを確認',
      expectedResult: '・削除成功後、GET /api/test-groupsが再度呼ばれる\n・ページが1にリセットされる\n・最新の一覧が表示される'
    },
    {
      testId: 'IT2-007',
      testItem: 'データの整合性 - 総件数',
      testPoint: '総件数とページ数が正しく計算されること',
      precondition: 'ログイン済み、テストグループが25件存在',
      testSteps: '1. テストグループ一覧画面を表示\n2. 総件数とページ数を確認',
      expectedResult: '・総件数が25件と表示される\n・総ページ数が3ページ（Math.ceil(25/10)）と計算される'
    },
    {
      testId: 'IT2-008',
      testItem: 'データの整合性 - 日付変換',
      testPoint: 'APIから取得した日付が日本時間に変換されること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. APIレスポンスのcreated_at、updated_atを確認\n2. 画面表示の日付を確認',
      expectedResult: '・APIレスポンスの日付（UTC）が日本時間（JST）に変換される\n・formatDateJST関数が正しく適用される'
    },
    {
      testId: 'IT2-009',
      testItem: '権限制御 - API側',
      testPoint: 'API側で権限チェックが行われること',
      precondition: '一般ユーザーでログイン',
      testSteps: '1. 削除APIを直接呼び出す（ツール使用）',
      expectedResult: '・権限エラーが返される\n・削除処理は実行されない'
    },
    {
      testId: 'IT2-010',
      testItem: '権限制御 - isCanModify',
      testPoint: 'isCanModifyフラグが正しく機能すること',
      precondition: 'ログイン済み、他ユーザーが作成したテストグループが存在',
      testSteps: '1. 一覧を表示\n2. isCanModify=falseのテストグループを確認',
      expectedResult: '・編集、削除、複製ボタンが非活性化される\n・集計ボタンは活性化されたまま'
    },
    // 画面遷移
    {
      testId: 'IT2-011',
      testItem: '新規登録画面への遷移',
      testPoint: 'テストグループ新規登録ボタンで正しい画面に遷移すること',
      precondition: 'テスト管理者または管理者でログイン',
      testSteps: '1. テストグループ新規登録ボタンをクリック',
      expectedResult: '・「/testGroup/regist」に遷移する\n・テストグループ新規登録画面が表示される'
    },
    {
      testId: 'IT2-012',
      testItem: '編集画面への遷移',
      testPoint: '編集ボタンで正しい画面に遷移すること',
      precondition: 'ログイン済み、編集可能なテストグループが存在',
      testSteps: '1. 任意のテストグループの編集ボタンをクリック',
      expectedResult: '・「/testGroup/{id}/edit」に遷移する\n・該当テストグループの編集画面が表示される'
    },
    {
      testId: 'IT2-013',
      testItem: '集計画面への遷移',
      testPoint: '集計ボタンで正しい画面に遷移すること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. 任意のテストグループの集計ボタンをクリック',
      expectedResult: '・「/testGroup/{id}/testSummaryResult」に遷移する\n・該当テストグループの集計画面が表示される'
    },
    {
      testId: 'IT2-014',
      testItem: '複製画面への遷移',
      testPoint: '複製ボタンで正しい画面に遷移すること',
      precondition: 'ログイン済み、複製可能なテストグループが存在',
      testSteps: '1. 任意のテストグループの複製ボタンをクリック',
      expectedResult: '・「/testGroup/{id}/copy」に遷移する\n・該当テストグループの複製画面が表示される'
    },
    {
      testId: 'IT2-015',
      testItem: 'テストケース一覧への遷移',
      testPoint: 'IDリンクで正しい画面に遷移すること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. 任意のテストグループのIDリンクをクリック',
      expectedResult: '・「/testGroup/{id}/testCase」に遷移する\n・該当テストグループのテストケース一覧画面が表示される'
    },
    {
      testId: 'IT2-016',
      testItem: '画面遷移後の戻る操作',
      testPoint: '他画面から戻った際に検索条件が保持されること',
      precondition: '検索条件を入力した状態',
      testSteps: '1. 検索条件を入力して検索\n2. 編集画面に遷移\n3. ブラウザの戻るボタンで一覧に戻る',
      expectedResult: '・検索条件が保持されている\n・ページ番号が保持されている\n・URLパラメータから状態が復元される'
    },
    {
      testId: 'IT2-017',
      testItem: 'ログ出力 - デバッグログ',
      testPoint: '適切なデバッグログが出力されること',
      precondition: 'ログイン済み',
      testSteps: '1. テストグループ一覧画面にアクセス\n2. コンソールログを確認',
      expectedResult: '・「テストグループリスト取得開始」ログが出力される\n・「テストグループリスト取得成功」ログが出力される\n・ページ番号、件数、検索条件が含まれる'
    },
    {
      testId: 'IT2-018',
      testItem: 'ログ出力 - 操作ログ',
      testPoint: 'ユーザー操作のログが出力されること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. 各ボタン（編集、削除、集計、複製、検索、新規登録）をクリック\n2. コンソールログを確認',
      expectedResult: '・各操作に対応するinfoログが出力される\n・対象のIDやパラメータが含まれる'
    },
    {
      testId: 'IT2-019',
      testItem: 'セッション管理',
      testPoint: 'セッション情報が正しく取得されること',
      precondition: 'ログイン済み',
      testSteps: '1. テストグループ一覧画面を表示\n2. セッション情報を確認',
      expectedResult: '・useSessionフックからセッション情報が取得される\n・user_roleが正しく取得される\n・権限判定に使用される'
    },
    {
      testId: 'IT2-020',
      testItem: '最新ID計算',
      testPoint: '新規ID用に最新IDが計算されること',
      precondition: 'ログイン済み、テストグループが存在',
      testSteps: '1. テストグループ一覧を取得\n2. newid状態を確認',
      expectedResult: '・現在のテストグループの最大ID + 1が計算される\n・新規登録時に使用可能'
    }
  ];

  // IT2データ追加
  it2TestCases.forEach((testCase, index) => {
    const row = it2Sheet.addRow({
      testId: testCase.testId,
      testItem: testCase.testItem,
      testPoint: testCase.testPoint,
      precondition: testCase.precondition,
      testSteps: testCase.testSteps,
      expectedResult: testCase.expectedResult,
      actualResult: '',
      remarks: ''
    });
    row.height = 80;
    row.eachCell((cell) => {
      cell.style = cellStyle;
    });
  });

  // 異常系シート
  const errorSheet = workbook.addWorksheet('異常系テスト');
  errorSheet.columns = [
    { key: 'testId', width: 12 },
    { key: 'testItem', width: 30 },
    { key: 'testPoint', width: 25 },
    { key: 'precondition', width: 30 },
    { key: 'testSteps', width: 40 },
    { key: 'expectedResult', width: 40 },
    { key: 'actualResult', width: 15 },
    { key: 'remarks', width: 20 }
  ];

  // 異常系ヘッダー
  errorSheet.getRow(1).values = [
    'テストID',
    'テスト項目',
    'テスト観点',
    '前提条件',
    'テスト手順',
    '期待結果',
    '実行結果',
    '備考'
  ];
  errorSheet.getRow(1).height = 25;
  errorSheet.getRow(1).eachCell((cell) => {
    cell.style = headerStyle;
  });

  // 異常系テストケース
  const errorTestCases = [
    {
      testId: 'ERR-001',
      testItem: 'API通信エラー - 一覧取得',
      testPoint: 'テストグループ一覧取得APIがエラーになった場合の処理',
      precondition: 'ログイン済み、APIがエラーを返す状態',
      testSteps: '1. テストグループ一覧画面にアクセス\n2. APIがエラーを返す',
      expectedResult: '・エラーログが出力される\n・menuItemsが空配列になる\n・エラーバウンダリでエラーが処理される'
    },
    {
      testId: 'ERR-002',
      testItem: 'API通信エラー - 削除',
      testPoint: 'テストグループ削除APIがエラーになった場合の処理',
      precondition: 'ログイン済み、削除処理でAPIがエラーを返す',
      testSteps: '1. テストグループの削除を実行\n2. APIがエラーを返す',
      expectedResult: '・エラーログが出力される\n・「テストグループの削除に失敗しました」というメッセージが表示される\n・モーダルが表示される\n・一覧は更新されない'
    },
    {
      testId: 'ERR-003',
      testItem: 'API通信エラー - テストケース件数取得',
      testPoint: '関連テストケース件数取得APIがエラーになった場合の処理',
      precondition: 'ログイン済み、APIがエラーを返す',
      testSteps: '1. 削除ボタンをクリック\n2. テストケース件数取得APIがエラーを返す',
      expectedResult: '・エラーログが出力される\n・エラーが適切にハンドリングされる'
    },
    {
      testId: 'ERR-004',
      testItem: '削除失敗 - API側エラー',
      testPoint: '削除APIがsuccess=falseを返した場合の処理',
      precondition: 'ログイン済み、削除APIがsuccess=falseを返す',
      testSteps: '1. テストグループの削除を実行\n2. APIがsuccess=falseを返す',
      expectedResult: '・エラーログが出力される\n・「テストグループの削除に失敗しました」というメッセージが表示される\n・一覧は更新されない'
    },
    {
      testId: 'ERR-005',
      testItem: '権限エラー - 新規登録',
      testPoint: '権限のないユーザーが新規登録しようとした場合',
      precondition: '一般ユーザーでログイン',
      testSteps: '1. テストグループ新規登録ボタンを確認',
      expectedResult: '・ボタンが非活性化されている\n・クリックできない'
    },
    {
      testId: 'ERR-006',
      testItem: '権限エラー - 編集',
      testPoint: '権限のないユーザーが編集しようとした場合',
      precondition: 'ログイン済み、isCanModify=falseのテストグループ',
      testSteps: '1. 編集ボタンを確認',
      expectedResult: '・編集ボタンが非活性化されている\n・クリックできない'
    },
    {
      testId: 'ERR-007',
      testItem: '権限エラー - 削除',
      testPoint: '権限のないユーザーが削除しようとした場合',
      precondition: 'ログイン済み、isCanModify=falseのテストグループ',
      testSteps: '1. 削除ボタンを確認',
      expectedResult: '・削除ボタンが非活性化されている\n・クリックできない'
    },
    {
      testId: 'ERR-008',
      testItem: '権限エラー - 複製',
      testPoint: '権限のないユーザーが複製しようとした場合',
      precondition: 'ログイン済み、isCanModify=falseのテストグループ',
      testSteps: '1. 複製ボタンを確認',
      expectedResult: '・複製ボタンが非活性化されている\n・クリックできない'
    },
    {
      testId: 'ERR-009',
      testItem: '不正なページ番号',
      testPoint: 'URLに不正なページ番号が指定された場合',
      precondition: 'ログイン済み',
      testSteps: '1. URLに「?page=999」など存在しないページ番号を指定してアクセス',
      expectedResult: '・空の一覧が表示される、またはエラーハンドリングされる\n・システムエラーにならない'
    },
    {
      testId: 'ERR-010',
      testItem: '不正なページ番号 - 文字列',
      testPoint: 'URLのページ番号に文字列が指定された場合',
      precondition: 'ログイン済み',
      testSteps: '1. URLに「?page=abc」など文字列を指定してアクセス',
      expectedResult: '・デフォルトで1ページ目が表示される（parseInt処理）\n・システムエラーにならない'
    },
    {
      testId: 'ERR-011',
      testItem: '不正な検索パラメータ',
      testPoint: '不正な検索パラメータが指定された場合',
      precondition: 'ログイン済み',
      testSteps: '1. URLに不正な検索パラメータを指定してアクセス',
      expectedResult: '・空文字として処理される\n・システムエラーにならない'
    },
    {
      testId: 'ERR-012',
      testItem: 'セッション切れ',
      testPoint: 'セッションが切れた状態での操作',
      precondition: 'セッションが無効な状態',
      testSteps: '1. テストグループ一覧画面にアクセス',
      expectedResult: '・ログイン画面にリダイレクトされる\n・または適切なエラーメッセージが表示される'
    },
    {
      testId: 'ERR-013',
      testItem: '削除対象がnull',
      testPoint: '削除対象が選択されていない状態で削除実行',
      precondition: 'selectedTestGroupがnullの状態',
      testSteps: '1. 何らかの方法で削除実行を試みる',
      expectedResult: '・エラーがスローされる（throw new Error(\'groupId is NULL\')）\n・削除処理は実行されない'
    },
    {
      testId: 'ERR-014',
      testItem: 'データ不整合 - totalCount',
      testPoint: 'APIがtotalCountを返さない場合',
      precondition: 'APIがtotalCountを含まないレスポンスを返す',
      testSteps: '1. テストグループ一覧画面を表示\n2. APIレスポンスを確認',
      expectedResult: '・data.lengthがtotalCountとして使用される\n・ページ数が正しく計算される'
    },
    {
      testId: 'ERR-015',
      testItem: 'ネットワークエラー',
      testPoint: 'ネットワーク接続エラーの処理',
      precondition: 'ネットワークが切断された状態',
      testSteps: '1. ネットワークを切断\n2. テストグループ一覧画面にアクセス',
      expectedResult: '・エラーログが出力される\n・エラーが適切にハンドリングされる\n・ユーザーにエラー通知が表示される'
    },
    {
      testId: 'ERR-016',
      testItem: 'タイムアウト',
      testPoint: 'APIリクエストがタイムアウトした場合',
      precondition: 'APIレスポンスが遅延する状態',
      testSteps: '1. テストグループ一覧画面にアクセス\n2. APIがタイムアウトする',
      expectedResult: '・エラーログが出力される\n・エラーが適切にハンドリングされる\n・ローディング表示が終了する'
    },
    {
      testId: 'ERR-017',
      testItem: '同時実行制御',
      testPoint: '複数のAPI呼び出しが同時に発生した場合',
      precondition: 'ログイン済み',
      testSteps: '1. 短時間に複数の操作を実行（検索、ページ遷移など）',
      expectedResult: '・ignoreフラグにより古いリクエストの結果は破棄される\n・最新のリクエスト結果のみが反映される\n・データの不整合が発生しない'
    },
    {
      testId: 'ERR-018',
      testItem: 'バリデーションエラー - 検索',
      testPoint: '特殊文字や極端に長い検索文字列の処理',
      precondition: 'ログイン済み',
      testSteps: '1. 特殊文字（<, >, &, など）を検索フィールドに入力\n2. 1000文字など極端に長い文字列を入力\n3. 検索実行',
      expectedResult: '・特殊文字がエスケープされる\n・システムエラーにならない\n・XSS攻撃が防がれる'
    },
    {
      testId: 'ERR-019',
      testItem: 'ソート時のnull/undefined値',
      testPoint: 'ソート対象にnullやundefinedが含まれる場合',
      precondition: 'データにnullやundefinedを含むテストグループが存在',
      testSteps: '1. 該当カラムでソートを実行',
      expectedResult: '・エラーにならない\n・null/undefined値は適切に処理される（先頭または末尾に配置）'
    },
    {
      testId: 'ERR-020',
      testItem: 'メモリリーク防止',
      testPoint: 'コンポーネントアンマウント時のクリーンアップ',
      precondition: 'テストグループ一覧画面を表示中',
      testSteps: '1. データ取得中に他画面に遷移',
      expectedResult: '・useEffectのクリーンアップ関数が実行される\n・ignoreフラグがtrueになる\n・メモリリークが発生しない'
    }
  ];

  // 異常系データ追加
  errorTestCases.forEach((testCase, index) => {
    const row = errorSheet.addRow({
      testId: testCase.testId,
      testItem: testCase.testItem,
      testPoint: testCase.testPoint,
      precondition: testCase.precondition,
      testSteps: testCase.testSteps,
      expectedResult: testCase.expectedResult,
      actualResult: '',
      remarks: ''
    });
    row.height = 80;
    row.eachCell((cell) => {
      cell.style = cellStyle;
    });
  });

  // サマリーシートを追加
  const summarySheet = workbook.addWorksheet('テスト概要', { state: 'visible' });
  summarySheet.columns = [
    { key: 'item', width: 30 },
    { key: 'value', width: 60 }
  ];

  summarySheet.mergeCells('A1:B1');
  summarySheet.getCell('A1').value = 'テストグループ一覧画面 結合テスト仕様書';
  summarySheet.getCell('A1').style = {
    font: { bold: true, size: 16 },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
  };
  summarySheet.getRow(1).height = 30;

  const summaryData = [
    { item: 'テスト対象画面', value: 'テストグループ一覧画面 (TestGroupListContainer)' },
    { item: 'ファイルパス', value: 'app/(secure)/testGroup/_components/TestGroupListContainer.tsx' },
    { item: 'テスト観点', value: 'IT1: 画面表示/UI操作、IT2: API連携/データ・画面遷移、異常系テスト' },
    { item: 'IT1テストケース数', value: `${it1TestCases.length}件` },
    { item: 'IT2テストケース数', value: `${it2TestCases.length}件` },
    { item: '異常系テストケース数', value: `${errorTestCases.length}件` },
    { item: '合計テストケース数', value: `${it1TestCases.length + it2TestCases.length + errorTestCases.length}件` },
    { item: '', value: '' },
    { item: '主な機能', value: '・検索機能（OEM、機種、イベント、バリエーション、仕向）\n・一覧表示（ページング、ソート）\n・アクション（編集、削除、集計、複製）\n・権限制御' },
    { item: '', value: '' },
    { item: 'IT1観点の詳細', value: '・初期表示、データ表示\n・検索機能（単一条件、複合条件、クリア）\n・ページネーション（次へ、前へ、ページ指定）\n・ソート機能（各カラム、昇順/降順）\n・モーダル表示（削除確認、2段階確認）\n・ボタン制御（活性/非活性、権限による制御）\n・ローディング表示\n・URL同期' },
    { item: 'IT2観点の詳細', value: '・API連携（一覧取得、削除、テストケース件数取得）\n・ページングパラメータ、検索パラメータの送信\n・データ整合性（総件数、日付変換）\n・権限制御（API側、isCanModify）\n・画面遷移（新規登録、編集、集計、複製、テストケース一覧）\n・セッション管理、ログ出力' },
    { item: '異常系観点の詳細', value: '・API通信エラー（一覧取得、削除、テストケース件数）\n・削除失敗\n・権限エラー（各操作）\n・不正なパラメータ（ページ番号、検索条件）\n・セッション切れ\n・データ不整合\n・ネットワークエラー、タイムアウト\n・同時実行制御\n・バリデーションエラー\n・メモリリーク防止' }
  ];

  summaryData.forEach((data, index) => {
    const row = summarySheet.addRow(data);
    if (data.item === '') {
      row.height = 10;
    } else {
      row.height = 60;
      row.getCell('item').style = {
        font: { bold: true },
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
      row.getCell('value').style = {
        alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }
  });

  // シートの順序を変更（サマリーを最初に）
  workbook.worksheets[0].orderNo = 1;
  workbook.worksheets[1].orderNo = 2;
  workbook.worksheets[2].orderNo = 3;
  workbook.worksheets[3].orderNo = 0;

  // ファイル保存
  const fileName = 'テストグループ一覧画面_結合テスト仕様書_IT1_IT2.xlsx';
  await workbook.xlsx.writeFile(fileName);
  console.log(`✅ テスト仕様書を生成しました: ${fileName}`);
  console.log(`📊 テストケース合計: ${it1TestCases.length + it2TestCases.length + errorTestCases.length}件`);
  console.log(`   - IT1（画面表示/UI操作）: ${it1TestCases.length}件`);
  console.log(`   - IT2（API連携/画面遷移）: ${it2TestCases.length}件`);
  console.log(`   - 異常系テスト: ${errorTestCases.length}件`);
}

generateTestSpecification().catch(console.error);
