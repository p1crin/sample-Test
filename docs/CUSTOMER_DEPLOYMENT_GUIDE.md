# 客先環境デプロイガイド

このドキュメントは、弊社GitLabで管理しているシステムを客先AWS環境にデプロイする手順を説明します。

## 目次

1. [デプロイの全体像](#デプロイの全体像)
2. [事前準備](#事前準備)
3. [客先AWS環境の構築](#客先aws環境の構築)
4. [弊社側の設定](#弊社側の設定)
5. [デプロイ実行](#デプロイ実行)
6. [運用フロー](#運用フロー)
7. [トラブルシューティング](#トラブルシューティング)

---

## デプロイの全体像

### システム構成

```
┌──────────────────────────────────────────────────────────────┐
│                弊社環境(開発)                                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  GitLab (ソースコード管理)                              │  │
│  │  + GitLab Runner (CI/CDパイプライン実行)                │  │
│  └────────────────────┬───────────────────────────────────┘  │
└───────────────────────┼──────────────────────────────────────┘
                        │ インターネット経由
                        │ (AWS認証情報を使用)
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                客先AWS環境(本番)                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │  │
│  │  │   ECR    │  │   ECS    │  │  RDS PostgreSQL  │    │  │
│  │  │(コンテナ) │  │ Fargate  │  │   (データベース)  │    │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │  │
│  │                                                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │  │
│  │  │    S3    │  │   ALB    │  │   AWS Batch      │    │  │
│  │  │(ファイル) │  │ (LB)     │  │  (インポート)     │    │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                        ▲
                        │ HTTPS (443)
                        │ プロキシ経由アクセス
┌───────────────────────┼──────────────────────────────────────┐
│  ┌────────────────────┴───────────────────────────────────┐  │
│  │  客先ネットワーク                                        │  │
│  │  └─ プロキシサーバー (固定IP)                            │  │
│  │     └─ 社内ユーザー                                      │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 役割分担

| 作業内容 | 担当 | 実施場所 |
|---------|------|---------|
| AWS環境構築 | 客先 or 弊社(契約による) | 客先AWSアカウント |
| IAMユーザー作成 | 客先 | 客先AWSアカウント |
| GitLab CI/CD設定 | 弊社 | 弊社GitLab |
| 初回デプロイ | 弊社 | 弊社GitLab |
| 本番運用・デプロイ | 弊社 | 弊社GitLab |
| インフラ監視 | 客先 or 弊社(契約による) | 客先AWS |

---

## 事前準備

### 客先に用意いただく情報

以下の情報を客先から入手します:

| 項目 | 説明 | 例 |
|------|------|-----|
| **AWSアカウントID** | 客先のAWSアカウントID | `123456789012` |
| **リージョン** | デプロイ先のAWSリージョン | `ap-northeast-1` (東京) |
| **ドメイン名** | アプリケーションのURL | `prooflink.example.com` |
| **プロキシIP** | 社内からのアクセス元IP | `203.0.113.50/32` |
| **管理者連絡先** | 緊急時の連絡先 | `admin@customer.com` |

### 弊社で用意するもの

- GitLabリポジトリ(本プロジェクト)
- GitLab Runner(Docker実行可能)
- デプロイ用ドキュメント一式

---

## 客先AWS環境の構築

### ステップ1: AWS環境構築

詳細は `AWS_DEPLOYMENT_GUIDE.md` を参照して、以下のリソースを構築:

#### 必須リソース

1. **VPC・ネットワーク**
   - VPC (10.0.0.0/16)
   - パブリックサブネット x2
   - プライベートサブネット x2
   - NATゲートウェイ

2. **セキュリティグループ**
   - ALB用 (プロキシIPのみ許可)
   - ECS用
   - RDS用
   - Batch用

3. **RDS PostgreSQL**
   - Multi-AZ構成
   - バックアップ有効化
   - 自動パッチ適用

4. **S3バケット**
   - `prooflink-prod-evidence` (ファイル保存)
   - `prooflink-prod-imports` (CSVインポート)

5. **ECR**
   - `prooflink-app` (メインアプリ)
   - `prooflink-batch` (バッチワーカー)

6. **ECS Fargate**
   - クラスター: `prooflink-cluster`
   - サービス: `prooflink-service`
   - タスク定義: `prooflink-task`

7. **ALB**
   - インターネット向け
   - HTTPS (443)
   - ACM証明書

8. **Route 53**
   - DNSレコード設定
   - ヘルスチェック

9. **AWS Batch**
   - ジョブ定義: `prooflink-user-import`
   - ジョブキュー: `prooflink-job-queue`

10. **WAF**
    - プロキシIP制限
    - レート制限
    - 脅威検出

11. **CloudWatch**
    - ログ収集
    - メトリクス監視
    - アラーム設定

### ステップ2: IAMユーザーの作成

弊社GitLab CI/CDからデプロイするためのIAMユーザーを作成:

```bash
# 1. IAMユーザーを作成
aws iam create-user --user-name gitlab-cicd-deployer

# 2. 必要なポリシーをアタッチ
aws iam attach-user-policy \
  --user-name gitlab-cicd-deployer \
  --policy-arn arn:aws:iam::123456789012:policy/GitLabCICDDeployPolicy

# 3. アクセスキーを作成
aws iam create-access-key --user-name gitlab-cicd-deployer
```

**必要な権限:**
- ECR (イメージプッシュ・プル)
- ECS (タスク定義更新、サービス更新)
- AWS Batch (ジョブ定義更新)
- IAM (PassRole)

詳細なポリシーは `CI_CD_SETUP.md` を参照。

### ステップ3: Secrets Managerの設定

機密情報をSecrets Managerに保存:

```bash
# JWTシークレット
aws secretsmanager create-secret \
  --name prooflink/production/jwt-secret \
  --secret-string "$(openssl rand -base64 32)"

# データベース接続情報
aws secretsmanager create-secret \
  --name prooflink/production/database \
  --secret-string '{
    "username": "prooflink_user",
    "password": "強力なパスワード",
    "host": "prooflink-db.xxxxx.ap-northeast-1.rds.amazonaws.com",
    "port": 5432,
    "database": "prooflink_db"
  }'
```

### ステップ4: 環境変数の設定

ECSタスク定義に以下の環境変数を設定:

```json
{
  "environment": [
    {
      "name": "NODE_ENV",
      "value": "production"
    },
    {
      "name": "NEXTAUTH_URL",
      "value": "https://prooflink.example.com"
    },
    {
      "name": "AWS_REGION",
      "value": "ap-northeast-1"
    },
    {
      "name": "AWS_S3_BUCKET_NAME",
      "value": "prooflink-prod-evidence"
    },
    {
      "name": "S3_IMPORT_BUCKET",
      "value": "prooflink-prod-imports"
    }
  ],
  "secrets": [
    {
      "name": "DATABASE_URL",
      "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/production/database"
    },
    {
      "name": "NEXTAUTH_SECRET",
      "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/production/jwt-secret"
    }
  ]
}
```

---

## 弊社側の設定

### ステップ1: GitLab CI/CD変数の設定

弊社GitLabプロジェクトで以下を設定:

1. **Settings** → **CI/CD** → **Variables** を開く

2. 以下の変数を追加:

| 変数名 | 値 | Protected | Masked |
|--------|-----|-----------|--------|
| `AWS_ACCESS_KEY_ID` | 客先から提供されたアクセスキーID | ✅ | ✅ |
| `AWS_SECRET_ACCESS_KEY` | 客先から提供されたシークレットキー | ✅ | ✅ |
| `ECR_REGISTRY` | `<account-id>.dkr.ecr.ap-northeast-1.amazonaws.com` | - | - |

### ステップ2: パイプライン設定の確認

`.gitlab-ci.yml` の `variables` セクションを客先環境に合わせて修正:

```yaml
variables:
  AWS_REGION: ap-northeast-1              # 客先リージョン
  ECR_REPOSITORY: prooflink-app           # 客先ECRリポジトリ名
  ECS_CLUSTER: prooflink-cluster          # 客先ECSクラスター名
  ECS_SERVICE: prooflink-service          # 客先ECSサービス名
  ECS_TASK_DEFINITION: prooflink-task     # 客先タスク定義名
```

---

## デプロイ実行

### 初回デプロイ

#### 手順1: ローカルで動作確認

```bash
# ビルドテスト
npm run build

# Dockerイメージのビルドテスト
docker build -t prooflink-app:test .
```

#### 手順2: mainブランチにマージ

```bash
git checkout main
git pull origin main
git merge feature/deployment-setup
git push origin main
```

#### 手順3: パイプライン監視

1. GitLabプロジェクトの **CI/CD** → **Pipelines** を開く
2. 実行中のパイプラインをクリック
3. 各ジョブの進行状況を確認:
   - `build:app` - Dockerイメージビルド
   - `deploy:production` - ECSデプロイ

#### 手順4: デプロイ完了確認

客先AWS環境で以下を確認:

```bash
# ECSサービスの状態
aws ecs describe-services \
  --cluster prooflink-cluster \
  --services prooflink-service

# 実行中のタスク
aws ecs list-tasks \
  --cluster prooflink-cluster \
  --service-name prooflink-service

# CloudWatchログ
aws logs tail /ecs/prooflink-app --follow
```

#### 手順5: 動作確認

1. ブラウザで https://prooflink.example.com にアクセス
2. ログイン画面が表示されることを確認
3. デフォルトユーザーでログイン
4. 主要機能の動作確認

### データベースマイグレーション

初回デプロイ前に、データベースマイグレーションを実行:

```bash
# ローカルから客先RDSに接続してマイグレーション実行
DATABASE_URL="postgresql://user:pass@客先RDS:5432/db" npx prisma migrate deploy

# または、ECSタスク経由で実行
aws ecs run-task \
  --cluster prooflink-cluster \
  --task-definition prooflink-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={...}" \
  --overrides '{"containerOverrides":[{"name":"prooflink-app","command":["npx","prisma","migrate","deploy"]}]}'
```

---

## 運用フロー

### 日常の開発・デプロイフロー

```
開発者: feature開発
   ↓
開発者: マージリクエスト作成
   ↓
レビュアー: コードレビュー
   ↓
レビュアー: mainブランチにマージ
   ↓
GitLab CI/CD: 自動ビルド・デプロイ
   ↓
客先AWS: ECS Fargateで新バージョン起動
   ↓
担当者: 動作確認
```

### 緊急時のロールバック

#### GitLabパイプラインから実行

1. **CI/CD** → **Pipelines** → 最新のパイプライン
2. **rollback:production** ジョブの **▶️ Play** をクリック

#### 手動でロールバック

```bash
# 前のタスク定義リビジョンを確認
aws ecs list-task-definitions --family-prefix prooflink-task

# 前のリビジョンにロールバック
aws ecs update-service \
  --cluster prooflink-cluster \
  --service prooflink-service \
  --task-definition prooflink-task:前のリビジョン番号
```

### モニタリング

#### CloudWatch監視項目

- **ECSサービス**
  - CPU使用率
  - メモリ使用率
  - 実行中のタスク数

- **ALB**
  - リクエスト数
  - レスポンスタイム
  - エラー率

- **RDS**
  - 接続数
  - CPU使用率
  - ストレージ容量

#### アラート設定

重要なメトリクスにアラームを設定:

```bash
# ECS CPU使用率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name prooflink-ecs-cpu-high \
  --alarm-description "ECS CPU使用率が80%を超えた" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## トラブルシューティング

### デプロイが失敗する

#### 権限エラー

**症状:**
```
User is not authorized to perform: ecr:PutImage
```

**解決策:**
- GitLab CI/CD変数のAWS認証情報を確認
- IAMユーザーの権限を確認

#### ECRプッシュエラー

**症状:**
```
denied: Your authorization token has expired
```

**解決策:**
- アクセスキーの有効期限を確認
- 必要に応じて新しいアクセスキーを発行

### アプリケーションが起動しない

#### 環境変数の確認

```bash
# タスク定義の環境変数を確認
aws ecs describe-task-definition \
  --task-definition prooflink-task \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

#### コンテナログの確認

```bash
# エラーログを確認
aws logs filter-log-events \
  --log-group-name /ecs/prooflink-app \
  --filter-pattern "ERROR"
```

### データベース接続エラー

**確認項目:**

1. RDSセキュリティグループの設定
2. DATABASE_URLの形式
3. RDSの稼働状態
4. ネットワーク接続性

```bash
# RDS接続テスト
psql postgresql://user:pass@host:5432/db -c "SELECT 1"
```

---

## まとめ

### チェックリスト

デプロイ前に以下を確認:

- [ ] 客先AWS環境が全て構築済み
- [ ] IAMユーザーとアクセスキーが作成済み
- [ ] GitLab CI/CD変数が設定済み
- [ ] データベースマイグレーションが実行済み
- [ ] 環境変数がECSタスク定義に設定済み
- [ ] プロキシIPがWAF・SGに設定済み
- [ ] SSL証明書が取得済み
- [ ] DNSレコードが設定済み
- [ ] CloudWatch監視が設定済み

### サポート

問題が発生した場合の連絡先:

- **弊社担当**: [連絡先]
- **客先担当**: [連絡先]
- **AWS サポート**: 客先のサポートプラン利用

### 関連ドキュメント

- [AWS Deployment Guide](./AWS_DEPLOYMENT_GUIDE.md) - 詳細なAWS構築手順
- [CI/CD Setup Guide](./CI_CD_SETUP.md) - GitLab CI/CD設定
- [Quick Start Guide](./QUICKSTART.md) - クイックスタート
