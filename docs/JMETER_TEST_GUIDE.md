# JMeterテスト実施手順書

## 目次

1. [はじめに](#1-はじめに)
2. [前提条件](#2-前提条件)
3. [JMeterのインストールと起動](#3-jmeterのインストールと起動)
4. [共通設定](#4-共通設定)
5. [性能テスト（IT2_性能テスト）の実施手順](#5-性能テストit2_性能テストの実施手順)
6. [負荷テスト（IT2_負荷テスト）の実施手順](#6-負荷テストit2_負荷テストの実施手順)
7. [テスト結果の確認と記録](#7-テスト結果の確認と記録)
8. [CloudWatchによるサーバー側監視](#8-cloudwatchによるサーバー側監視)
9. [トラブルシューティング](#9-トラブルシューティング)

---

## 1. はじめに

### 本ドキュメントの目的

本ドキュメントは、IT2総合試験項目書（性能テスト・負荷テスト）に記載されたJMeter計測項目の実施手順を説明します。

### 対象テスト項目

| 試験項目書 | JMeter使用項目 |
|-----------|---------------|
| IT2_性能テスト | ST01-IT2-PT-1～PT-8, PT-14～PT-17 |
| IT2_負荷テスト | ST02-IT2-LT-1～LT-11 |

---

## 2. 前提条件

### 2.1 テスト対象環境

| 項目 | 値 |
|------|-----|
| 対象システム | ProofLink（AWS上のNext.jsアプリケーション） |
| アプリケーションURL | ALBのDNS名（開発環境）または `https://prooflink.example.com`（本番環境） |
| 構成 | ALB → ECS Fargate（プライベートサブネット） → RDS PostgreSQL |
| リージョン | ap-northeast-1（東京） |
| WAF | IP制限あり（テスト実施端末のIPを許可リストに追加すること） |

### 2.2 事前準備

| 準備項目 | 詳細 |
|---------|------|
| JMeter | Apache JMeter 5.6以上をインストール済み |
| Java | JDK 8以上（JMeter実行に必要） |
| ネットワーク | テスト実施端末からALBへHTTPS接続可能であること |
| WAF許可 | テスト実施端末のグローバルIPがWAFの許可リスト(`prooflink-allowed-ips`)に追加されていること |
| テストデータ | 試験項目書の前提条件に記載されたテストデータが投入済みであること |
| テストアカウント | 各テストに必要なユーザアカウントが作成済みであること |

### 2.3 テスト対象APIエンドポイント一覧

| API | メソッド | パス | 使用テスト項目 |
|-----|---------|------|---------------|
| 認証 | POST | `/api/auth/callback/credentials` | PT-16, 全負荷テスト（認証取得） |
| テストグループ一覧 | GET | `/api/test-groups` | PT-14, LT-1～LT-3, LT-7～LT-9 |
| テストグループ複製 | POST | `/api/test-groups/{groupId}` | PT-1～PT-4, LT-4, LT-5 |
| テストケース一覧 | GET | `/api/test-groups/{groupId}/cases` | PT-15, LT-8 |
| テスト集計 | GET | `/api/test-groups/{groupId}/report-data` | PT-5～PT-7, LT-6 |
| 日次レポート | GET | `/api/test-groups/{groupId}/daily-report-data` | PT-8 |
| エビデンスアップロード | POST | `/api/files/evidences` | PT-17, LT-8 |

---

## 3. JMeterのインストールと起動

### 3.1 インストール手順

1. [Apache JMeter公式サイト](https://jmeter.apache.org/download_jmeter.cgi) からバイナリをダウンロード
2. 任意のディレクトリに展開

```
# Windows
unzip apache-jmeter-5.6.3.zip -d C:\tools\

# macOS / Linux
tar -xzf apache-jmeter-5.6.3.tgz -C ~/tools/
```

### 3.2 起動方法

**GUIモード（テスト計画の作成・デバッグ用）:**

```
# Windows
C:\tools\apache-jmeter-5.6.3\bin\jmeter.bat

# macOS / Linux
~/tools/apache-jmeter-5.6.3/bin/jmeter
```

**CLIモード（テスト実行用 - 推奨）:**

```
jmeter -n -t test-plan.jmx -l result.jtl -e -o report/
```

| オプション | 説明 |
|-----------|------|
| `-n` | Non-GUIモード |
| `-t` | テスト計画ファイル |
| `-l` | 結果ファイル出力先 |
| `-e` | テスト後にHTMLレポート生成 |
| `-o` | HTMLレポート出力ディレクトリ |

> **注意**: 負荷テストの実行時は必ずCLIモードを使用してください。GUIモードでは正確な結果が得られません。

### 3.3 推奨プラグイン

持続負荷テスト・スパイクテスト（LT-7～LT-9）では **JMeter Plugins Manager** から以下をインストールしてください。

| プラグイン | 用途 | 使用テスト項目 |
|-----------|------|---------------|
| Ultimate Thread Group | 段階的な負荷パターンの設定 | LT-9（スパイクテスト） |
| 3 Basic Graphs | レスポンスタイム等のリアルタイムグラフ表示 | 全項目 |

**インストール手順:**
1. [JMeter Plugins Manager](https://jmeter-plugins.org/install/Install/) から `jmeter-plugins-manager-X.X.jar` をダウンロード
2. `lib/ext/` ディレクトリにコピー
3. JMeter再起動後、メニュー「Options」→「Plugins Manager」から必要なプラグインをインストール

---

## 4. 共通設定

### 4.1 テスト計画の基本構成

全てのテスト計画で以下の構成を基本とします。

```
Test Plan
├── User Defined Variables        ← 環境変数の定義
├── HTTP Cookie Manager           ← セッション管理
├── HTTP Header Manager           ← 共通ヘッダー
├── setUp Thread Group            ← 認証トークン取得
│   └── HTTP Request (Login)
│       └── JSON Extractor        ← トークン抽出
├── Thread Group                  ← メインテスト
│   └── HTTP Request (API呼び出し)
├── View Results Tree             ← デバッグ用（GUI時のみ）
└── Summary Report / Aggregate Report  ← 結果サマリ
```

### 4.2 User Defined Variables（環境変数の設定）

テスト計画に「User Defined Variables」を追加し、以下を設定します。

| 変数名 | 開発環境の値（例） | 本番環境の値（例） |
|--------|-------------------|-------------------|
| `BASE_URL` | `prooflink-alb-XXXXX.ap-northeast-1.elb.amazonaws.com` | `prooflink.example.com` |
| `PROTOCOL` | `http` | `https` |
| `PORT` | `80` | `443` |
| `LOGIN_EMAIL` | `admin@example.com` | `admin@example.com` |
| `LOGIN_PASSWORD` | `(テスト用パスワード)` | `(テスト用パスワード)` |

### 4.3 認証トークンの取得（setUp Thread Group）

ProofLinkはNextAuth.js（JWT）による認証を使用しています。全APIリクエストに先立ち、ログインしてセッションCookieを取得する必要があります。

#### Step 1: setUp Thread Groupの作成

Test Plan右クリック → Add → Threads → setUp Thread Group

| 項目 | 値 |
|------|-----|
| Number of Threads | 1 |
| Ramp-Up Period | 0 |
| Loop Count | 1 |

#### Step 2: CSRFトークン取得リクエスト

setUp Thread Group右クリック → Add → Sampler → HTTP Request

| 項目 | 値 |
|------|-----|
| Name | Get CSRF Token |
| Protocol | `${PROTOCOL}` |
| Server Name | `${BASE_URL}` |
| Port | `${PORT}` |
| Method | GET |
| Path | `/api/auth/csrf` |

**JSON Extractorの追加** (Get CSRF Token右クリック → Add → Post Processors → JSON Extractor):

| 項目 | 値 |
|------|-----|
| Names of created variables | `csrfToken` |
| JSON Path expressions | `$.csrfToken` |

#### Step 3: ログインリクエスト

setUp Thread Group右クリック → Add → Sampler → HTTP Request

| 項目 | 値 |
|------|-----|
| Name | Login |
| Protocol | `${PROTOCOL}` |
| Server Name | `${BASE_URL}` |
| Port | `${PORT}` |
| Method | POST |
| Path | `/api/auth/callback/credentials` |
| Content-Type | `application/x-www-form-urlencoded` |
| Follow Redirects | チェックを入れる |

**Parametersタブに以下を追加:**

| Name | Value |
|------|-------|
| `csrfToken` | `${csrfToken}` |
| `email` | `${LOGIN_EMAIL}` |
| `password` | `${LOGIN_PASSWORD}` |
| `json` | `true` |

#### Step 4: HTTP Cookie Managerの追加

Test Plan直下に追加します（setUp Thread GroupとThread Groupの両方で共有）。

Test Plan右クリック → Add → Config Element → HTTP Cookie Manager

| 項目 | 値 |
|------|-----|
| Clear cookies each iteration | チェックしない |
| Implementation | HC4CookieHandler |

> **重要**: HTTP Cookie ManagerはTest Plan直下に配置して、setUp Thread Groupで取得したセッションCookieがメインのThread Groupでも利用されるようにしてください。

### 4.4 HTTP Header Manager（共通ヘッダー）

Test Plan右クリック → Add → Config Element → HTTP Header Manager

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

---

## 5. 性能テスト（IT2_性能テスト）の実施手順

### 5.1 テストグループ複製 レスポンスタイム（ST01-IT2-PT-1～PT-3）

この項目ではテストグループ複製APIのレスポンスタイムを計測します。各テストケースを5回実行し、平均値を記録します。

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 1 |
| Ramp-Up Period | 0 |
| Loop Count | 5 |

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Name | テストグループ複製 |
| Method | POST |
| Path | `/api/test-groups/${groupId}` |

**リクエストボディ（Body Data）:**

```json
{
  "action": "duplicate"
}
```

> **注意**: `groupId` は試験項目の前提条件に応じて適切なグループIDを指定してください。

#### 判定基準

| テストID | テスト小項目 | 判定基準 |
|---------|------------|---------|
| PT-1 | 小規模（50件） | レスポンスタイム **3秒以内** |
| PT-2 | 中規模（200件） | レスポンスタイム **10秒以内** |
| PT-3 | 大規模（500件） | レスポンスタイム **30秒以内** |

#### 結果の確認

JMeterの「Aggregate Report」リスナーで以下を確認します。

| 確認項目 | 確認場所 |
|---------|---------|
| 平均レスポンスタイム | Aggregate ReportのAverage列 |
| 最大レスポンスタイム | Aggregate ReportのMax列 |
| エラー有無 | Aggregate ReportのError%列（0%であること） |

### 5.2 テストグループ集計 レスポンスタイム（ST01-IT2-PT-5～PT-7）

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 1 |
| Ramp-Up Period | 0 |
| Loop Count | 5 |

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Name | テスト集計 |
| Method | GET |
| Path | `/api/test-groups/${groupId}/report-data` |

#### 判定基準

| テストID | テスト小項目 | 判定基準 |
|---------|------------|---------|
| PT-5 | 小規模（50件） | レスポンスタイム **1秒以内** |
| PT-6 | 中規模（200件） | レスポンスタイム **3秒以内** |
| PT-7 | 大規模（500件） | レスポンスタイム **5秒以内** |

### 5.3 日次レポート レスポンスタイム（ST01-IT2-PT-8）

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Name | 日次レポート |
| Method | GET |
| Path | `/api/test-groups/${groupId}/daily-report-data` |

#### 判定基準

- レスポンスタイム **3秒以内**

### 5.4 テストグループ一覧 レスポンスタイム（ST01-IT2-PT-14）

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Name | テストグループ一覧 |
| Method | GET |
| Path | `/api/test-groups` |

#### 判定基準

- レスポンスタイム **2秒以内**（テストグループ100件）

### 5.5 テストケース一覧 レスポンスタイム（ST01-IT2-PT-15）

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Name | テストケース一覧 |
| Method | GET |
| Path | `/api/test-groups/${groupId}/cases` |

#### 判定基準

- レスポンスタイム **3秒以内**（テストケース500件）

### 5.6 認証処理 レスポンスタイム（ST01-IT2-PT-16）

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 1 |
| Ramp-Up Period | 0 |
| Loop Count | 5 |

> **注意**: この項目では認証処理自体のレスポンスタイムを計測するため、setUp Thread Groupとは別に、メインThread Group内にログインリクエストを配置してください。

#### HTTP Request設定

CSRFトークン取得とログインの2つのリクエストをTransaction Controllerでグループ化し、合計時間を計測します。

**Transaction Controller設定:**

| 項目 | 値 |
|------|-----|
| Name | 認証処理 |
| Generate parent sample | チェックする |

**配下のリクエストは [4.3 認証トークンの取得](#43-認証トークンの取得setup-thread-group) と同じ構成にします。**

#### 判定基準

- 認証処理全体のレスポンスタイム **2秒以内**

### 5.7 ファイルアップロード レスポンスタイム（ST01-IT2-PT-17）

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Name | エビデンスアップロード |
| Method | POST |
| Path | `/api/files/evidences` |
| Content-Type | （自動設定のため削除） |

**Files Uploadタブの設定:**

| File Path | Parameter Name | MIME Type |
|-----------|---------------|-----------|
| (10MBの画像ファイルパス) | `file` | `image/png` |

**パラメータ（Parameters）:**

| Name | Value |
|------|-------|
| `testResultId` | `(対象テスト結果ID)` |

> **注意**: ファイルアップロードの場合、HTTP Header ManagerのContent-Typeを削除するか、このリクエスト用に別のHTTP Header Manager（Content-Typeなし）を配置してください。JMeterがmultipart/form-dataを自動設定します。

#### 判定基準

- レスポンスタイム **5秒以内**（10MBファイル）

---

## 6. 負荷テスト（IT2_負荷テスト）の実施手順

### 6.1 同時接続テスト - テストグループ一覧（ST02-IT2-LT-1～LT-3）

複数ユーザが同時にテストグループ一覧にアクセスするテストです。

#### テストデータ（CSVファイル）

各スレッドで異なるユーザアカウントを使用するため、CSV Data Set Configを使用します。

**ファイル名: `users.csv`**

```csv
email,password
user01@example.com,Password01
user02@example.com,Password02
user03@example.com,Password03
...
user50@example.com,Password50
```

#### CSV Data Set Config

Thread Group右クリック → Add → Config Element → CSV Data Set Config

| 項目 | 値 |
|------|-----|
| Filename | `users.csv` のフルパス |
| Variable Names | `email,password` |
| Delimiter | `,` |
| Recycle on EOF | True |
| Stop Thread on EOF | False |
| Sharing mode | All threads |

#### Thread Group設定

| テストID | Number of Threads | Ramp-Up Period | Loop Count |
|---------|-------------------|----------------|------------|
| LT-1 | 10 | 1秒 | 1 |
| LT-2 | 30 | 3秒 | 1 |
| LT-3 | 50 | 5秒 | 1 |

#### テスト計画の構成

```
Thread Group
├── CSV Data Set Config (users.csv)
├── HTTP Cookie Manager
├── Transaction Controller: 認証
│   ├── HTTP Request: Get CSRF Token
│   │   └── JSON Extractor (csrfToken)
│   └── HTTP Request: Login (email=${email}, password=${password})
└── HTTP Request: テストグループ一覧 (GET /api/test-groups)
    └── Response Assertion (HTTP Status = 200)
```

#### 判定基準

| テストID | スレッド数 | 95パーセンタイル | エラーレート |
|---------|-----------|----------------|------------|
| LT-1 | 10 | 3秒以内 | 0% |
| LT-2 | 30 | 5秒以内 | 1%未満 |
| LT-3 | 50 | 10秒以内 | 5%未満 |

### 6.2 同時接続テスト - テストグループ複製（ST02-IT2-LT-4, LT-5）

#### LT-4: 異なるテストグループの同時複製

各スレッドが異なるテストグループを複製します。

**ファイル名: `groups.csv`**

```csv
email,password,groupId
user01@example.com,Password01,1
user02@example.com,Password02,2
user03@example.com,Password03,3
```

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 3 |
| Ramp-Up Period | 0（同時実行） |
| Loop Count | 1 |

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Method | POST |
| Path | `/api/test-groups/${groupId}` |

```json
{
  "action": "duplicate"
}
```

#### 判定基準

- 全リクエストがHTTPステータス200で完了すること
- デッドロックが発生しないこと（エラーログを確認）

#### LT-5: 同一テストグループの同時複製

3ユーザが同一のgroupIdに対して同時に複製を実行します。

| 項目 | 値 |
|------|-----|
| Number of Threads | 3 |
| Ramp-Up Period | 0 |
| Loop Count | 1 |

**全スレッドで同一の `groupId` を使用します。**

#### 判定基準

- 全リクエストが完了すること（成功またはエラー）
- データ不整合が発生しないこと（DB確認）

### 6.3 同時接続テスト - テストグループ集計（ST02-IT2-LT-6）

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 10 |
| Ramp-Up Period | 0 |
| Loop Count | 1 |

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Method | GET |
| Path | `/api/test-groups/${groupId}/report-data` |

> `groupId` にはテストケース500件のテストグループIDを指定します。

#### 判定基準

- 95パーセンタイルレスポンスタイム **5秒以内**
- 全リクエストの集計結果が同一であること

### 6.4 持続負荷テスト - テストグループ一覧 30分間（ST02-IT2-LT-7）

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 10 |
| Ramp-Up Period | 10秒 |
| Loop Count | Forever（無限ループ） |
| Duration (seconds) | 1800（30分） |

「Scheduler」にチェックを入れ、Durationに `1800` を設定します。

#### テスト計画の構成

```
Thread Group (10 threads, 1800s duration)
├── CSV Data Set Config (users.csv)
├── HTTP Cookie Manager
├── Once Only Controller            ← 認証は各スレッドで1回のみ
│   ├── HTTP Request: Get CSRF Token
│   └── HTTP Request: Login
├── HTTP Request: テストグループ一覧
│   └── Response Assertion (HTTP Status = 200)
├── Constant Timer (1000ms)         ← リクエスト間隔
└── Aggregate Report
```

> **Once Only Controller**: 各スレッドの最初のイテレーションでのみ認証を実行し、以降はCookieを再利用します。

#### 判定基準

- 30分間を通じて95パーセンタイルレスポンスタイム **5秒以内**を維持
- エラーレート **1%未満**
- CloudWatchでメモリリークの兆候がないこと

### 6.5 持続負荷テスト - 混合シナリオ 60分間（ST02-IT2-LT-8）

複数のAPIを比率を変えて同時に実行する混合シナリオテストです。

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 20 |
| Ramp-Up Period | 20秒 |
| Loop Count | Forever |
| Duration (seconds) | 3600（60分） |

#### テスト計画の構成

Throughput Controllerを使用して各APIの実行比率を制御します。

```
Thread Group (20 threads, 3600s duration)
├── CSV Data Set Config (users.csv)
├── HTTP Cookie Manager
├── Once Only Controller
│   ├── HTTP Request: Get CSRF Token
│   └── HTTP Request: Login
├── Throughput Controller (40% - テストグループ一覧)
│   └── HTTP Request: GET /api/test-groups
├── Throughput Controller (30% - テストケース一覧)
│   └── HTTP Request: GET /api/test-groups/${groupId}/cases
├── Throughput Controller (20% - 集計)
│   └── HTTP Request: GET /api/test-groups/${groupId}/report-data
├── Throughput Controller (10% - ファイルアップロード)
│   └── HTTP Request: POST /api/files/evidences
├── Constant Timer (500ms)
└── Aggregate Report
```

**Throughput Controller設定:**

| 項目 | 値 |
|------|-----|
| Based on | Percent Executions |
| Throughput | 各比率（40, 30, 20, 10） |

#### 判定基準

- 60分間を通じてシステムが安定動作すること
- 95パーセンタイルレスポンスタイムが各API基準値以内であること
- ECSタスクの再起動が発生しないこと（CloudWatchで確認）
- RDSのCPU使用率が80%を超えないこと（RDS Performance Insightsで確認）

### 6.6 スパイクテスト（ST02-IT2-LT-9）

急激な負荷増加に対するシステムの耐性を確認します。

> **前提**: JMeter Plugins Managerから「Ultimate Thread Group」プラグインをインストール済みであること。

#### Ultimate Thread Group設定

Test Plan右クリック → Add → Threads → jp@gc - Ultimate Thread Group

以下のスケジュールを設定します。

| Row | Start Threads Count | Initial Delay (sec) | Startup Time (sec) | Hold Load For (sec) | Shutdown Time (sec) |
|-----|---------------------|--------------------|--------------------|---------------------|---------------------|
| 1 | 5 | 0 | 5 | 60 | 0 |
| 2 | 45 | 65 | 5 | 60 | 0 |
| 3 | -45 | 130 | 5 | 0 | 0 |
| 4 | 5 | 130 | 0 | 60 | 5 |

**負荷パターン:**

```
スレッド数
50 |          ┌──────────────────┐
   |          │                  │
   |          │                  │
 5 |──────────┘                  └──────────────────
   └─────────────────────────────────────────────────→ 時間
   0s        65s               130s               195s
   (通常)    (急増)            (減少)             (通常復帰)
```

#### 判定基準

- 急激な負荷増加時にHTTP 5xxエラーが発生しないこと
- 負荷軽減後にレスポンスタイムが通常レベルに復帰すること
- ALBのヘルスチェックが失敗しないこと（CloudWatchで確認）

### 6.7 バッチ処理中の負荷テスト（ST02-IT2-LT-10）

#### 実施手順

1. **バッチ処理の開始**: AWS Batchコンソールからテストインポートバッチ（テストケース500件）を実行開始
2. **バッチ実行中にJMeterテストを開始**: バッチが実行中であることを確認後、JMeterテストを実行

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 10 |
| Ramp-Up Period | 10秒 |
| Loop Count | Forever |
| Duration (seconds) | 300（5分間 - バッチ完了まで） |

#### 判定基準

- Web操作のレスポンスタイムがバッチ非実行時と比較して **2倍以内**
- Web操作でエラーが発生しないこと

> **補足**: AWS Batchは別コンテナで実行されるため影響は限定的ですが、RDSへの負荷が重なる可能性があるため確認が必要です。

### 6.8 DB接続プールテスト（ST02-IT2-LT-11）

#### Thread Group設定

| 項目 | 値 |
|------|-----|
| Number of Threads | 50 |
| Ramp-Up Period | 5秒 |
| Loop Count | 10 |

#### HTTP Request設定

| 項目 | 値 |
|------|-----|
| Method | GET |
| Path | `/api/test-groups` |

**Constant Timer: なし（高頻度リクエストのため）**

#### 判定基準

- 接続プール枯渇時に適切なエラーメッセージが返されること
- システム全体がハングアップしないこと
- 負荷軽減後にDB接続が正常に回復すること

---

## 7. テスト結果の確認と記録

### 7.1 JMeterリスナーの活用

テスト計画に以下のリスナーを追加して結果を確認します。

| リスナー | 用途 | 追加方法 |
|---------|------|---------|
| Aggregate Report | レスポンスタイムの統計（平均、中央値、90%ile、95%ile、99%ile） | Thread Group右クリック → Add → Listener → Aggregate Report |
| Summary Report | サンプル数、平均、最小、最大、エラー率 | Thread Group右クリック → Add → Listener → Summary Report |
| View Results Tree | 個別リクエスト/レスポンスの詳細（デバッグ用） | Thread Group右クリック → Add → Listener → View Results Tree |

### 7.2 HTMLレポートの生成

CLIモード実行時に `-e -o` オプションでHTMLレポートを自動生成できます。

```bash
jmeter -n -t test-plan.jmx -l result.jtl -e -o report_$(date +%Y%m%d_%H%M%S)/
```

既存の結果ファイルからHTMLレポートを生成する場合:

```bash
jmeter -g result.jtl -o report/
```

### 7.3 試験項目書への記録

各テスト項目の実行結果を試験項目書に記録する際は、以下の情報を含めてください。

| 記録項目 | 取得元 |
|---------|--------|
| 平均レスポンスタイム | Aggregate Report → Average |
| 95パーセンタイルレスポンスタイム | Aggregate Report → 95% Line |
| 最大レスポンスタイム | Aggregate Report → Max |
| エラーレート | Aggregate Report → Error % |
| スループット | Aggregate Report → Throughput |
| 実施日時 | テスト実行日時 |
| 実施環境 | 開発環境 / 本番環境 |
| 判定（OK/NG） | 判定基準との比較結果 |

### 7.4 性能テスト（5回計測）の結果記録例

性能テスト項目（PT-1～PT-8, PT-14～PT-17）は5回計測の平均値で判定します。

```
テストID: ST01-IT2-PT-1
計測1回目: 2,450ms
計測2回目: 2,380ms
計測3回目: 2,510ms
計測4回目: 2,320ms
計測5回目: 2,490ms
平均: 2,430ms
判定基準: 3,000ms以内
判定: OK
```

---

## 8. CloudWatchによるサーバー側監視

負荷テスト実行中は、AWSマネジメントコンソールでサーバー側のメトリクスを監視してください。

### 8.1 ECSメトリクス

**確認手順:**
1. AWSコンソール → CloudWatch → メトリクス → ECS
2. クラスター名 `prooflink-dev-cluster` または `prooflink-prod-cluster` を選択

| メトリクス | 確認内容 | 異常の目安 |
|-----------|---------|-----------|
| CPUUtilization | CPU使用率 | 80%超が継続 |
| MemoryUtilization | メモリ使用率 | 80%超が継続（メモリリークの兆候） |
| RunningTaskCount | 稼働タスク数 | 設定値より減少（タスク再起動の兆候） |

### 8.2 RDSメトリクス

**確認手順:**
1. AWSコンソール → RDS → データベース → `prooflink-dev-db` または `prooflink-prod-db`
2. 「モニタリング」タブ

| メトリクス | 確認内容 | 異常の目安 |
|-----------|---------|-----------|
| CPUUtilization | CPU使用率 | LT-8: 80%を超えないこと |
| DatabaseConnections | 接続数 | Prismaの接続プール上限に近い場合注意 |
| FreeableMemory | 利用可能メモリ | 急激な減少 |
| ReadIOPS / WriteIOPS | I/O操作 | 通常時の10倍以上 |

**Performance Insights（本番環境）:**
1. RDS → Performance Insights
2. 「Top SQL」で負荷の高いクエリを特定

### 8.3 ALBメトリクス

**確認手順:**
1. AWSコンソール → EC2 → ロードバランサー → `prooflink-alb`
2. 「モニタリング」タブ

| メトリクス | 確認内容 | 異常の目安 |
|-----------|---------|-----------|
| HTTPCode_Target_5XX_Count | 5xxエラー数 | LT-9: 0であること |
| TargetResponseTime | ターゲットレスポンスタイム | 急激な増加 |
| HealthyHostCount | 正常ホスト数 | LT-9: 減少しないこと |
| RequestCount | リクエスト数 | 想定スループットと一致 |

---

## 9. トラブルシューティング

### 9.1 WAFによるブロック

**症状**: 全リクエストがHTTP 403で失敗する

**原因**: テスト実施端末のIPがWAF許可リストに未登録

**解決策**:
1. AWSコンソール → WAF & Shield → IP sets → `prooflink-allowed-ips`
2. テスト実施端末のグローバルIPをCIDR形式（例: `203.0.113.10/32`）で追加

### 9.2 認証エラー

**症状**: ログインリクエストが失敗する、またはAPIリクエストが401を返す

**確認ポイント**:
- CSRFトークン取得リクエストのレスポンスを「View Results Tree」で確認
- ログインリクエストのレスポンスにSet-Cookieヘッダーが含まれているか確認
- HTTP Cookie Managerが正しく設定されているか確認（Test Plan直下に配置）

### 9.3 SSL/TLS関連エラー

**症状**: HTTPS接続時に `javax.net.ssl.SSLException` が発生する

**解決策**: JMeter起動時にSSL検証をスキップするプロパティを設定

```bash
jmeter -Jhttps.use.cached.ssl.context=false -n -t test-plan.jmx -l result.jtl
```

または `jmeter.properties` に以下を追加:

```properties
https.use.cached.ssl.context=false
```

### 9.4 JMeterのメモリ不足

**症状**: 長時間テスト（LT-7, LT-8）中に `java.lang.OutOfMemoryError` が発生する

**解決策**: JMeterのヒープサイズを増加

`bin/jmeter` (Linux/Mac) または `bin/jmeter.bat` (Windows) を編集:

```bash
# デフォルト: 1g → 4gに変更
HEAP="-Xms1g -Xmx4g"
```

また、長時間テストでは以下のリスナーを無効化してメモリを節約してください:
- View Results Tree（全リクエストの詳細を保持するため大量メモリ消費）
- Graph Results

### 9.5 結果ファイルが大きくなりすぎる

**症状**: 長時間テストで `.jtl` ファイルが数GBに膨らむ

**解決策**: `jmeter.properties` で保存内容を制限

```properties
jmeter.save.saveservice.output_format=csv
jmeter.save.saveservice.response_data=false
jmeter.save.saveservice.samplerData=false
jmeter.save.saveservice.requestHeaders=false
jmeter.save.saveservice.responseHeaders=false
```

---

**作成日**: 2026-02-26
**対象システム**: ProofLink
**対象試験項目書**: IT2_総合試験項目書_性能テスト, IT2_総合試験項目書_負荷テスト
