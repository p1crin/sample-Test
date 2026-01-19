# CI/CDセットアップガイド

このドキュメントでは、GitHub Actionsを使用した自動デプロイの設定方法を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [GitHub Secretsの設定](#github-secretsの設定)
4. [環境(Environment)の設定](#環境environmentの設定)
5. [初回デプロイ手順](#初回デプロイ手順)
6. [デプロイフロー](#デプロイフロー)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### 自動デプロイの仕組み

```
┌─────────────────────────────────────────────────────────────┐
│  開発者が main ブランチに push                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions ワークフローが自動起動                        │
│  ├─ コードのチェックアウト                                    │
│  ├─ Dockerイメージのビルド                                   │
│  ├─ Amazon ECRへプッシュ                                     │
│  ├─ ECSタスク定義の更新                                      │
│  └─ ECSサービスのデプロイ                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  AWS ECS Fargateで新しいコンテナが起動                        │
│  └─ ヘルスチェック完了後、古いコンテナを停止                  │
└─────────────────────────────────────────────────────────────┘
```

### ワークフロー一覧

| ワークフロー | トリガー | 用途 |
|------------|---------|------|
| `deploy-production.yml` | `main`ブランチへのpush | メインアプリケーションのデプロイ |
| `deploy-batch.yml` | `batch/`配下の変更 | AWS Batchワーカーのデプロイ |

---

## 前提条件

### 完了している必要があるAWS設定

以下のリソースが`AWS_DEPLOYMENT_GUIDE.md`に従って作成されていること:

- ✅ VPC、サブネット、セキュリティグループ
- ✅ RDS PostgreSQL
- ✅ S3バケット
- ✅ ECRリポジトリ(`prooflink-app`, `prooflink-batch`)
- ✅ ECSクラスター(`prooflink-cluster`)
- ✅ ECSサービス(`prooflink-service`)
- ✅ ALB、Route 53、ACM証明書
- ✅ AWS Batch(ジョブ定義、ジョブキュー)
- ✅ IAMロール(ECS実行ロール、タスクロール)

### 必要な権限

GitHub Actionsで使用するIAMユーザーには以下の権限が必要:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "batch:DescribeJobDefinitions",
        "batch:RegisterJobDefinition"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::*:role/ecsTaskExecutionRole"
    }
  ]
}
```

---

## GitHub Secretsの設定

### 1. GitHubリポジトリの設定画面を開く

1. GitHubリポジトリのページを開く
2. **Settings** タブをクリック
3. 左サイドバーの **Secrets and variables** → **Actions** をクリック

### 2. 必要なSecretsを追加

以下のSecretsを **New repository secret** から追加します:

#### 必須のSecrets

| Secret名 | 説明 | 取得方法 |
|---------|------|---------|
| `AWS_ACCESS_KEY_ID` | AWSアクセスキーID | IAMユーザー作成時に取得 |
| `AWS_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー | IAMユーザー作成時に取得 |
| `DATABASE_URL` | PostgreSQL接続文字列 | `postgresql://user:pass@host:5432/db` |

#### AWS Secrets Managerから取得する場合

Secrets Managerに保存している場合、以下のようにワークフローで取得できます:

```yaml
- name: Get secrets from AWS Secrets Manager
  run: |
    aws secretsmanager get-secret-value \
      --secret-id prooflink/production/database \
      --query SecretString \
      --output text > .env
```

### 3. Secretsの確認

追加後、以下のSecretsが表示されていることを確認:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DATABASE_URL`

---

## 環境(Environment)の設定

### 1. Environmentの作成

1. **Settings** → **Environments** をクリック
2. **New environment** をクリック
3. Environment名: `production` と入力
4. **Configure environment** をクリック

### 2. 保護ルールの設定(オプション)

本番環境への意図しないデプロイを防ぐため、以下を設定:

#### デプロイ承認を必須にする

- **Required reviewers** にチェック
- 承認者を1名以上追加

#### ブランチ制限

- **Deployment branches** で `Selected branches` を選択
- `main` ブランチのみを許可

### 3. Environment URLの設定

- **Environment URL**: `https://prooflink.example.com`
- デプロイ後、このURLがGitHub Actionsのサマリーに表示されます

---

## 初回デプロイ手順

### Step 1: ローカルで動作確認

```bash
# 依存関係のインストール
npm install

# ローカルでビルドテスト
npm run build

# Dockerイメージのビルドテスト
docker build -t prooflink-app:test .
```

### Step 2: ワークフローファイルの確認

以下のファイルが存在することを確認:

- `.github/workflows/deploy-production.yml`
- `.github/workflows/deploy-batch.yml`

### Step 3: 環境変数の確認

ワークフローの環境変数を実際のAWSリソース名に合わせて修正:

```yaml
env:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: prooflink-app          # ECRリポジトリ名
  ECS_CLUSTER: prooflink-cluster         # ECSクラスター名
  ECS_SERVICE: prooflink-service         # ECSサービス名
  ECS_TASK_DEFINITION: prooflink-task    # タスク定義名
```

### Step 4: mainブランチにマージ

```bash
# 現在のブランチから main にマージ
git checkout main
git merge your-feature-branch
git push origin main
```

### Step 5: デプロイの監視

1. GitHubリポジトリの **Actions** タブを開く
2. 実行中のワークフローをクリック
3. 各ステップの進行状況を確認

### Step 6: デプロイ完了の確認

```bash
# ECSサービスの状態確認
aws ecs describe-services \
  --cluster prooflink-cluster \
  --services prooflink-service \
  --query 'services[0].deployments'

# 実行中のタスク確認
aws ecs list-tasks \
  --cluster prooflink-cluster \
  --service-name prooflink-service

# CloudWatchログ確認
aws logs tail /ecs/prooflink-app --follow
```

---

## デプロイフロー

### 通常のデプロイ(本番環境)

```bash
# 機能開発
git checkout -b feature/new-feature
# ... コーディング ...
git add .
git commit -m "feat: 新機能を追加"
git push origin feature/new-feature

# プルリクエストを作成してレビュー
# ↓
# レビュー承認後、main にマージ
# ↓
# GitHub Actions が自動的にデプロイを実行
```

### Batchワーカーのデプロイ

`batch/`ディレクトリ配下を変更して`main`にマージすると、自動的に`deploy-batch.yml`が実行されます。

### 手動デプロイ

緊急時や特定のコミットをデプロイする場合:

1. **Actions** タブを開く
2. **Deploy to Production** を選択
3. **Run workflow** をクリック
4. ブランチを選択して **Run workflow**

---

## トラブルシューティング

### デプロイが失敗する

#### 1. ECRへのプッシュエラー

**エラー例:**
```
Error: Cannot perform an interactive login from a non TTY device
```

**解決策:**
- `AWS_ACCESS_KEY_ID`と`AWS_SECRET_ACCESS_KEY`が正しく設定されているか確認
- IAMユーザーにECR権限があるか確認

#### 2. ECSタスク定義が見つからない

**エラー例:**
```
Error: Task definition not found: prooflink-task
```

**解決策:**
```bash
# タスク定義の存在確認
aws ecs list-task-definitions

# 存在しない場合、手動で初回作成が必要
# AWS_DEPLOYMENT_GUIDE.mdのECS設定を参照
```

#### 3. サービスの更新がタイムアウト

**エラー例:**
```
Error: Timed out waiting for service stability
```

**解決策:**
- ECSサービスのイベントログを確認
```bash
aws ecs describe-services \
  --cluster prooflink-cluster \
  --services prooflink-service \
  --query 'services[0].events[0:10]'
```
- ヘルスチェックの設定を確認(ALBターゲットグループ)
- コンテナのログを確認
```bash
aws logs tail /ecs/prooflink-app --follow
```

### デプロイ後にアプリケーションが起動しない

#### 環境変数の確認

ECSタスク定義で環境変数が正しく設定されているか確認:

```bash
aws ecs describe-task-definition \
  --task-definition prooflink-task \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

必須の環境変数:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET_NAME`(本番環境の場合)

#### コンテナログの確認

```bash
# 最新のログを取得
aws logs tail /ecs/prooflink-app --follow

# エラーのみフィルタ
aws logs filter-pattern /ecs/prooflink-app --filter-pattern "ERROR"
```

### データベース接続エラー

**エラー例:**
```
Error: Unable to connect to database
```

**確認項目:**
1. RDSのセキュリティグループがECSタスクからの接続を許可しているか
2. `DATABASE_URL`が正しいフォーマットか
   ```
   postgresql://username:password@hostname:5432/database_name
   ```
3. RDSがパブリックアクセス可能か、またはVPC内からアクセス可能か

### ロールバック

デプロイに失敗した場合、前のバージョンにロールバック:

```bash
# 前のタスク定義リビジョンを確認
aws ecs list-task-definitions --family-prefix prooflink-task

# 前のリビジョンにロールバック
aws ecs update-service \
  --cluster prooflink-cluster \
  --service prooflink-service \
  --task-definition prooflink-task:前のリビジョン番号
```

---

## ベストプラクティス

### 1. ブランチ戦略

```
main (本番環境)
  ↑
develop (ステージング環境・オプション)
  ↑
feature/* (機能開発)
```

### 2. コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/)を推奨:

```
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
style: コードフォーマット
refactor: リファクタリング
test: テスト追加
chore: ビルドプロセスやツールの変更
```

### 3. デプロイ前のチェックリスト

- [ ] ローカルで`npm run build`が成功する
- [ ] テストが全て通る(`npm test`)
- [ ] Lintエラーがない(`npm run lint`)
- [ ] データベースマイグレーションの必要性を確認
- [ ] 環境変数の追加・変更がないか確認
- [ ] `.env.example`を更新(新しい環境変数がある場合)

### 4. モニタリング

デプロイ後、以下を確認:

```bash
# ECSサービスの正常性
aws ecs describe-services \
  --cluster prooflink-cluster \
  --services prooflink-service

# CloudWatchメトリクス
# - CPU使用率
# - メモリ使用率
# - ターゲットグループのヘルスチェック

# アプリケーションログ
aws logs tail /ecs/prooflink-app --since 5m
```

---

## 参考資料

- [AWS Deployment Guide](./AWS_DEPLOYMENT_GUIDE.md) - AWS環境構築手順
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Amazon ECS Task Definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/latest/)
