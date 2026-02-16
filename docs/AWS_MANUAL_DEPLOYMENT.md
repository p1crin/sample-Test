# AWS手動デプロイ手順書

## 目次

1. [はじめに](#1-はじめに)
2. [前提条件](#2-前提条件)
3. [デプロイ手順](#3-デプロイ手順)
   - [Step 1: 環境変数の準備](#step-1-環境変数の準備)
   - [Step 2: Dockerイメージのビルド](#step-2-dockerイメージのビルド)
   - [Step 3: ECRへのログイン](#step-3-ecrへのログイン)
   - [Step 4: イメージのタグ付けとプッシュ](#step-4-イメージのタグ付けとプッシュ)
   - [Step 5: ECSサービスの更新](#step-5-ecsサービスの更新)
   - [Step 6: デプロイの確認](#step-6-デプロイの確認)
4. [トラブルシューティング](#4-トラブルシューティング)
5. [ロールバック手順](#5-ロールバック手順)

---

## 1. はじめに

### 本ドキュメントの目的

このガイドは、Next.jsアプリケーションを**手動で**AWS ECS Fargateにデプロイする手順を説明します。CI/CDパイプラインを使用せず、ローカル環境からDockerイメージをビルドしてデプロイします。

### 対象環境

- **開発環境**: `prooflink-dev-*`
- **本番環境**: `prooflink-prod-*`

### デプロイフロー概要

```
ローカル開発環境
    │
    ├─ 1. Dockerイメージをビルド
    │
    ├─ 2. AWS ECRにログイン
    │
    ├─ 3. イメージにタグ付け
    │
    ├─ 4. ECRにプッシュ
    │
    └─ 5. ECSサービスを更新
           │
           └─ 新しいタスクが起動
```

---

## 2. 前提条件

### 2.1 必要なツール

以下のツールがインストールされていることを確認してください。

| ツール | バージョン | インストール確認コマンド |
|--------|-----------|----------------------|
| Docker | 20.10以降 | `docker --version` |
| AWS CLI | 2.x | `aws --version` |
| Git | 2.x | `git --version` |

#### Docker のインストール

- **Windows/Mac**: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- **Linux**: 公式ドキュメント参照

#### AWS CLI のインストール

**Windows:**
```bash
# PowerShellで実行
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi
```

**Mac:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 2.2 AWS認証情報の設定

AWS CLIで認証情報を設定します。

```bash
aws configure
```

以下の情報を入力します：

```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: ap-northeast-1
Default output format: json
```

> **権限要件**: 以下のAWSサービスへのアクセス権限が必要です
> - Amazon ECR (イメージプッシュ)
> - Amazon ECS (サービス更新)
> - IAM (認証情報取得)

#### 認証確認

```bash
aws sts get-caller-identity
```

以下のような出力が表示されれば成功です：

```json
{
    "UserId": "AIDXXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### 2.3 AWS環境の確認

デプロイ先のAWS環境が構築済みであることを確認してください。

- ✅ VPCとサブネットが作成済み
- ✅ RDS PostgreSQLが稼働中
- ✅ S3バケットが作成済み
- ✅ ECRリポジトリが作成済み
- ✅ ECSクラスターとサービスが作成済み
- ✅ ALBが設定済み

詳細は [AWS環境構築ガイド](./AWS_SETUP_GUIDE.md) を参照してください。

---

## 3. デプロイ手順

### Step 1: 環境変数の準備

デプロイ前に、以下の環境変数を確認・設定します。

#### 1-1. 環境変数ファイルの準備

まず、AWSマネジメントコンソールから必要な情報を取得します。

**取得が必要な情報:**

| 項目 | 取得場所 | 例 |
|------|---------|-----|
| AWSアカウントID | IAM Dashboard | `123456789012` |
| ECRリポジトリ名 | ECR → リポジトリ | `prooflink-dev-app` |
| ECSクラスター名 | ECS → クラスター | `prooflink-dev-cluster` |
| ECSサービス名 | ECS → サービス | `prooflink-service` |
| リージョン | - | `ap-northeast-1` |

#### 1-2. シェル変数として設定（Linux/Mac）

```bash
# 環境を選択（devまたはprod）
export ENV=dev  # または prod

# AWSリージョン
export AWS_REGION=ap-northeast-1

# AWSアカウントID
export AWS_ACCOUNT_ID=123456789012

# ECRリポジトリ名
export ECR_REPOSITORY=prooflink-${ENV}-app

# ECSクラスター名
export ECS_CLUSTER=prooflink-${ENV}-cluster

# ECSサービス名
export ECS_SERVICE=prooflink-service

# ECRのフルパス
export ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}

# イメージタグ（デプロイ日時を使用）
export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)
```

#### 1-3. PowerShell変数として設定（Windows）

```powershell
# 環境を選択（devまたはprod）
$env:ENV = "dev"  # または "prod"

# AWSリージョン
$env:AWS_REGION = "ap-northeast-1"

# AWSアカウントID
$env:AWS_ACCOUNT_ID = "123456789012"

# ECRリポジトリ名
$env:ECR_REPOSITORY = "prooflink-$($env:ENV)-app"

# ECSクラスター名
$env:ECS_CLUSTER = "prooflink-$($env:ENV)-cluster"

# ECSサービス名
$env:ECS_SERVICE = "prooflink-service"

# ECRのフルパス
$env:ECR_URI = "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:ECR_REPOSITORY)"

# イメージタグ（デプロイ日時を使用）
$env:IMAGE_TAG = Get-Date -Format "yyyyMMdd-HHmmss"
```

#### 1-4. 設定の確認

**Linux/Mac:**
```bash
echo "ECR URI: $ECR_URI"
echo "Image Tag: $IMAGE_TAG"
echo "ECS Cluster: $ECS_CLUSTER"
echo "ECS Service: $ECS_SERVICE"
```

**Windows:**
```powershell
Write-Host "ECR URI: $env:ECR_URI"
Write-Host "Image Tag: $env:IMAGE_TAG"
Write-Host "ECS Cluster: $env:ECS_CLUSTER"
Write-Host "ECS Service: $env:ECS_SERVICE"
```

---

### Step 2: Dockerイメージのビルド

#### 2-1. プロジェクトルートに移動

```bash
cd /path/to/nextjs-skeleton
```

現在のディレクトリを確認：

```bash
pwd
ls -la
# Dockerfile、package.json、next.config.tsが存在することを確認
```

#### 2-2. Dockerイメージをビルド

**Linux/Mac:**
```bash
docker build \
  --platform linux/amd64 \
  -t ${ECR_REPOSITORY}:${IMAGE_TAG} \
  -t ${ECR_REPOSITORY}:latest \
  .
```

**Windows (PowerShell):**
```powershell
docker build `
  --platform linux/amd64 `
  -t "$($env:ECR_REPOSITORY):$($env:IMAGE_TAG)" `
  -t "$($env:ECR_REPOSITORY):latest" `
  .
```

> **注意**: `--platform linux/amd64` は、Apple Silicon (M1/M2)やARM環境でビルドする場合に必要です。Intel CPUの場合は省略可能です。

**ビルド時間**: 初回は5〜10分、2回目以降はキャッシュにより1〜3分程度

#### 2-3. ビルドの確認

```bash
docker images | grep ${ECR_REPOSITORY}
```

以下のような出力が表示されれば成功です：

```
prooflink-dev-app    20260210-143000   abc123def456   2 minutes ago   500MB
prooflink-dev-app    latest            abc123def456   2 minutes ago   500MB
```

#### 2-4. ローカルでの動作確認（オプション）

デプロイ前にローカルでDockerイメージをテストすることを推奨します。

```bash
# コンテナを起動
docker run -d \
  -p 3000:3000 \
  --name prooflink-test \
  -e NODE_ENV=production \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e DATABASE_URL=postgresql://user:password@host:5432/dbname \
  ${ECR_REPOSITORY}:${IMAGE_TAG}

# ログを確認
docker logs -f prooflink-test

# 動作確認
curl http://localhost:3000/api/health

# コンテナを停止・削除
docker stop prooflink-test
docker rm prooflink-test
```

---

### Step 3: ECRへのログイン

#### 3-1. ECRにログイン

**Linux/Mac:**
```bash
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

**Windows (PowerShell):**
```powershell
aws ecr get-login-password --region $env:AWS_REGION | `
  docker login --username AWS --password-stdin "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com"
```

成功すると以下のメッセージが表示されます：

```
Login Succeeded
```

#### 3-2. トラブルシューティング

**エラー: "Unable to locate credentials"**

```bash
aws configure
# 再度認証情報を設定
```

**エラー: "An error occurred (RepositoryNotFoundException)"**

ECRリポジトリが存在しない場合は作成します：

```bash
aws ecr create-repository \
  --repository-name ${ECR_REPOSITORY} \
  --region ${AWS_REGION}
```

---

### Step 4: イメージのタグ付けとプッシュ

#### 4-1. イメージにECRタグを付与

**Linux/Mac:**
```bash
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:latest
```

**Windows (PowerShell):**
```powershell
docker tag "$($env:ECR_REPOSITORY):$($env:IMAGE_TAG)" "$($env:ECR_URI):$($env:IMAGE_TAG)"
docker tag "$($env:ECR_REPOSITORY):$($env:IMAGE_TAG)" "$($env:ECR_URI):latest"
```

#### 4-2. ECRにプッシュ

**Linux/Mac:**
```bash
# タグ付きイメージをプッシュ
docker push ${ECR_URI}:${IMAGE_TAG}

# latestタグをプッシュ
docker push ${ECR_URI}:latest
```

**Windows (PowerShell):**
```powershell
# タグ付きイメージをプッシュ
docker push "$($env:ECR_URI):$($env:IMAGE_TAG)"

# latestタグをプッシュ
docker push "$($env:ECR_URI):latest"
```

**プッシュ時間**: ネットワーク速度により5〜15分

#### 4-3. プッシュの確認

AWSマネジメントコンソールで確認：

1. 「**ECR**」→「**リポジトリ**」を開く
2. `prooflink-dev-app` または `prooflink-prod-app` をクリック
3. 新しいイメージタグが追加されていることを確認

コマンドラインで確認：

```bash
aws ecr describe-images \
  --repository-name ${ECR_REPOSITORY} \
  --region ${AWS_REGION}
```

---

### Step 5: ECSサービスの更新

#### 5-1. 現在のタスク定義を確認

```bash
aws ecs describe-services \
  --cluster ${ECS_CLUSTER} \
  --services ${ECS_SERVICE} \
  --region ${AWS_REGION} \
  --query 'services[0].taskDefinition' \
  --output text
```

出力例:
```
arn:aws:ecs:ap-northeast-1:123456789012:task-definition/prooflink-dev-task:5
```

#### 5-2. 新しいタスク定義を作成（GUIから）

**方法1: AWSマネジメントコンソールを使用（推奨）**

1. 「**ECS**」→「**タスク定義**」を開く
2. `prooflink-dev-task` または `prooflink-prod-task` をクリック
3. 最新リビジョンを選択し、「**新しいリビジョンの作成**」をクリック
4. 「**コンテナ1 - prooflink-app**」のセクションを開く
5. **イメージURI** を更新:
   ```
   123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:20260210-143000
   ```
   または
   ```
   123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:latest
   ```
6. 「**作成**」をクリック

#### 5-3. 新しいタスク定義を作成（CLIから）

**方法2: AWS CLIを使用**

まず、現在のタスク定義をJSON形式で取得：

```bash
aws ecs describe-task-definition \
  --task-definition prooflink-${ENV}-task \
  --region ${AWS_REGION} \
  --query 'taskDefinition' \
  > task-definition.json
```

`task-definition.json` を編集：

```json
{
  "family": "prooflink-dev-task",
  "containerDefinitions": [
    {
      "name": "prooflink-app",
      "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:20260210-143000",
      // ... その他の設定
    }
  ],
  // ... その他の設定
}
```

> **注意**: `taskDefinitionArn`, `revision`, `status`, `requiresAttributes`, `compatibilities`, `registeredAt`, `registeredBy` などのメタデータフィールドは削除してください。

新しいタスク定義を登録：

```bash
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region ${AWS_REGION}
```

#### 5-4. ECSサービスを更新

**Linux/Mac:**
```bash
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --force-new-deployment \
  --region ${AWS_REGION}
```

**Windows (PowerShell):**
```powershell
aws ecs update-service `
  --cluster $env:ECS_CLUSTER `
  --service $env:ECS_SERVICE `
  --force-new-deployment `
  --region $env:AWS_REGION
```

> **`--force-new-deployment` オプション**: タスク定義が変更されていない場合でも、新しいタスクを起動して古いタスクを置き換えます。

**特定のタスク定義リビジョンを指定する場合:**

```bash
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --task-definition prooflink-${ENV}-task:6 \
  --region ${AWS_REGION}
```

#### 5-5. デプロイの進行状況を監視

**AWSマネジメントコンソールで確認:**

1. 「**ECS**」→「**クラスター**」→`prooflink-dev-cluster` を開く
2. 「**サービス**」タブ→`prooflink-service` をクリック
3. 「**デプロイとイベント**」タブで進行状況を確認

**AWS CLIで確認:**

```bash
watch -n 5 "aws ecs describe-services \
  --cluster ${ECS_CLUSTER} \
  --services ${ECS_SERVICE} \
  --region ${AWS_REGION} \
  --query 'services[0].deployments' \
  --output table"
```

**Windows (PowerShell):**
```powershell
while ($true) {
  aws ecs describe-services `
    --cluster $env:ECS_CLUSTER `
    --services $env:ECS_SERVICE `
    --region $env:AWS_REGION `
    --query 'services[0].deployments' `
    --output table
  Start-Sleep -Seconds 5
}
```

出力例:
```
------------------------------------------------------------------
|                        DescribeServices                        |
+-------+--------+---------------+--------------+----------------+
| status| desired| running       | pending      | taskDefinition |
+-------+--------+---------------+--------------+----------------+
| PRIMARY|  2    |  2            |  0           |  prooflink-dev-task:6 |
| ACTIVE |  2    |  1            |  0           |  prooflink-dev-task:5 |
+-------+--------+---------------+--------------+----------------+
```

- **PRIMARY**: 新しいデプロイ
- **ACTIVE**: 古いデプロイ

新しいタスクが `running: 2` になり、古いタスクが消えたらデプロイ完了です。

---

### Step 6: デプロイの確認

#### 6-1. タスクの状態確認

```bash
aws ecs list-tasks \
  --cluster ${ECS_CLUSTER} \
  --service-name ${ECS_SERVICE} \
  --region ${AWS_REGION}
```

#### 6-2. ヘルスチェック確認

**ALB経由でヘルスチェック:**

```bash
# 開発環境（HTTPの場合）
curl http://prooflink-alb-123456789.ap-northeast-1.elb.amazonaws.com/api/health

# 本番環境（HTTPSの場合）
curl https://prooflink.example.com/api/health
```

期待されるレスポンス:
```json
{
  "status": "ok",
  "timestamp": "2026-02-10T14:30:00.000Z"
}
```

#### 6-3. CloudWatch Logsでログ確認

1. 「**CloudWatch**」→「**ロググループ**」を開く
2. `/ecs/prooflink-dev-app-server` を選択
3. 最新のログストリームを開く
4. エラーがないことを確認

**AWS CLIで確認:**

```bash
aws logs tail /ecs/prooflink-${ENV}-app-server \
  --follow \
  --region ${AWS_REGION}
```

#### 6-4. ターゲットグループの確認

1. 「**EC2**」→「**ターゲットグループ**」を開く
2. `prooflink-tg` をクリック
3. 「**ターゲット**」タブでステータスが `healthy` になっていることを確認

**AWS CLIで確認:**

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/prooflink-tg/xxxxx \
  --region ${AWS_REGION}
```

#### 6-5. アプリケーション動作確認

ブラウザで以下のURLにアクセスし、アプリケーションが正常に動作することを確認：

- **開発環境**: `http://prooflink-alb-123456789.ap-northeast-1.elb.amazonaws.com`
- **本番環境**: `https://prooflink.example.com`

**確認項目:**
- ✅ ログインページが表示される
- ✅ ログインできる
- ✅ 各画面が正常に表示される
- ✅ データベース接続が正常
- ✅ S3へのファイルアップロードが正常

---

## 4. トラブルシューティング

### 4.1 Dockerビルドが失敗する

#### エラー: "docker: command not found"

**原因**: Dockerがインストールされていない

**解決策**:
```bash
# Dockerをインストール
# https://docs.docker.com/get-docker/
```

#### エラー: "failed to solve with frontend dockerfile.v0"

**原因**: Dockerfileの構文エラー

**解決策**:
```bash
# Dockerfileの構文をチェック
docker build --check .
```

#### エラー: "npm ci" が失敗する

**原因**: package-lock.jsonが古い、またはNode.jsバージョンが合わない

**解決策**:
```bash
# ローカルで依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# 再度ビルド
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .
```

---

### 4.2 ECRへのプッシュが失敗する

#### エラー: "denied: User is not authorized to perform: ecr:InitiateLayerUpload"

**原因**: IAMユーザーにECRへのプッシュ権限がない

**解決策**:

IAMユーザーに以下のポリシーをアタッチ:

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
    }
  ]
}
```

#### エラー: "no basic auth credentials"

**原因**: ECRへのログインが切れている

**解決策**:
```bash
# 再度ログイン
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

---

### 4.3 ECSタスクが起動しない

#### エラー: "CannotPullContainerError"

**原因**: ECSがECRからイメージをプルできない

**解決策**:

1. **タスク実行ロールの確認**:
   - ECSタスク定義の「タスク実行ロール」に `AmazonECSTaskExecutionRolePolicy` がアタッチされているか確認

2. **イメージURIの確認**:
   - タスク定義のイメージURIが正しいか確認
   - 例: `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:20260210-143000`

3. **VPCエンドポイントの確認（プライベートサブネットの場合）**:
   - ECR API エンドポイント (`com.amazonaws.ap-northeast-1.ecr.api`)
   - ECR DKR エンドポイント (`com.amazonaws.ap-northeast-1.ecr.dkr`)
   - S3 ゲートウェイエンドポイント

#### エラー: "Task failed to start"

**原因**: アプリケーション起動時のエラー

**解決策**:

CloudWatch Logsでエラーログを確認:

```bash
aws logs tail /ecs/prooflink-${ENV}-app-server \
  --since 10m \
  --region ${AWS_REGION}
```

よくあるエラー:
- **データベース接続エラー**: `DATABASE_URL` の確認
- **環境変数不足**: タスク定義の環境変数を確認
- **ポート設定ミス**: コンテナポート3000が正しく設定されているか確認

---

### 4.4 ヘルスチェックが失敗する

#### ターゲットグループで "unhealthy" 状態

**原因**: アプリケーションが正常に起動していない

**解決策**:

1. **ヘルスチェックパスの確認**:
   - ターゲットグループの設定で `/api/health` が正しく設定されているか確認

2. **セキュリティグループの確認**:
   - ALBセキュリティグループからECSセキュリティグループへのポート3000が許可されているか確認

3. **アプリケーションログの確認**:
   ```bash
   aws logs tail /ecs/prooflink-${ENV}-app-server --follow
   ```

---

### 4.5 デプロイが完了しない

#### デプロイが "ACTIVE" のまま進まない

**原因**: 新しいタスクがヘルスチェックに失敗している

**解決策**:

1. **タスクのステータス確認**:
   ```bash
   aws ecs describe-tasks \
     --cluster ${ECS_CLUSTER} \
     --tasks $(aws ecs list-tasks --cluster ${ECS_CLUSTER} --service-name ${ECS_SERVICE} --query 'taskArns[0]' --output text) \
     --region ${AWS_REGION}
   ```

2. **イベントログの確認**:
   - ECSコンソールで「デプロイとイベント」タブを確認

3. **ロールバック**:
   - 問題が解決しない場合は [ロールバック手順](#5-ロールバック手順) を実行

---

## 5. ロールバック手順

デプロイに問題が発生した場合、以前のバージョンにロールバックします。

### 5-1. 以前のタスク定義リビジョンを確認

```bash
aws ecs list-task-definitions \
  --family-prefix prooflink-${ENV}-task \
  --sort DESC \
  --region ${AWS_REGION}
```

出力例:
```
arn:aws:ecs:ap-northeast-1:123456789012:task-definition/prooflink-dev-task:6  # 最新（問題あり）
arn:aws:ecs:ap-northeast-1:123456789012:task-definition/prooflink-dev-task:5  # 以前（安定版）
arn:aws:ecs:ap-northeast-1:123456789012:task-definition/prooflink-dev-task:4
```

### 5-2. サービスを以前のリビジョンに更新

```bash
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --task-definition prooflink-${ENV}-task:5 \
  --region ${AWS_REGION}
```

### 5-3. ロールバックの確認

```bash
aws ecs describe-services \
  --cluster ${ECS_CLUSTER} \
  --services ${ECS_SERVICE} \
  --region ${AWS_REGION} \
  --query 'services[0].deployments'
```

### 5-4. 問題のあるECRイメージを削除（オプション）

```bash
aws ecr batch-delete-image \
  --repository-name ${ECR_REPOSITORY} \
  --image-ids imageTag=${IMAGE_TAG} \
  --region ${AWS_REGION}
```

---

## 6. デプロイチェックリスト

デプロイ前に以下をチェックしてください：

### デプロイ前チェックリスト

- [ ] コードのテストが全て通過している
- [ ] ローカルでDockerイメージをビルドして動作確認済み
- [ ] 環境変数が正しく設定されている
- [ ] データベースマイグレーションが必要な場合は実施済み
- [ ] デプロイ先の環境（dev/prod）を確認した
- [ ] ECRリポジトリに十分な容量がある（古いイメージは削除）
- [ ] デプロイ時間帯が適切（本番環境は業務時間外推奨）

### デプロイ後チェックリスト

- [ ] ECSタスクが全て `RUNNING` 状態
- [ ] ターゲットグループで全てのターゲットが `healthy`
- [ ] CloudWatch Logsでエラーログがない
- [ ] アプリケーションに正常にアクセスできる
- [ ] 主要な機能が動作する（ログイン、データ表示、ファイルアップロードなど）
- [ ] データベース接続が正常
- [ ] S3へのアクセスが正常

---

## 7. 便利なスクリプト

### 7-1. デプロイスクリプト（全自動）

以下のスクリプトを `scripts/deploy.sh` として保存すると便利です。

**Linux/Mac:**

```bash
#!/bin/bash
set -e

# 使用方法: ./scripts/deploy.sh dev
# または: ./scripts/deploy.sh prod

ENV=${1:-dev}

echo "========================================="
echo "Deploy to ${ENV} environment"
echo "========================================="

# 環境変数設定
export AWS_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPOSITORY=prooflink-${ENV}-app
export ECS_CLUSTER=prooflink-${ENV}-cluster
export ECS_SERVICE=prooflink-service
export ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}
export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

echo "AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "ECR Repository: ${ECR_REPOSITORY}"
echo "Image Tag: ${IMAGE_TAG}"

# Step 1: Dockerイメージをビルド
echo ""
echo "[Step 1/5] Building Docker image..."
docker build \
  --platform linux/amd64 \
  -t ${ECR_REPOSITORY}:${IMAGE_TAG} \
  -t ${ECR_REPOSITORY}:latest \
  .

# Step 2: ECRにログイン
echo ""
echo "[Step 2/5] Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Step 3: イメージにタグ付け
echo ""
echo "[Step 3/5] Tagging Docker image..."
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:latest

# Step 4: ECRにプッシュ
echo ""
echo "[Step 4/5] Pushing Docker image to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}
docker push ${ECR_URI}:latest

# Step 5: ECSサービスを更新
echo ""
echo "[Step 5/5] Updating ECS service..."
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --force-new-deployment \
  --region ${AWS_REGION} \
  > /dev/null

echo ""
echo "========================================="
echo "Deployment completed!"
echo "========================================="
echo "Image: ${ECR_URI}:${IMAGE_TAG}"
echo ""
echo "Monitor deployment:"
echo "  https://ap-northeast-1.console.aws.amazon.com/ecs/v2/clusters/${ECS_CLUSTER}/services/${ECS_SERVICE}/health"
```

**使い方:**

```bash
# スクリプトに実行権限を付与
chmod +x scripts/deploy.sh

# 開発環境にデプロイ
./scripts/deploy.sh dev

# 本番環境にデプロイ
./scripts/deploy.sh prod
```

---

**Windows (PowerShell):**

`scripts/deploy.ps1` として保存:

```powershell
param(
    [Parameter(Mandatory=$false)]
    [string]$Env = "dev"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================="
Write-Host "Deploy to $Env environment"
Write-Host "========================================="

# 環境変数設定
$env:AWS_REGION = "ap-northeast-1"
$env:AWS_ACCOUNT_ID = (aws sts get-caller-identity --query Account --output text)
$env:ECR_REPOSITORY = "prooflink-$Env-app"
$env:ECS_CLUSTER = "prooflink-$Env-cluster"
$env:ECS_SERVICE = "prooflink-service"
$env:ECR_URI = "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com/$($env:ECR_REPOSITORY)"
$env:IMAGE_TAG = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host "AWS Account ID: $($env:AWS_ACCOUNT_ID)"
Write-Host "ECR Repository: $($env:ECR_REPOSITORY)"
Write-Host "Image Tag: $($env:IMAGE_TAG)"

# Step 1: Dockerイメージをビルド
Write-Host ""
Write-Host "[Step 1/5] Building Docker image..."
docker build `
  --platform linux/amd64 `
  -t "$($env:ECR_REPOSITORY):$($env:IMAGE_TAG)" `
  -t "$($env:ECR_REPOSITORY):latest" `
  .

# Step 2: ECRにログイン
Write-Host ""
Write-Host "[Step 2/5] Logging in to ECR..."
aws ecr get-login-password --region $env:AWS_REGION | `
  docker login --username AWS --password-stdin "$($env:AWS_ACCOUNT_ID).dkr.ecr.$($env:AWS_REGION).amazonaws.com"

# Step 3: イメージにタグ付け
Write-Host ""
Write-Host "[Step 3/5] Tagging Docker image..."
docker tag "$($env:ECR_REPOSITORY):$($env:IMAGE_TAG)" "$($env:ECR_URI):$($env:IMAGE_TAG)"
docker tag "$($env:ECR_REPOSITORY):$($env:IMAGE_TAG)" "$($env:ECR_URI):latest"

# Step 4: ECRにプッシュ
Write-Host ""
Write-Host "[Step 4/5] Pushing Docker image to ECR..."
docker push "$($env:ECR_URI):$($env:IMAGE_TAG)"
docker push "$($env:ECR_URI):latest"

# Step 5: ECSサービスを更新
Write-Host ""
Write-Host "[Step 5/5] Updating ECS service..."
aws ecs update-service `
  --cluster $env:ECS_CLUSTER `
  --service $env:ECS_SERVICE `
  --force-new-deployment `
  --region $env:AWS_REGION `
  | Out-Null

Write-Host ""
Write-Host "========================================="
Write-Host "Deployment completed!"
Write-Host "========================================="
Write-Host "Image: $($env:ECR_URI):$($env:IMAGE_TAG)"
Write-Host ""
Write-Host "Monitor deployment:"
Write-Host "  https://ap-northeast-1.console.aws.amazon.com/ecs/v2/clusters/$($env:ECS_CLUSTER)/services/$($env:ECS_SERVICE)/health"
```

**使い方:**

```powershell
# 開発環境にデプロイ
.\scripts\deploy.ps1 -Env dev

# 本番環境にデプロイ
.\scripts\deploy.ps1 -Env prod
```

---

## 8. 参考リンク

- [AWS環境構築ガイド](./AWS_SETUP_GUIDE.md) - AWS環境の構築手順
- [CI/CDセットアップ](./CI_CD_SETUP.md) - 自動デプロイの設定
- [クイックスタートガイド](./QUICKSTART.md) - ローカル開発環境のセットアップ

---

**作成日**: 2026-02-10
**対象環境**: 開発・本番共通
**前提**: AWS環境が構築済みであること
