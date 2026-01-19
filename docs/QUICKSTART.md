# クイックスタートガイド

このガイドでは、ProofLinkシステムを最速でセットアップする手順を説明します。

## 目次

1. [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
2. [AWS本番環境のデプロイ](#aws本番環境のデプロイ)
3. [自動デプロイの設定](#自動デプロイの設定)

---

## ローカル開発環境のセットアップ

### 1. 必要なツール

- **Node.js 20以上**
- **PostgreSQL 14以上**
- **Git**

### 2. リポジトリのクローン

```bash
git clone https://github.com/your-org/prooflink.git
cd prooflink
```

### 3. 依存関係のインストール

```bash
npm install
```

### 4. 環境変数の設定

```bash
# .envファイルを作成
cp .env.example .env

# .envを編集してデータベース接続情報を設定
nano .env
```

最低限必要な設定:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/prooflink_db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-secret-change-in-production"
```

### 5. データベースのセットアップ

```bash
# データベースを作成
createdb prooflink_db

# Prismaマイグレーションを実行
npx prisma migrate dev

# 初期データを投入(オプション)
npx prisma db seed
```

### 6. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く

### 7. デフォルトログイン情報

初期ユーザー(マイグレーション後):

- **ユーザーID**: `admin`
- **パスワード**: `admin123`

---

## AWS本番環境のデプロイ

### フェーズ1: インフラ構築(初回のみ)

**所要時間: 約2-3時間**

詳細は `docs/AWS_DEPLOYMENT_GUIDE.md` を参照してください。

#### 主要ステップ

1. **VPC作成** (10分)
   - パブリック/プライベートサブネット
   - NATゲートウェイ

2. **RDS PostgreSQL** (20分)
   - Multi-AZ構成
   - セキュリティグループ設定

3. **S3バケット** (5分)
   - ファイルストレージ用
   - インポート用

4. **ECR・ECS** (30分)
   - コンテナリポジトリ
   - Fargateクラスター
   - タスク定義

5. **ALB・Route 53** (20分)
   - ロードバランサー
   - SSL証明書(ACM)
   - DNS設定

6. **AWS Batch** (20分)
   - ジョブ定義
   - ジョブキュー

7. **WAF・CloudWatch** (15分)
   - アクセス制御
   - ログ・監視

### フェーズ2: 初回デプロイ

#### 方法A: 手動デプロイ

```bash
# 1. Dockerイメージをビルド
docker build -t prooflink-app .

# 2. ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# 3. イメージをタグ付け
docker tag prooflink-app:latest \
  <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-app:latest

# 4. ECRにプッシュ
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-app:latest

# 5. ECSサービスを更新
aws ecs update-service \
  --cluster prooflink-cluster \
  --service prooflink-service \
  --force-new-deployment
```

#### 方法B: GitLab CI/CDでデプロイ

CI/CDセットアップ後は、`main`ブランチにプッシュするだけで自動デプロイされます。

---

## 自動デプロイの設定(GitLab CI/CD)

### 1. GitLab CI/CD変数の設定

プロジェクトの `Settings` → `CI/CD` → `Variables` で以下を追加:

| 変数名 | 値 | Protected | Masked |
|--------|-----|-----------|--------|
| `AWS_ACCESS_KEY_ID` | 客先AWSアクセスキーID | ✅ | ✅ |
| `AWS_SECRET_ACCESS_KEY` | 客先AWSシークレットキー | ✅ | ✅ |
| `ECR_REGISTRY` | ECRレジストリURL | - | - |

### 2. GitLab Environmentの設定(オプション)

`Deployments` → `Environments` で環境を確認:

- Environment名: `production`
- URL: `https://prooflink.example.com`

### 3. パイプライン設定ファイルの確認

以下のファイルが存在することを確認:

- `.gitlab-ci.yml`

### 4. 初回デプロイ

```bash
# mainブランチにプッシュ
git checkout main
git pull origin main
git merge your-branch
git push origin main
```

GitLab CI/CDが自動的にデプロイを開始します。

### 5. デプロイ状況の確認

1. GitLabプロジェクトの **CI/CD** → **Pipelines** を開く
2. 実行中のパイプラインをクリック
3. 各ジョブの進行状況を確認

---

## よくある質問

### Q1: ローカルでS3を使いたい

**A:** `.env`に以下を追加:

```env
AWS_S3_BUCKET_NAME="your-dev-bucket"
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
```

詳細は `docs/LOCAL_DEVELOPMENT_S3_SETUP.md` を参照。

### Q2: データベースマイグレーションの実行タイミングは?

**A:** 以下のタイミングで実行:

- ローカル開発: `npx prisma migrate dev`
- 本番環境: デプロイ前に `npx prisma migrate deploy`

本番環境では、ECSタスク経由またはローカルから実行:

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

### Q3: ログはどこで確認できる?

**A:**
- ローカル: ターミナル出力
- 本番(AWS): CloudWatch Logs

```bash
aws logs tail /ecs/prooflink-app --follow
```

### Q4: デプロイに失敗した

**A:** トラブルシューティング手順:

1. GitHub Actionsのログを確認
2. ECSサービスのイベントを確認
   ```bash
   aws ecs describe-services \
     --cluster prooflink-cluster \
     --services prooflink-service
   ```
3. CloudWatchログを確認
4. 必要に応じてロールバック

詳細は `docs/CI_CD_SETUP.md` のトラブルシューティングセクションを参照。

### Q5: 環境変数を追加したい

**A:**

1. `.env.example`に追加してドキュメント化
2. ローカル: `.env`に追加
3. 本番: ECSタスク定義またはSecrets Managerに追加

---

## 次のステップ

- **開発者向け**: [開発ガイド](./DEVELOPMENT.md)
- **AWS構築**: [AWSデプロイメントガイド](./AWS_DEPLOYMENT_GUIDE.md)
- **CI/CD設定**: [CI/CDセットアップ](./CI_CD_SETUP.md)
- **S3ローカル開発**: [S3セットアップガイド](./LOCAL_DEVELOPMENT_S3_SETUP.md)

---

## サポート

問題が発生した場合:

1. ドキュメントを確認
2. GitHub Issuesで検索
3. 新しいIssueを作成
