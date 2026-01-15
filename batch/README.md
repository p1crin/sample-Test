# Test Case DB バッチジョブ

このディレクトリには、AWS Batchで実行するバッチジョブが含まれています。

## 概要

- **ユーザインポート**: CSVファイルからユーザデータをインポート
- **テストインポート**: CSVファイルからテストケースとテスト結果をインポート（今後実装予定）

## ディレクトリ構成

```
batch/
├── src/
│   ├── types/              # 型定義
│   │   └── user-import.types.ts
│   ├── utils/              # ユーティリティ
│   │   ├── s3-client.ts    # S3操作
│   │   ├── csv-parser.ts   # CSV解析
│   │   └── password-hash.ts # パスワードハッシュ
│   └── user-import.ts      # ユーザインポートメイン処理
├── Dockerfile              # AWS Batch用Dockerイメージ
├── package.json
├── tsconfig.json
└── README.md
```

## ユーザインポート

### CSV フォーマット

CSVファイルは以下のカラムを含む必要があります:

| カラム名 | 説明 | 必須 | 備考 |
|---------|------|------|------|
| id | ユーザID | - | 新規作成時は空、更新時は既存のID |
| name | 名前 | ✓ | |
| email | メールアドレス | ✓ | 重複不可 |
| user_role | ユーザロール | ✓ | 0: システム管理者, 1: テスト管理者, 2: 一般 |
| department | 部署 | - | |
| company | 会社 | - | |
| password | パスワード | △ | 新規作成時は必須、更新時は変更する場合のみ指定 |

### CSV サンプル

```csv
id,name,email,user_role,department,company,password
,山田太郎,yamada@example.com,1,開発部,株式会社ABC,password123
,佐藤花子,sato@example.com,2,品質保証部,株式会社ABC,securepass
1,鈴木一郎,suzuki@example.com,0,IT部,株式会社ABC,
```

### 実行方法

#### ローカルでの実行（開発・テスト用）

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な環境変数を設定

# Prisma Clientの生成
npx prisma generate

# TypeScriptのビルド
npm run build

# 実行
npm run user-import
```

#### AWS Batchでの実行

1. **Dockerイメージのビルド**

```bash
# イメージのビルド
docker build -t testcasedb-batch:latest .

