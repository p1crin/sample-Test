# テストケース編集画面 結合テスト仕様書

## 目次
1. [概要](#概要)
2. [IT1結合テスト（画面）](#it1結合テスト画面)
3. [IT1結合テスト（API）](#it1結合テストapi)
4. [IT2結合テスト](#it2結合テスト)
5. [ログテストについて](#ログテストについて)

---

## 概要

### テストレベル定義

| レベル | 名称 | 観点 |
|--------|------|------|
| IT1 | 単体結合テスト | コンポーネント間の結合確認、API単体の動作確認 |
| IT2 | システム結合テスト | エンドツーエンドのシナリオ、複数機能の連携 |

### 対象画面・API

- **画面**: `/testGroup/[groupId]/testCase/[tid]/edit`
- **API**:
  - `GET /api/test-groups/[groupId]/cases/[tid]`
  - `PUT /api/test-groups/[groupId]/cases/[tid]`
  - `DELETE /api/test-groups/[groupId]/cases/[tid]`
  - `POST /api/files/test-info`
  - `DELETE /api/files/test-info`

### 共通ヘッダー（API テスト用）

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
X-Request-ID: {uuid}
```

---

## IT1結合テスト（画面）

### 正常系

| No | 大項目 | 中項目 | 小項目 | 正常/異常 | テスト観点 | 前提条件 | テスト手順 | 期待結果 |
|----|--------|--------|--------|-----------|-----------|----------|-----------|----------|
| IT1-UI-001 | 画面表示 | 初期表示 | ローディング表示 | 正常 | 画面遷移時にローディングが表示されること | 編集権限を持つユーザーでログイン済み | 1. テストケース一覧画面を表示<br>2. 編集ボタンをクリック | ローディングスピナーが表示され、データ取得完了後にフォームが表示される |
| IT1-UI-002 | 画面表示 | 初期表示 | フォーム初期値 | 正常 | DBの値がフォームに正しく表示されること | テストケースデータが存在する | 1. テストケース編集画面に遷移 | 第1〜4階層、目的、要求ID、チェック項目、テスト手順がDB値で表示される |
| IT1-UI-003 | 画面表示 | 初期表示 | ファイル一覧表示 | 正常 | 登録済みファイルが一覧表示されること | 制御仕様書・データフローファイルが登録済み | 1. テストケース編集画面に遷移 | 制御仕様書、データフローの各ファイル一覧が表示される |
| IT1-UI-004 | 画面表示 | 初期表示 | テスト内容一覧表示 | 正常 | 登録済みテスト内容が全件表示されること | テスト内容が3件登録済み | 1. テストケース編集画面に遷移 | テスト内容が3行表示され、各行にテストケース、期待値、対象フラグが表示される |
| IT1-UI-005 | フォーム入力 | テキスト入力 | 階層フィールド入力 | 正常 | テキストフィールドに値が入力できること | フォーム表示済み | 1. 第1階層フィールドをクリック<br>2. 「機能テスト」と入力 | 入力値「機能テスト」がフィールドに反映される |
| IT1-UI-006 | フォーム入力 | テキストエリア入力 | チェック項目入力 | 正常 | テキストエリアに複数行入力できること | フォーム表示済み | 1. チェック項目フィールドに複数行入力 | 改行を含む入力値が正しく反映される |
| IT1-UI-007 | フォーム入力 | テスト内容操作 | 行追加 | 正常 | テスト内容行が追加できること | フォーム表示済み | 1. 「行追加」ボタンをクリック | 新しいテスト内容行が末尾に追加される |
| IT1-UI-008 | フォーム入力 | テスト内容操作 | 行削除 | 正常 | テスト内容行が削除できること | テスト内容が2行以上存在 | 1. 2行目の削除ボタンをクリック | 2行目が削除され、1行目のみ残る |
| IT1-UI-009 | フォーム入力 | テスト内容操作 | 対象フラグ切替 | 正常 | 対象フラグのON/OFFが切替できること | テスト内容行が存在 | 1. 対象チェックボックスをクリック | チェック状態がON/OFFに切り替わる |
| IT1-UI-010 | フォーム入力 | テスト内容操作 | 一括入力 | 正常 | テスト内容を一括で入力できること | フォーム表示済み | 1. 一括入力ボタンをクリック<br>2. 複数行のテキストを貼り付け<br>3. 確定 | テスト内容が行ごとに分割して入力される |
| IT1-UI-011 | ファイル操作 | アップロード | ファイル選択 | 正常 | ファイルを選択して一覧に追加できること | フォーム表示済み | 1. ファイル選択ボタンをクリック<br>2. PDFファイルを選択 | 選択ファイルがファイル一覧に追加表示される |
| IT1-UI-012 | ファイル操作 | アップロード | 複数ファイル選択 | 正常 | 複数ファイルを同時に選択できること | フォーム表示済み | 1. ファイル選択で複数ファイルを選択 | 選択した全ファイルが一覧に追加される |
| IT1-UI-013 | ファイル操作 | 削除 | ファイル削除 | 正常 | ファイルを一覧から削除できること | ファイルが1件以上表示 | 1. ファイルの削除ボタンをクリック | 対象ファイルが一覧から削除される |
| IT1-UI-014 | フォーム送信 | 更新 | 更新ボタン活性化 | 正常 | 必須項目入力時に更新ボタンが活性化すること | 必須項目がすべて入力済み | 1. 更新ボタンの状態を確認 | 更新ボタンがクリック可能（活性状態） |
| IT1-UI-015 | フォーム送信 | 更新 | 更新成功 | 正常 | 更新成功後に詳細画面へ遷移すること | バリデーション通過 | 1. 更新ボタンをクリック | 更新成功トースト表示後、詳細画面へ遷移 |
| IT1-UI-016 | フォーム送信 | 更新 | ローディング表示 | 正常 | 更新処理中にローディングが表示されること | バリデーション通過 | 1. 更新ボタンをクリック | ローディング表示、更新ボタンが非活性化 |
| IT1-UI-017 | フォーム送信 | キャンセル | キャンセル操作 | 正常 | キャンセルで変更を破棄できること | フォーム編集中 | 1. キャンセルボタンをクリック | 詳細画面へ遷移、変更は保存されない |
| IT1-UI-018 | 認証・認可 | 権限表示 | 設計者権限 | 正常 | 設計者権限で編集フォームが表示されること | 設計者ロールを持つユーザー | 1. 編集画面にアクセス | 編集フォームが正常に表示される |
| IT1-UI-019 | 認証・認可 | 権限表示 | 管理者権限 | 正常 | 管理者権限で編集フォームが表示されること | 管理者ユーザー | 1. 編集画面にアクセス | 編集フォームが正常に表示される |

### 異常系

| No | 大項目 | 中項目 | 小項目 | 正常/異常 | テスト観点 | 前提条件 | テスト手順 | 期待結果 |
|----|--------|--------|--------|-----------|-----------|----------|-----------|----------|
| IT1-UI-E001 | 認証・認可 | 認証エラー | 未ログイン | 異常 | 未ログイン時にUnauthorizedUIが表示されること | 未ログイン状態 | 1. 編集画面URLに直接アクセス | UnauthorizedUI（ログイン案内）が表示される |
| IT1-UI-E002 | 認証・認可 | 認可エラー | 権限なし | 異常 | 編集権限なしでForbiddenUIが表示されること | 閲覧権限のみのユーザー | 1. 編集画面URLにアクセス | ForbiddenUI（権限エラー）が表示される |
| IT1-UI-E003 | 画面表示 | データエラー | 存在しないテストケース | 異常 | 存在しないTIDでエラーが表示されること | 削除済みのtidを指定 | 1. 存在しないtidで編集画面にアクセス | 「テストケースが見つかりません」エラー表示 |
| IT1-UI-E004 | 画面表示 | データエラー | 不正なgroupId | 異常 | 不正なgroupIdでエラーが表示されること | 不正なgroupIdをURLに指定 | 1. 不正なgroupIdで画面アクセス | エラーメッセージが表示される |
| IT1-UI-E005 | 画面表示 | 通信エラー | API通信エラー | 異常 | ネットワークエラー時にエラーが表示されること | ネットワーク切断状態 | 1. 編集画面にアクセス | 通信エラーメッセージ、リトライ案内が表示 |
| IT1-UI-E006 | 画面表示 | 通信エラー | サーバーエラー | 異常 | 500エラー時にエラーが表示されること | API側で500エラー発生 | 1. 編集画面にアクセス | サーバーエラーメッセージが表示される |
| IT1-UI-E007 | バリデーション | 必須チェック | 必須項目未入力 | 異常 | 必須項目未入力でエラーが表示されること | 第1階層を空に変更 | 1. 第1階層を空にする<br>2. 更新ボタンをクリック | バリデーションエラー表示、フィールドがハイライト |
| IT1-UI-E008 | バリデーション | 文字数チェック | 文字数超過 | 異常 | 文字数超過でエラーが表示されること | 第1階層に256文字以上入力 | 1. 256文字以上入力<br>2. 更新ボタンをクリック | 「255文字以下で入力」エラー表示 |
| IT1-UI-E009 | バリデーション | ファイルチェック | ファイル未添付 | 異常 | ファイル0件でエラーが表示されること | 制御仕様書を全削除 | 1. 制御仕様書を0件にする<br>2. 更新ボタンをクリック | 「1つ以上必須」エラー表示 |
| IT1-UI-E010 | バリデーション | テスト内容チェック | テスト内容空行 | 異常 | テスト内容空でエラーが表示されること | テストケース欄を空に | 1. テストケース欄を空にする<br>2. 更新ボタンをクリック | バリデーションエラー表示 |
| IT1-UI-E011 | ファイル操作 | アップロードエラー | ファイルサイズ超過 | 異常 | サイズ超過ファイルでエラーが表示されること | 10MBを超えるファイルを用意 | 1. 10MB超のファイルを選択 | 「ファイルサイズが大きすぎます」エラー表示 |
| IT1-UI-E012 | ファイル操作 | アップロードエラー | 不正なファイル形式 | 異常 | 許可外の拡張子でエラーが表示されること | .exeファイルを用意 | 1. 許可外の拡張子ファイルを選択 | 「許可されていないファイル形式」エラー表示 |
| IT1-UI-E013 | フォーム送信 | 更新エラー | 通信タイムアウト | 異常 | タイムアウト時にエラーが表示されること | ネットワーク遅延状態 | 1. 更新ボタンをクリック | タイムアウトエラー表示 |
| IT1-UI-E014 | フォーム送信 | 更新エラー | セッション切れ | 異常 | セッション切れ時にログイン画面へ遷移すること | セッション有効期限切れ | 1. 更新ボタンをクリック | 認証エラー表示、ログイン画面へリダイレクト |

---

## IT1結合テスト（API）

### 正常系

| No | 大項目 | 中項目 | 小項目 | 正常/異常 | テスト観点 | 前提条件 | テスト手順 | 期待結果 | curlコマンド例 |
|----|--------|--------|--------|-----------|-----------|----------|-----------|----------|---------------|
| IT1-API-001 | テストケース取得 | GET | 基本取得 | 正常 | テストケース詳細が取得できること | 対象データが存在、閲覧権限あり | 1. GETリクエスト送信 | 200 OK、テストケース詳細JSON | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-002 | テストケース取得 | GET | テスト内容含む取得 | 正常 | テスト内容が配列で取得できること | テスト内容が3件存在 | 1. GETリクエスト送信 | 200 OK、testContents配列に3件含まれる | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-003 | テストケース取得 | GET | ファイル情報含む取得 | 正常 | ファイル情報が取得できること | ファイルが登録済み | 1. GETリクエスト送信 | 200 OK、controlSpecFiles, dataFlowFiles配列にファイル情報 | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-004 | テストケース取得 | GET | 管理者権限取得 | 正常 | 管理者が任意のテストケースを取得できること | 管理者ユーザーのトークン | 1. GETリクエスト送信 | 200 OK | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {admin_token}" -H "Content-Type: application/json"` |
| IT1-API-005 | テストケース更新 | PUT | 基本情報更新 | 正常 | 基本情報が更新できること | 編集権限あり | 1. PUTリクエスト送信（first_layer変更） | 200 OK、DBが更新される | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"first_layer":"更新値","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[{"test_case_no":1,"test_case":"TC1","expected_value":"EV1","is_target":true}]}'` |
| IT1-API-006 | テストケース更新 | PUT | テスト内容追加 | 正常 | テスト内容行が追加できること | 編集権限あり | 1. PUTリクエスト送信（testContentsに新規行） | 200 OK、tt_test_contentsに新規行追加 | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"first_layer":"値1","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[{"test_case_no":1,"test_case":"TC1","expected_value":"EV1","is_target":true},{"test_case_no":null,"test_case":"新規TC","expected_value":"新規EV","is_target":true}]}'` |
| IT1-API-007 | テストケース更新 | PUT | テスト内容更新 | 正常 | 既存テスト内容が更新できること | 既存テスト内容あり | 1. PUTリクエスト送信（testContents変更） | 200 OK、tt_test_contentsが更新 | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"first_layer":"値1","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[{"test_case_no":1,"test_case":"更新TC","expected_value":"更新EV","is_target":false}]}'` |
| IT1-API-008 | テストケース更新 | PUT | テスト内容削除 | 正常 | テスト内容行が論理削除できること | 削除対象行あり | 1. PUTリクエスト送信（deletedTestContents指定） | 200 OK、対象行がis_deleted=true | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"first_layer":"値1","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[{"test_case_no":1,"test_case":"TC1","expected_value":"EV1","is_target":true}],"deletedTestContents":[2]}'` |
| IT1-API-009 | テストケース更新 | PUT | 設計者権限更新 | 正常 | 設計者ロールで更新できること | 設計者ロール | 1. PUTリクエスト送信 | 200 OK | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {designer_token}" -H "Content-Type: application/json" -d '{"first_layer":"値1","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[{"test_case_no":1,"test_case":"TC1","expected_value":"EV1","is_target":true}]}'` |
| IT1-API-010 | テストケース削除 | DELETE | 削除成功 | 正常 | テストケースが削除できること | 対象データが存在、編集権限あり | 1. DELETEリクエスト送信 | 200 OK、関連データすべて削除 | `curl -X DELETE "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-011 | テストケース削除 | DELETE | 関連ファイル削除 | 正常 | 関連ファイルがストレージから削除されること | ファイルが登録済み | 1. DELETEリクエスト送信 | ストレージからファイル削除 | `curl -X DELETE "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-012 | ファイルアップロード | POST | アップロード成功 | 正常 | ファイルがアップロードできること | 編集権限あり | 1. POSTリクエスト送信（FormData） | 200 OK、ファイルIDが返却 | `curl -X POST "http://localhost:3000/api/files/test-info" -H "Authorization: Bearer {token}" -F "file=@/path/to/file.pdf" -F "testGroupId=1" -F "tid=1-1-1-1" -F "fileType=controlSpec"` |
| IT1-API-013 | ファイルアップロード | POST | 連続アップロード | 正常 | 複数ファイルにユニークなfile_noが付与されること | 編集権限あり | 1. POSTリクエスト2回送信 | 両ファイルに異なるfile_no | `curl -X POST "http://localhost:3000/api/files/test-info" -H "Authorization: Bearer {token}" -F "file=@/path/to/file1.pdf" -F "testGroupId=1" -F "tid=1-1-1-1" -F "fileType=controlSpec"` |
| IT1-API-014 | ファイル削除 | DELETE | 削除成功 | 正常 | ファイルが削除できること | ファイルが存在 | 1. DELETEリクエスト送信 | 200 OK、DB・ストレージから削除 | `curl -X DELETE "http://localhost:3000/api/files/test-info?testGroupId=1&tid=1-1-1-1&fileType=controlSpec&fileNo=1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |

### 異常系

| No | 大項目 | 中項目 | 小項目 | 正常/異常 | テスト観点 | 前提条件 | テスト手順 | 期待結果 | curlコマンド例 |
|----|--------|--------|--------|-----------|-----------|----------|-----------|----------|---------------|
| IT1-API-E001 | 認証エラー | GET | 未認証 | 異常 | 認証なしで401が返ること | 認証トークンなし | 1. Authorizationヘッダーなしでリクエスト | 401 Unauthorized | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Content-Type: application/json"` |
| IT1-API-E002 | 認証エラー | PUT | 未認証 | 異常 | 認証なしで401が返ること | 認証トークンなし | 1. Authorizationヘッダーなしでリクエスト | 401 Unauthorized | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Content-Type: application/json" -d '{}'` |
| IT1-API-E003 | 認証エラー | DELETE | 未認証 | 異常 | 認証なしで401が返ること | 認証トークンなし | 1. Authorizationヘッダーなしでリクエスト | 401 Unauthorized | `curl -X DELETE "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Content-Type: application/json"` |
| IT1-API-E004 | 認証エラー | 共通 | 無効トークン | 異常 | 期限切れトークンで401が返ること | 期限切れトークン | 1. 期限切れトークンでリクエスト | 401 Unauthorized | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {expired_token}" -H "Content-Type: application/json"` |
| IT1-API-E005 | 認可エラー | PUT | 閲覧者権限 | 異常 | 閲覧者権限で403が返ること | 閲覧者ロール | 1. 閲覧者トークンでPUTリクエスト | 403 Forbidden | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {viewer_token}" -H "Content-Type: application/json" -d '{}'` |
| IT1-API-E006 | 認可エラー | DELETE | 閲覧者権限 | 異常 | 閲覧者権限で403が返ること | 閲覧者ロール | 1. 閲覧者トークンでDELETEリクエスト | 403 Forbidden | `curl -X DELETE "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {viewer_token}" -H "Content-Type: application/json"` |
| IT1-API-E007 | 認可エラー | PUT | 実施者権限 | 異常 | 実施者権限で403が返ること | 実施者ロール | 1. 実施者トークンでPUTリクエスト | 403 Forbidden | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {executor_token}" -H "Content-Type: application/json" -d '{}'` |
| IT1-API-E008 | 認可エラー | GET | 他グループアクセス | 異常 | 権限のないグループで403が返ること | 権限のないグループ | 1. 他グループのテストケースにアクセス | 403 Forbidden | `curl -X GET "http://localhost:3000/api/test-groups/999/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E009 | バリデーションエラー | GET | groupId形式不正 | 異常 | 不正なgroupIdで400が返ること | - | 1. 文字列のgroupIdでリクエスト | 400 Bad Request | `curl -X GET "http://localhost:3000/api/test-groups/abc/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E010 | バリデーションエラー | GET | tid形式不正 | 異常 | 不正なtid形式で400が返ること | - | 1. 不正な形式のtidでリクエスト | 400 Bad Request | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/invalid" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E011 | バリデーションエラー | PUT | 必須フィールド欠落 | 異常 | 必須項目なしで400が返ること | - | 1. first_layerなしでPUTリクエスト | 400 Bad Request | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"second_layer":"値2"}'` |
| IT1-API-E012 | バリデーションエラー | PUT | 文字数超過 | 異常 | 文字数超過で400が返ること | - | 1. 256文字以上のfirst_layerでリクエスト | 400 Bad Request | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"first_layer":"<256文字以上の文字列>","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[]}'` |
| IT1-API-E013 | バリデーションエラー | PUT | 不正なJSON | 異常 | 不正なJSONで400が返ること | - | 1. 不正なJSONでリクエスト | 400 Bad Request | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{invalid json}'` |
| IT1-API-E014 | バリデーションエラー | PUT | 空のtestContents | 異常 | testContentsが空で400が返ること | - | 1. testContents=[]でリクエスト | 400 Bad Request | `curl -X PUT "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"first_layer":"値1","second_layer":"値2","third_layer":"値3","fourth_layer":"値4","purpose":"目的","request_id":"REQ-001","checkItems":"項目","testProcedure":"手順","testContents":[]}'` |
| IT1-API-E015 | データ存在エラー | GET | 存在しないgroupId | 異常 | 存在しないgroupIdで404が返ること | 該当グループなし | 1. 存在しないgroupIdでリクエスト | 404 Not Found | `curl -X GET "http://localhost:3000/api/test-groups/99999/cases/1-1-1-1" -H "Authorization: Bearer {admin_token}" -H "Content-Type: application/json"` |
| IT1-API-E016 | データ存在エラー | GET | 存在しないtid | 異常 | 存在しないtidで404が返ること | 該当テストケースなし | 1. 存在しないtidでリクエスト | 404 Not Found | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/9-9-9-9" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E017 | データ存在エラー | GET | 削除済みテストケース | 異常 | 削除済みデータで404が返ること | is_deleted=true | 1. 削除済みtidでリクエスト | 404 Not Found | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-2" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E018 | データ存在エラー | DELETE | 存在しないファイル | 異常 | 存在しないファイルで404が返ること | 該当ファイルなし | 1. 存在しないファイルIDでリクエスト | 404 Not Found | `curl -X DELETE "http://localhost:3000/api/files/test-info?testGroupId=1&tid=1-1-1-1&fileType=controlSpec&fileNo=999" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E019 | サーバーエラー | GET | DB接続エラー | 異常 | DB接続不可で500が返ること | DB接続不可状態 | 1. DB停止状態でリクエスト | 500 Internal Server Error | `curl -X GET "http://localhost:3000/api/test-groups/1/cases/1-1-1-1" -H "Authorization: Bearer {token}" -H "Content-Type: application/json"` |
| IT1-API-E020 | サーバーエラー | PUT | トランザクション失敗 | 異常 | トランザクション失敗で500が返りロールバックされること | 更新中にエラー発生 | 1. トランザクションエラー発生条件でリクエスト | 500 Internal Server Error、データはロールバック | - |
| IT1-API-E021 | サーバーエラー | POST | ストレージ接続エラー | 異常 | ストレージ接続不可で500が返ること | S3接続不可 | 1. ストレージ停止状態でファイルアップロード | 500 Internal Server Error | `curl -X POST "http://localhost:3000/api/files/test-info" -H "Authorization: Bearer {token}" -F "file=@/path/to/file.pdf" -F "testGroupId=1" -F "tid=1-1-1-1" -F "fileType=controlSpec"` |

---

## IT2結合テスト

### 正常系

| No | 大項目 | 中項目 | 小項目 | 正常/異常 | テスト観点 | 前提条件 | テスト手順 | 期待結果 |
|----|--------|--------|--------|-----------|-----------|----------|-----------|----------|
| IT2-001 | 編集フロー | 基本編集 | 基本情報変更 | 正常 | 一覧→編集→保存→詳細の一連フローが正常に動作すること | テストケースデータ存在、編集権限あり | 1. テストケース一覧画面を表示<br>2. 対象テストケースの編集ボタンをクリック<br>3. 第1階層を「変更後の値」に変更<br>4. 更新ボタンをクリック<br>5. 詳細画面で確認 | 変更内容がDBに保存され、詳細画面に「変更後の値」が表示される |
| IT2-002 | 編集フロー | テスト内容操作 | テスト内容追加 | 正常 | テスト内容行の追加がDBに反映されること | テストケースデータ存在、編集権限あり | 1. 編集画面を開く<br>2. 「行追加」ボタンをクリック<br>3. 新しい行にテストケース・期待値を入力<br>4. 更新ボタンをクリック<br>5. 再度編集画面を開く | 追加したテスト内容行がtt_test_contentsに保存され、画面に表示される |
| IT2-003 | 編集フロー | テスト内容操作 | テスト内容削除 | 正常 | テスト内容行の削除がDBに反映されること | テスト内容が2行以上存在、編集権限あり | 1. 編集画面を開く<br>2. 2行目の削除ボタンをクリック<br>3. 更新ボタンをクリック<br>4. 再度編集画面を開く | 削除した行がis_deleted=trueとなり、画面に表示されない |
| IT2-004 | 編集フロー | ファイル操作 | ファイル追加 | 正常 | ファイル追加がストレージとDBに反映されること | テストケースデータ存在、編集権限あり | 1. 編集画面を開く<br>2. 制御仕様書ファイル追加<br>3. 更新ボタンをクリック<br>4. 再度編集画面を開く | ファイルがS3にアップロードされ、tt_test_case_filesに記録、画面に表示される |
| IT2-005 | 編集フロー | ファイル操作 | ファイル削除 | 正常 | ファイル削除がストレージとDBから削除されること | ファイルが登録済み、編集権限あり | 1. 編集画面を開く<br>2. 既存ファイルの削除ボタンをクリック<br>3. 更新ボタンをクリック<br>4. 再度編集画面を開く | ファイルがS3から削除され、tt_test_case_filesから削除、画面に表示されない |
| IT2-006 | 編集フロー | 複合編集 | 全項目同時編集 | 正常 | 複数種類の変更が一括でトランザクション処理されること | テストケースデータ存在、編集権限あり | 1. 編集画面を開く<br>2. 基本情報を変更<br>3. テスト内容行を追加・削除<br>4. ファイルを追加・削除<br>5. 更新ボタンをクリック | すべての変更がトランザクションで一括反映され、詳細画面で確認可能 |
| IT2-007 | 権限別操作 | 管理者 | 任意グループ編集 | 正常 | 管理者が任意のテストグループを編集できること | 管理者ユーザー | 1. 管理者でログイン<br>2. 任意のテストケース編集画面にアクセス<br>3. 内容を変更して更新 | 編集・保存が正常に完了 |
| IT2-008 | 権限別操作 | 設計者 | 担当グループ編集 | 正常 | 設計者が担当グループを編集できること | 設計者ロールを持つユーザー | 1. 設計者でログイン<br>2. 担当グループのテストケース編集画面にアクセス<br>3. 内容を変更して更新 | 編集・保存が正常に完了 |
| IT2-009 | 権限別操作 | 作成者 | 自作グループ編集 | 正常 | グループ作成者が自グループを編集できること | グループ作成者 | 1. グループ作成者でログイン<br>2. 自身が作成したグループのテストケース編集画面にアクセス<br>3. 内容を変更して更新 | 編集・保存が正常に完了 |
| IT2-010 | 画面遷移 | 正常遷移 | 一覧→編集→詳細 | 正常 | 画面遷移が正常に動作すること | テストケースデータ存在、編集権限あり | 1. テストケース一覧で編集クリック<br>2. 編集画面が表示される<br>3. 編集して更新ボタンクリック<br>4. 詳細画面が表示される | 各画面が正常に表示され、データ整合性が維持される |
| IT2-011 | 画面遷移 | キャンセル | 変更破棄 | 正常 | キャンセル時に変更が破棄されること | フォーム編集中 | 1. 編集画面で内容を変更<br>2. キャンセルボタンをクリック<br>3. 詳細画面で確認 | 詳細画面へ遷移、変更は保存されず元の値が表示される |
| IT2-012 | 画面遷移 | ブラウザバック | クリーンアップ | 正常 | ブラウザバック時にクリーンアップ処理が実行されること | フォーム編集中 | 1. 編集画面で内容を変更<br>2. ブラウザの戻るボタンをクリック | クリーンアップ処理実行、前画面へ遷移 |
| IT2-013 | データ整合性 | 更新日時 | updated_at更新 | 正常 | 更新時にupdated_atが更新されること | テストケースデータ存在 | 1. テストケースを編集・保存<br>2. DBのupdated_atを確認 | updated_atが現在時刻に更新されている |
| IT2-014 | データ整合性 | 関連データ | 外部キー整合性 | 正常 | テスト内容追加時に外部キーが正しく設定されること | テストケースデータ存在 | 1. テスト内容行を追加して保存<br>2. tt_test_contentsのレコードを確認 | test_group_id, tidが正しく設定されている |
| IT2-015 | データ整合性 | ファイル番号 | file_no採番 | 正常 | 複数ファイルアップロード時にfile_noが重複なく採番されること | テストケースデータ存在 | 1. 複数ファイルを連続アップロード<br>2. tt_test_case_filesのfile_noを確認 | file_noが重複なく連番で採番されている |

### 異常系

| No | 大項目 | 中項目 | 小項目 | 正常/異常 | テスト観点 | 前提条件 | テスト手順 | 期待結果 |
|----|--------|--------|--------|-----------|-----------|----------|-----------|----------|
| IT2-E001 | セッション | セッション切れ | 編集中セッション切れ | 異常 | セッション切れ時に適切にエラー処理されること | 編集画面表示中 | 1. 編集画面を開いたまま長時間放置<br>2. セッションが切れた状態で更新ボタンをクリック | 認証エラー表示、ログイン画面へ誘導 |
| IT2-E002 | 同時編集 | 競合 | 削除済みデータ編集 | 異常 | 他ユーザー削除後に適切にエラー処理されること | 編集画面表示中 | 1. 編集画面を開く<br>2. 別ユーザーがテストケースを削除<br>3. 更新ボタンをクリック | 「データが存在しません」エラー表示 |
| IT2-E003 | ネットワーク | 切断 | 更新中ネットワーク切断 | 異常 | ネットワーク切断時に適切にエラー処理されること | 編集画面表示中 | 1. 編集中にネットワークを切断<br>2. 更新ボタンをクリック | 通信エラー表示、リトライ案内 |
| IT2-E004 | 大量データ | 性能 | 大量テスト内容更新 | 異常 | 大量データ更新時にタイムアウトしないこと | 編集画面表示中 | 1. テスト内容を100行追加<br>2. 更新ボタンをクリック | 正常に処理完了（またはタイムアウトエラー表示） |
| IT2-E005 | 権限変更 | 動的権限変更 | 編集中権限剥奪 | 異常 | 権限変更後に適切にエラー処理されること | 設計者権限で編集画面表示中 | 1. 設計者権限で編集画面を開く<br>2. 管理者が権限を閲覧者に変更<br>3. 更新ボタンをクリック | 403 Forbiddenエラー表示 |
| IT2-E006 | 権限アクセス | 不正アクセス | URLダイレクトアクセス | 異常 | 権限のないユーザーがURLダイレクトアクセス時にエラー表示されること | 権限のないユーザー | 1. 権限のないユーザーでログイン<br>2. 編集画面URLに直接アクセス | ForbiddenUI表示 |
| IT2-E007 | トランザクション | ロールバック | ファイルアップロード後DB失敗 | 異常 | DB更新失敗時にアップロード済みファイルがクリーンアップされること | 編集画面表示中 | 1. ファイルをアップロード<br>2. DB更新処理でエラー発生 | アップロード済みファイルがクリーンアップされる（または孤立ファイル対策実施） |
| IT2-E008 | トランザクション | ロールバック | 部分削除失敗 | 異常 | トランザクション失敗時にロールバックされること | 編集画面表示中 | 1. テスト内容削除を含む更新<br>2. トランザクション中にエラー発生 | ロールバックにより元の状態が維持される |

---

## ログテストについて

### 結論

**結合テスト（IT1/IT2）においてログ専用のテストケースは原則不要です。**

### 理由

| No | 理由 | 説明 |
|----|------|------|
| 1 | ログは副作用 | ログ出力の有無は機能の正常動作に影響しない |
| 2 | 単体テストで十分 | ログユーティリティの単体テストで出力機能を検証可能 |
| 3 | メンテナンスコスト | ログメッセージは変更頻度が高く、結合テストに含めると保守が困難 |

### 例外的にログテストが必要なケース

| ケース | 理由 | テスト観点 |
|--------|------|-----------|
| 監査ログ要件 | コンプライアンス上、特定操作のログ出力が必須 | 操作時に監査ログが出力されること |
| ログベースアラート | ログ出力をトリガーにした監視・アラートがある | エラー時に適切なログレベルで出力 |
| CloudWatch連携 | 本番環境でのログ転送が重要 | ログがCloudWatchに正しく送信される |
| デバッグ必須情報 | 障害調査に必要な情報がログに含まれる | ユーザーID、リクエストID等が含まれる |

### 推奨アプローチ

本システムの`logAPIEndpoint`、`logDatabaseQuery`は運用監視目的のため、結合テストでの検証対象外とし、単体テストレベルで担保します。

---

## 付録

### テストデータ要件

| データ種別 | 件数 | 説明 |
|-----------|------|------|
| テストグループ | 3件以上 | 管理者作成、設計者権限あり、権限なし |
| テストケース | 各グループ2件以上 | 正常データ、削除済みデータ |
| テスト内容 | 各テストケース3行以上 | 追加・削除テスト用 |
| ファイル | 各テストケース2件以上 | 制御仕様書、データフロー各1件以上 |
| ユーザー | 4名以上 | 管理者、テストマネージャー、設計者、閲覧者 |

### 使用ツール

| ツール | 用途 |
|--------|------|
| Jest + React Testing Library | フロントエンドIT1テスト |
| Supertest | API IT1テスト |
| Playwright / Cypress | IT2 E2Eテスト |

---

**作成日**: 2026-02-05
**対象画面**: テストケース編集画面 (`/testGroup/[groupId]/testCase/[tid]/edit`)
