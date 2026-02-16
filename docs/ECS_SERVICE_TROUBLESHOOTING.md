# ECS サービス 503エラー トラブルシューティング

## 問題: 503エラー、ターゲットが登録されない

### 診断手順

#### 1. ECSタスクの状態確認

```bash
aws ecs list-tasks \
  --cluster prooflink-dev-cluster \
  --service-name prooflink-service \
  --region ap-northeast-1
```

**タスクが0個の場合** → タスクが起動していない（原因を確認）

```bash
# サービスのイベントログを確認
aws ecs describe-services \
  --cluster prooflink-dev-cluster \
  --services prooflink-service \
  --region ap-northeast-1 \
  --query 'services[0].events[0:5]'
```

#### 2. タスクの詳細確認（タスクが存在する場合）

```bash
# タスクARNを取得
TASK_ARN=$(aws ecs list-tasks \
  --cluster prooflink-dev-cluster \
  --service-name prooflink-service \
  --region ap-northeast-1 \
  --query 'taskArns[0]' \
  --output text)

# タスクの詳細を確認
aws ecs describe-tasks \
  --cluster prooflink-dev-cluster \
  --tasks $TASK_ARN \
  --region ap-northeast-1
```

#### 3. ターゲットグループの確認

```bash
# ターゲットグループのARNを取得
TG_ARN=$(aws elbv2 describe-target-groups \
  --names prooflink-tg \
  --region ap-northeast-1 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# ターゲットの状態を確認
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --region ap-northeast-1
```

---

## ECSサービスの正しい設定値

### 前提条件

以下が既に作成されていることを確認：
- ✅ VPC (例: `prooflink-dev-vpc`)
- ✅ プライベートサブネット（例: `prooflink-dev-subnet-private1`）
- ✅ セキュリティグループ（例: `prooflink-ecs-sg`）
- ✅ ターゲットグループ（例: `prooflink-tg`）
- ✅ タスク定義（例: `prooflink-dev-task:latest`）

---

## AWS マネジメントコンソールでの設定手順

### Step 1: ECSサービス基本設定

1. **ECS** → **クラスター** → `prooflink-dev-cluster` を開く
2. **サービス** タブ → **作成** をクリック

#### コンピューティング設定

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **コンピューティングオプション** | **起動タイプ** | Fargateを選択 |
| **プラットフォームのバージョン** | **LATEST** | 最新版を使用 |

#### デプロイ設定

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **アプリケーションタイプ** | **サービス** | |
| **ファミリー** | `prooflink-dev-task` | 作成済みのタスク定義 |
| **リビジョン** | **LATEST (推奨)** | 常に最新リビジョンを使用 |
| **サービス名** | `prooflink-service` | |
| **サービスタイプ** | **レプリカ** | |
| **必要なタスク** | **1** (開発環境) / **2** (本番環境) | |

#### デプロイオプション（展開）

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **デプロイタイプ** | **ローリング更新** | |
| **最小ヘルシーパーセント** | **100** | 常に1台以上稼働 |
| **最大パーセント** | **200** | 新旧タスク同時稼働を許可 |

---

### Step 2: ネットワーキング設定（重要！）

#### VPCとサブネット

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **VPC** | `prooflink-dev-vpc` | 作成済みのVPC |
| **サブネット** | **プライベートサブネットを選択** | ⚠️ 重要：パブリックサブネットは選択しない |

開発環境の場合:
```
✅ prooflink-dev-subnet-private1-ap-northeast-1a (10.0.11.0/24)
```

本番環境の場合（Multi-AZ）:
```
✅ prooflink-prod-subnet-private1-ap-northeast-1a (10.0.11.0/24)
✅ prooflink-prod-subnet-private2-ap-northeast-1c (10.0.12.0/24)
```

#### セキュリティグループ

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **セキュリティグループ** | `prooflink-ecs-sg` | ECS用SG |
| **既存のセキュリティグループを使用** | ✅ チェック | 新規作成しない |

⚠️ **既存のデフォルトSGは削除してください**

#### パブリックIP

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **パブリックIPの自動割り当て** | **オフ（DISABLED）** | ⚠️ 重要：プライベートサブネット使用時は必ずオフ |

---

### Step 3: ロードバランシング設定（重要！）

#### ロードバランサータイプ