# ECRにプッシュ（事前にECRリポジトリを作成）
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com
docker tag testcasedb-batch:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/testcasedb-batch:latest
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/testcasedb-batch:latest
```

2. **AWS Batch ジョブ定義の作成**

AWS コンソールまたはCLIでジョブ定義を作成します。

環境変数の設定例:
```json
{
  "environment": [
    {"name": "DATABASE_URL", "value": "postgresql://..."},
    {"name": "AWS_REGION", "value": "ap-northeast-1"},
    {"name": "INPUT_S3_BUCKET", "value": "your-bucket"},
    {"name": "INPUT_S3_KEY", "value": "user-import/users.csv"},
    {"name": "OUTPUT_S3_BUCKET", "value": "your-bucket"},
    {"name": "EXECUTOR_NAME", "value": "batch-system"}
  ]
}
```

3. **ジョブの実行**

AWS Batchコンソールまたはアプリケーションからジョブを実行します。

### インポート処理

**トランザクション方式で全件成功 or 全件ロールバック**

1. **処理開始**: `tt_import_results`に`import_status=0`（実施中）でレコード作成
2. **S3からCSVを読み込み**: 指定されたCSVファイルを取得
3. **事前バリデーション**: 全行をチェック
   - 必須項目チェック（名前、メール、ロール、新規時のパスワード）
   - 形式チェック（メールアドレス、ロール値、ユーザID）
   - **エラーがあれば実行せずに終了**、エラー詳細を`tt_import_results`に記録
4. **トランザクション実行**: 全ユーザを一括処理
   - **新規ユーザ** (IDが空): ユーザを新規作成
   - **既存ユーザ** (IDあり): ユーザ情報を更新
   - メールアドレスの重複チェック
   - **1件でもエラーが発生したら全件ロールバック**
5. **結果をS3に出力**:
   - JSON形式のサマリ (`result-{timestamp}.json`)
   - CSV形式の詳細結果 (`result-{timestamp}.csv`)
6. **DBレコードを更新**:
   - 全件成功: `import_status=1`（成功）
   - エラー発生: `import_status=2`（エラー）、エラー詳細を`message`に記録

### import_status

| 値 | 状態 | 説明 |
|---|------|------|
| 0 | 実施中 | インポート処理を実行中 |
| 1 | 成功 | 全件正常にインポート完了 |
| 2 | エラー | バリデーションエラーまたはDB実行エラー |

### import_type

| 値 | 種別 |
|---|------|
| 1 | テストケースインポート |
| 2 | ユーザインポート |

### エラーハンドリング

**バリデーションエラー（実行前）**:
- CSVの形式や必須項目のチェック
- エラーがあれば実行せず、全エラーを`message`に記録

**DB実行エラー（トランザクション内）**:
- メールアドレスの重複
- ユーザIDが存在しない
- データベース制約違反
- **1件でもエラーが発生したら全件ロールバック**

**エラーメッセージ例**:
```
バリデーションエラーが3件発生したため実行されませんでした:
- 3行目: メールアドレスの形式が不正です
- 5行目: 新規ユーザの場合、パスワードは必須です
- 12行目: ユーザロールは0, 1, 2のいずれかである必要があります
```

または

```
15行目の処理中にエラーが発生したため全件ロールバックしました:
- 15行目: メールアドレス "test@example.com" は既に使用されています
```

### 出力結果

#### JSON サマリ (`result-{timestamp}.json`)

**成功時**:
```json
{
  "totalRows": 100,
  "successCount": 100,
  "errorCount": 0,
  "createdCount": 50,
  "updatedCount": 50,
  "skippedCount": 0,
  "startedAt": "2024-01-15T10:00:00.000Z",
  "completedAt": "2024-01-15T10:05:00.000Z",
  "results": [
    {
      "row": 2,
      "email": "yamada@example.com",
      "name": "山田太郎",
      "success": true,
      "operation": "created"
    },
    ...
  ]
}
```

**エラー時**:
```json
{
  "error": "バリデーションエラーが3件発生したため実行されませんでした:\n- 3行目: メールアドレスの形式が不正です\n- 5行目: 新規ユーザの場合、パスワードは必須です\n- 12行目: ユーザロールは0, 1, 2のいずれかである必要があります",
  "errors": [
    "3行目: メールアドレスの形式が不正です",
    "5行目: 新規ユーザの場合、パスワードは必須です",
    "12行目: ユーザロールは0, 1, 2のいずれかである必要があります"
  ]
}
```

#### CSV 詳細結果 (`result-{timestamp}.csv`)

**成功時のみ出力**:
```csv
行番号,メールアドレス,名前,結果,操作,エラー詳細
2,yamada@example.com,山田太郎,成功,新規作成,
3,sato@example.com,佐藤花子,成功,新規作成,
4,tanaka@example.com,田中次郎,成功,更新,
```

## アプリケーションからの実行

### 環境変数設定

メインアプリケーションの`.env`に以下を追加:

```bash
# AWS Configuration
AWS_REGION=ap-northeast-1

# S3 Configuration
S3_IMPORT_BUCKET=your-import-bucket-name

# AWS Batch Configuration
AWS_BATCH_JOB_QUEUE=your-job-queue-arn
AWS_BATCH_USER_IMPORT_JOB_DEFINITION=your-user-import-job-definition-arn
```

### 実行フロー

1. **ユーザインポート画面にアクセス** (`/user-import`)
   - システム管理者のみアクセス可能

2. **CSVファイルを選択してアップロード**
   - `POST /api/batch/upload-url` でプリサインドURL取得
   - ブラウザから直接S3にアップロード

3. **バッチジョブを起動**
   - `POST /api/batch/user-import` でAWS Batchジョブ起動
   - ジョブIDを受け取り

4. **ジョブステータスを監視**
   - `GET /api/batch/status/[jobId]` で5秒ごとにポーリング
   - ジョブステータス: SUBMITTED → PENDING → RUNNABLE → STARTING → RUNNING → SUCCEEDED/FAILED

5. **インポート結果を確認**
   - `GET /api/import-results` でインポート履歴を取得
   - `tt_import_results`テーブルの`message`にエラー詳細が記録

### 実装済みAPI

| エンドポイント | メソッド | 説明 |
|--------------|---------|------|
| `/api/batch/upload-url` | POST | S3プリサインドURL生成 |
| `/api/batch/user-import` | POST | ユーザインポートジョブ起動 |
| `/api/batch/status/[jobId]` | GET | ジョブステータス取得 |
| `/api/import-results` | GET | インポート結果履歴取得 |

## 今後の拡張

- テストインポートバッチの実装
- エラーリトライ機能
- 並列処理の最適化
- インポート進捗の監視機能
