# CI/CDセットアップガイド(GitLab版)

このドキュメントでは、GitLab CI/CDを使用した客先AWS環境への自動デプロイの設定方法を説明します。

## 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [GitLab CI/CD変数の設定](#gitlab-cicd変数の設定)
4. [IAMユーザーの作成](#iamユーザーの作成)
5. [初回デプロイ手順](#初回デプロイ手順)
6. [デプロイフロー](#デプロイフロー)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### 自動デプロイの仕組み

```
┌─────────────────────────────────────────────────────────────┐
│  開発者が main ブランチに push (弊社GitLab)                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  GitLab CI/CD パイプラインが自動起動                          │
│  ├─ コードのチェックアウト                                    │
│  ├─ Dockerイメージのビルド                                   │
│  ├─ 客先AWS ECRへプッシュ                                    │
│  ├─ ECSタスク定義の更新                                      │
│  └─ ECSサービスのデプロイ                                    │
└────────────────┬────────────────────────────────────────────┘
                 │ インターネット経由
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  客先AWS環境                                                  │
│  └─ ECS Fargateで新しいコンテナが起動                        │
└─────────────────────────────────────────────────────────────┘
```

### パイプラインステージ

| ステージ | トリガー | 用途 |
|---------|---------|------|
| `build` | mainブランチへのpush | Dockerイメージのビルド・ECRプッシュ |
| `deploy` | buildステージ成功後 | ECS Fargateへのデプロイ |
| `deploy-batch` | 手動実行 | AWS Batchワーカーの更新 |

### ブランチ戦略

| ブランチ | デプロイ先 | 自動/手動 |
|---------|-----------|----------|
| `main` | 本番環境 | 自動 |
| `develop` | 開発環境(オプション) | 自動 |
| その他 | デプロイなし | - |

---

## 前提条件

### 完了している必要があるAWS設定

以下のリソースがAWS環境に作成されていること:

- ✅ VPC、サブネット、セキュリティグループ
- ✅ RDS PostgreSQL
- ✅ S3バケット
- ✅ ECRリポジトリ(`prooflink-dev-app` または `prooflink-prod-app`)
- ✅ ECSクラスター(`prooflink-dev-cluster` または `prooflink-prod-cluster`)
- ✅ ECSサービス(`prooflink-dev-service` または `prooflink-prod-service`)
- ✅ ECSタスク定義(`prooflink-dev-task` または `prooflink-prod-task`)
- ✅ ALB、Route 53(本番のみ)、ACM証明書(本番のみ)
- ✅ IAMロール(ECS実行ロール、タスクロール)

詳細は `docs/AWS_SETUP_GUIDE.md` を参照。

### GitLab環境

- GitLabリポジトリへのMaintainer以上の権限
- GitLab Runner(Docker実行可能な環境)

---

## GitLab CI/CD変数の設定

### 1. GitLabプロジェクトの設定画面を開く

1. GitLabプロジェクトを開く
2. 左サイドバーの **Settings** → **CI/CD** をクリック
3. **Variables** セクションを展開

### 2. 必要な変数を追加

**Expand** をクリックして、**Add variable** から以下を追加:

#### 必須のCI/CD変数

| 変数名 | 説明 | 値の例 | Protected | Masked |
|-------|------|--------|-----------|--------|
| `AWS_ACCESS_KEY_ID` | 客先AWSアクセスキーID | `AKIA...` | ✅ | ✅ |
| `AWS_SECRET_ACCESS_KEY` | 客先AWSシークレットキー | `wJalr...` | ✅ | ✅ |
| `ECR_REGISTRY` | ECRレジストリURL | `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com` | - | - |

#### オプション変数(デフォルト値から変更する場合のみ)

| 変数名 | デフォルト値 | 用途 |
|-------|------------|------|
| `AWS_REGION` | `ap-northeast-1` | AWSリージョン |
| `ECR_REPOSITORY` | `prooflink-app` | メインアプリECRリポジトリ名 |
| `ECR_BATCH_REPOSITORY` | `prooflink-batch` | BatchワーカーECRリポジトリ名 |
| `ECS_CLUSTER` | `prooflink-cluster` | ECSクラスター名 |
| `ECS_SERVICE` | `prooflink-service` | ECSサービス名 |
| `ECS_TASK_DEFINITION` | `prooflink-task` | ECSタスク定義名 |

### 3. 変数の設定方法

各変数を追加する際の設定:

```
Key: AWS_ACCESS_KEY_ID
Value: AKIA****************
Type: Variable
Environment scope: All (default)
Protect variable: ✅ (本番環境のみ保護)
Mask variable: ✅ (ログに表示しない)
```

### 4. 設定完了の確認

全ての変数が追加されたことを確認:
- `AWS_ACCESS_KEY_ID` (Protected, Masked)
- `AWS_SECRET_ACCESS_KEY` (Protected, Masked)
- `ECR_REGISTRY`

---

## IAMユーザーの作成

客先AWS環境に、GitLab CI/CDからデプロイするためのIAMユーザーを作成します。

### 1. IAMユーザーの作成

```bash
# 客先AWS環境で実行
aws iam create-user --user-name gitlab-cicd-deployer
```

### 2. 必要なIAMポリシーの作成

以下の内容で `gitlab-cicd-policy.json` を作成:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECSAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:ListTaskDefinitions"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BatchAccess",
      "Effect": "Allow",
      "Action": [
        "batch:DescribeJobDefinitions",
        "batch:RegisterJobDefinition"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::*:role/ecsTaskExecutionRole"
    }
  ]
}
```

### 3. ポリシーをアタッチ

```bash
# ポリシーを作成
aws iam create-policy \
  --policy-name GitLabCICDDeployPolicy \
  --policy-document file://gitlab-cicd-policy.json

# IAMユーザーにポリシーをアタッチ
aws iam attach-user-policy \
  --user-name gitlab-cicd-deployer \
  --policy-arn arn:aws:iam::123456789012:policy/GitLabCICDDeployPolicy
```

### 4. アクセスキーの作成

```bash
aws iam create-access-key --user-name gitlab-cicd-deployer
```

出力された `AccessKeyId` と `SecretAccessKey` を GitLab CI/CD変数に設定します。

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

### Step 2: .gitlab-ci.ymlの確認

プロジェクトルートに `.gitlab-ci.yml` が存在することを確認:

```bash
ls -la .gitlab-ci.yml
```

### Step 3: 環境変数の確認

`.gitlab-ci.yml` の `variables` セクションを客先環境に合わせて修正:

```yaml
variables:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: prooflink-app          # 客先ECRリポジトリ名
  ECS_CLUSTER: prooflink-cluster         # 客先ECSクラスター名
  ECS_SERVICE: prooflink-service         # 客先ECSサービス名
  ECS_TASK_DEFINITION: prooflink-task    # 客先タスク定義名
```

### Step 4: mainブランチにマージ

```bash
# 現在のブランチから main にマージ
git checkout main
git merge your-feature-branch
git push origin main
```

### Step 5: パイプラインの監視

1. GitLabプロジェクトの **CI/CD** → **Pipelines** を開く
2. 実行中のパイプラインをクリック
3. 各ジョブの進行状況を確認

### Step 6: デプロイ完了の確認

```bash
# 客先AWS環境で確認

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

# マージリクエストを作成してレビュー
# ↓
# レビュー承認後、main にマージ
# ↓
# GitLab CI/CD が自動的にデプロイを実行
```

### 開発環境へのデプロイ

`develop` ブランチにマージすると、開発環境に自動デプロイ:

```bash
git checkout develop
git merge feature/new-feature
git push origin develop
```

### Batchワーカーのデプロイ

`batch/` ディレクトリ配下を変更して `main` にマージ後、手動でジョブを実行:

1. **CI/CD** → **Pipelines** → 最新のパイプライン
2. **deploy:batch** ジョブの **▶️ Play** ボタンをクリック

### 手動デプロイ

緊急時や特定のコミットをデプロイする場合:

1. **CI/CD** → **Pipelines** → **Run pipeline**
2. ブランチを選択して **Run pipeline**

---

## トラブルシューティング

### パイプラインが失敗する

#### 1. ECRへのプッシュエラー

**エラー例:**
```
Error: Cannot perform an interactive login from a non TTY device
Error: denied: Your authorization token has expired. Reauthenticate and try again.
```

**解決策:**
- GitLab CI/CD変数の `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` が正しいか確認
- IAMユーザーにECR権限があるか確認
- アクセスキーの有効期限を確認

```bash
# 客先AWS環境で権限確認
aws iam list-attached-user-policies --user-name gitlab-cicd-deployer
```

#### 2. ECSタスク定義が見つからない

**エラー例:**
```
An error occurred (ClientException) when calling the DescribeTaskDefinition operation: Unable to describe task definition.
```

**解決策:**
```bash
# タスク定義の存在確認
aws ecs list-task-definitions --family-prefix prooflink-task

# 存在しない場合、手動で初回作成が必要
# AWS_DEPLOYMENT_GUIDE.mdのECS設定を参照
```

#### 3. GitLab Runnerのエラー

**エラー例:**
```
ERROR: Job failed: error during connect: Get http://docker:2375/v1.40/info: dial tcp: lookup docker
```

**解決策:**
- GitLab RunnerでDocker-in-Dockerが有効か確認
- `.gitlab-ci.yml` の `services` に `docker:24-dind` が含まれているか確認

#### 4. 権限エラー

**エラー例:**
```
User: arn:aws:iam::123456789012:user/gitlab-cicd-deployer is not authorized to perform: ecs:UpdateService
```

**解決策:**
```bash
# IAMポリシーの確認
aws iam get-user-policy \
  --user-name gitlab-cicd-deployer \
  --policy-name GitLabCICDDeployPolicy

# 必要に応じてポリシーを更新
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

#### コンテナログの確認

```bash
# 最新のログを取得
aws logs tail /ecs/prooflink-app --follow

# エラーのみフィルタ
aws logs filter-log-events \
  --log-group-name /ecs/prooflink-app \
  --filter-pattern "ERROR"
```

### ロールバック

デプロイに失敗した場合、GitLabパイプラインから手動でロールバック:

1. **CI/CD** → **Pipelines** → 最新のパイプライン
2. **rollback:production** ジョブの **▶️ Play** ボタンをクリック

または、AWSコンソールから手動ロールバック:

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

## セキュリティのベストプラクティス

### 1. CI/CD変数の保護

- `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` は必ず **Masked** に設定
- 本番環境の変数は **Protected** に設定してmainブランチのみアクセス可能に

### 2. IAMユーザーの権限最小化

- デプロイに必要な最小限の権限のみ付与
- 定期的にアクセスキーをローテーション

```bash
# アクセスキーのローテーション
aws iam create-access-key --user-name gitlab-cicd-deployer
# 新しいキーをGitLab CI/CD変数に設定
aws iam delete-access-key --user-name gitlab-cicd-deployer --access-key-id 古いキーID
```

### 3. パイプラインログの確認

- デプロイログに機密情報が含まれていないか定期的に確認
- 必要に応じて `echo` コマンドを削除

---

## ベストプラクティス

### 1. ブランチ保護

GitLabの **Settings** → **Repository** → **Protected branches** で:

- `main` ブランチを保護
- Merge権限をMaintainerのみに制限
- 強制プッシュを禁止

### 2. デプロイ前のチェックリスト

- [ ] ローカルで `npm run build` が成功する
- [ ] テストが全て通る (`npm test`)
- [ ] Lintエラーがない (`npm run lint`)
- [ ] データベースマイグレーションの必要性を確認
- [ ] 環境変数の追加・変更がないか確認
- [ ] `.env.example` を更新(新しい環境変数がある場合)

### 3. モニタリング

デプロイ後、客先AWS環境で以下を確認:

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

- [AWS環境構築ガイド](./AWS_SETUP_GUIDE.md) - AWS環境構築手順
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [AWS ECS Task Definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/latest/)