| 項目 | 設定値 |
|------|--------|
| **ロードバランサータイプ** | **Application Load Balancer** |
| **ロードバランサー** | **既存のロードバランサーを使用** を選択 |
| **ロードバランサー名** | `prooflink-alb` |

#### ロードバランサーコンテナ

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **コンテナ** | `prooflink-app:3000` | タスク定義で定義したコンテナ名とポート |
| **リスナー** | **既存のリスナーを使用** | |
| **プロトコル** | **HTTP** (開発) / **HTTPS** (本番) | |
| **ポート** | **80** (開発) / **443** (本番) | |

#### ターゲットグループ

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **ターゲットグループ** | **既存のターゲットグループを使用** | |
| **ターゲットグループ名** | `prooflink-tg` | 事前に作成済みのTG |
| **ヘルスチェックの猶予期間** | **60秒** | タスク起動後、ヘルスチェックを開始するまでの待機時間 |

⚠️ **重要**: 新しいターゲットグループを作成しないこと

---

### Step 4: サービスの自動スケーリング（オプション）

開発環境では無効でOK。本番環境の場合：

| 項目 | 設定値 |
|------|--------|
| **サービスの自動スケーリング** | 有効（本番環境のみ） |
| **最小タスク数** | 2 |
| **最大タスク数** | 4 |
| **スケーリングポリシー** | ターゲット追跡 |
| **メトリクス** | ECSServiceAverageCPUUtilization |
| **ターゲット値** | 70% |

---

### Step 5: タグとレビュー

| 項目 | 設定値 |
|------|--------|
| **タグ** | 任意（例: `Environment: dev`, `Project: prooflink`） |

**作成** をクリック

---

## よくある設定ミスとチェックポイント

### ❌ ミス1: パブリックサブネットを選択している

**症状**: タスクが起動するが、ECRからイメージをプルできない

**正しい設定**:
- ✅ プライベートサブネットを選択
- ✅ パブリックIPは「オフ」
- ✅ NAT Gatewayが存在すること

### ❌ ミス2: パブリックIPを「オン」にしている（プライベートサブネット使用時）

**症状**: タスクが起動しない、またはECRアクセスエラー

**正しい設定**:
- プライベートサブネット使用時は**必ずオフ**

### ❌ ミス3: ターゲットグループが関連付けられていない

**症状**: タスクは起動するが、ALBからアクセスできない（503エラー）

**確認方法**:
```bash
aws elbv2 describe-target-health \
  --target-group-arn <YOUR_TG_ARN> \
  --region ap-northeast-1
```

**正しい設定**:
- サービス作成時に必ずターゲットグループを選択
- コンテナポート `3000` が正しく設定されていること

### ❌ ミス4: セキュリティグループの設定ミス

**症状**: タスクは起動するが、ヘルスチェックが失敗する

**確認ポイント**:

**ECSセキュリティグループ (`prooflink-ecs-sg`)**

インバウンドルール:
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| カスタムTCP | 3000 | `prooflink-alb-sg` | ALBからのアクセス |

アウトバウンドルール:
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | 0.0.0.0/0 | 外部API、NAT Gateway経由 |
| PostgreSQL | 5432 | `prooflink-rds-sg` | RDSへの接続 |
| HTTPS | 443 | `prooflink-vpce-sg` | VPCエンドポイント |

**ALBセキュリティグループ (`prooflink-alb-sg`)**

アウトバウンドルール:
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| カスタムTCP | 3000 | `prooflink-ecs-sg` | ECSへの通信 |

### ❌ ミス5: ヘルスチェック設定が厳しすぎる

**症状**: タスクが起動してもすぐに停止する

**ターゲットグループのヘルスチェック設定**:

| 項目 | 推奨値 | 説明 |
|------|--------|------|
| ヘルスチェックプロトコル | HTTP | |
| ヘルスチェックパス | `/api/health` | |
| ポート | トラフィックポート | |
| 正常のしきい値 | **2回** | 2回成功で healthy |
| 非正常のしきい値 | **3回** | 3回失敗で unhealthy |
| タイムアウト | **5秒** | |
| 間隔 | **30秒** | |
| 成功コード | **200** | |

**ECSサービスのヘルスチェック猶予期間**: 60秒以上

---

## トラブルシューティングコマンド集

### 1. サービスの状態確認

