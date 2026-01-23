# クイックスタートガイド

このガイドでは、ProofLinkシステムを最速でセットアップする手順を説明します。

> **更新情報(2026-01-23)**: AWS環境構築手順を大幅に改善しました。
> - NATゲートウェイ不要でコスト削減
> - AWSコンソールのみで構築可能(CLI不要)
> - 開発環境向けのコスト最適化設定を追加

## 目次

1. [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
2. [AWS環境のデプロイ](#aws環境のデプロイ)
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

## AWS環境のデプロイ

### フェーズ1: インフラ構築(初回のみ)

**所要時間: 開発環境 約1.5時間、本番環境 約2.5時間**

詳細は `docs/AWS_SETUP_GUIDE.md` を参照してください。

#### 主要な改善点

- ✅ **NATゲートウェイ不要**: 月額3,000〜5,000円のコスト削減
- ✅ **AWSコンソールのみ**: CLI不要で全ての操作が可能
- ✅ **開発環境のコスト最適化**: 月額約6,000円で運用可能

#### 主要ステップ

1. **VPCとネットワーク** (10分)
   - パブリック/プライベートサブネット
   - インターネットゲートウェイ(NATゲートウェイなし)

2. **セキュリティグループ** (10分)
   - ALB用、ECS用、RDS用

3. **RDS PostgreSQL** (20分)
   - 開発環境: db.t4g.micro (約¥1,500/月)
   - 本番環境: db.t4g.medium + Multi-AZ

4. **S3バケット** (5分)
   - ファイルストレージ
   - ライフサイクルポリシー設定

5. **IAMロールとECR** (15分)
   - ECSタスク実行ロール
   - ECSタスクロール
   - ECRリポジトリ

6. **ECSクラスターとタスク定義** (20分)
   - 開発環境: 0.5vCPU, 1GB (約¥1,800/月)
   - 本番環境: 1vCPU, 2GB

7. **ALB・DNS** (20分)
   - Application Load Balancer
   - Route 53設定(本番のみ)
   - SSL証明書(本番のみ)

8. **CloudWatch** (10分)
   - ログ設定
   - アラーム設定(本番のみ)

### フェーズ2: 初回デプロイ

#### ステップ1: Dockerイメージのビルドとプッシュ

ローカルマシンで実行:

```bash
# 1. AWSアカウントIDを確認
aws sts get-caller-identity --query Account --output text

# 2. ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin \
  {アカウントID}.dkr.ecr.ap-northeast-1.amazonaws.com

# 3. Dockerイメージをビルド
docker build -t prooflink-dev-app .

# 4. イメージをタグ付け
docker tag prooflink-dev-app:latest \
  {アカウントID}.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:latest

# 5. ECRにプッシュ
docker push {アカウントID}.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:latest
```

#### ステップ2: ECSサービスの作成

AWSコンソールで実行:

1. ECS → クラスター → `prooflink-dev-cluster` を開く
2. 「サービス」タブ → 「作成」
3. 設定:
   - 起動タイプ: Fargate
   - タスク定義: `prooflink-dev-task`
   - サービス名: `prooflink-dev-service`
   - タスクの数: 1
   - ネットワーク: パブリックサブネット
   - **パブリックIPの自動割り当て: ENABLED** (重要)
   - ロードバランサー: ALBを選択
   - ターゲットグループ: `prooflink-tg`
4. 「作成」をクリック

#### ステップ3: 動作確認

ブラウザでALBのDNS名にアクセス:

開発環境: `http://prooflink-alb-xxxxx.ap-northeast-1.elb.amazonaws.com`

本番環境: `https://prooflink.example.com`

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

**A:** `.env.local`に以下を追加:

```env
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET_NAME=prooflink-dev-files-xxxxx
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

- **AWS環境構築**: [AWS環境構築ガイド](./AWS_SETUP_GUIDE.md) ← 新しいガイド
- **CI/CD設定**: [CI/CDセットアップ](./CI_CD_SETUP.md)
- **S3ローカル開発**: [S3セットアップガイド](./LOCAL_DEVELOPMENT_S3_SETUP.md)

---

## サポート

問題が発生した場合:

1. ドキュメントを確認
2. GitHub Issuesで検索
3. 新しいIssueを作成