```bash
aws ecs describe-services \
  --cluster prooflink-dev-cluster \
  --services prooflink-service \
  --region ap-northeast-1 \
  --query 'services[0].[status,runningCount,desiredCount,deployments[0].status]' \
  --output table
```

### 2. タスクが起動しない場合

```bash
# 最新のイベントを確認
aws ecs describe-services \
  --cluster prooflink-dev-cluster \
  --services prooflink-service \
  --region ap-northeast-1 \
  --query 'services[0].events[0:10].[createdAt,message]' \
  --output table
```

### 3. タスクの停止理由を確認

```bash
# 停止したタスクを確認
aws ecs list-tasks \
  --cluster prooflink-dev-cluster \
  --desired-status STOPPED \
  --region ap-northeast-1

# 停止理由を確認
aws ecs describe-tasks \
  --cluster prooflink-dev-cluster \
  --tasks <TASK_ARN> \
  --region ap-northeast-1 \
  --query 'tasks[0].[stoppedReason,stopCode,containers[0].reason]'
```

### 4. CloudWatch Logsを確認

```bash
# 最新のログを確認
aws logs tail /ecs/prooflink-dev-app-server \
  --since 10m \
  --follow \
  --region ap-northeast-1
```

### 5. ターゲットの登録状態を確認

```bash
# ターゲットグループのARNを取得
aws elbv2 describe-target-groups \
  --names prooflink-tg \
  --region ap-northeast-1 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text

# ターゲットの健全性を確認
aws elbv2 describe-target-health \
  --target-group-arn <YOUR_TG_ARN> \
  --region ap-northeast-1
```

**期待される出力（正常時）**:
```json
{
    "TargetHealthDescriptions": [
        {
            "Target": {
                "Id": "10.0.11.123",
                "Port": 3000
            },
            "HealthCheckPort": "3000",
            "TargetHealth": {
                "State": "healthy"
            }
        }
    ]
}
```

**ターゲットが登録されていない場合**:
```json
{
    "TargetHealthDescriptions": []
}
```

→ サービスとターゲットグループの関連付けが正しくない

---

## サービスを再作成する場合

設定ミスが多い場合は、サービスを削除して再作成することを推奨します。

### 削除手順

```bash
# 1. サービスのタスク数を0に設定
aws ecs update-service \
  --cluster prooflink-dev-cluster \
  --service prooflink-service \
  --desired-count 0 \
  --region ap-northeast-1

# 2. サービスを削除
aws ecs delete-service \
  --cluster prooflink-dev-cluster \
  --service prooflink-service \
  --force \
  --region ap-northeast-1
```

### 再作成

上記の「AWS マネジメントコンソールでの設定手順」に従って再作成してください。

---

## チェックリスト

サービス作成前に以下を確認：

- [ ] VPCとプライベートサブネットが作成済み
- [ ] NAT Gatewayが作成され、プライベートサブネットのルートテーブルに設定済み
- [ ] セキュリティグループ（ECS用、ALB用、RDS用）が作成済み
- [ ] ターゲットグループが作成済み（ポート3000、ヘルスチェックパス `/api/health`）
- [ ] タスク定義が最新版で作成済み
- [ ] ECRにDockerイメージがプッシュ済み

サービス作成時の設定：

- [ ] プライベートサブネットを選択
- [ ] パブリックIPは「オフ」
- [ ] ECS用セキュリティグループを選択
- [ ] ロードバランサーで既存のALBを選択
- [ ] 既存のターゲットグループ `prooflink-tg` を選択
- [ ] コンテナポートが `3000` に設定されている
- [ ] ヘルスチェック猶予期間が `60秒` 以上

---

## さらなる支援

上記で解決しない場合は、以下の情報を共有してください：

1. ECSサービスの設定（JSON）
2. タスク定義（JSON）
3. ターゲットグループの設定
4. CloudWatch Logsのエラーメッセージ
5. セキュリティグループの設定

```bash
# サービス設定をエクスポート
aws ecs describe-services \
  --cluster prooflink-dev-cluster \
  --services prooflink-service \
  --region ap-northeast-1 \
  > ecs-service.json

# タスク定義をエクスポート
aws ecs describe-task-definition \
  --task-definition prooflink-dev-task \
  --region ap-northeast-1 \
  > task-definition.json
```
