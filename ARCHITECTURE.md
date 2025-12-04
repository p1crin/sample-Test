# テストケースDB システムアーキテクチャ

## 簡潔版アーキテクチャ（お客様向け）

### システム概要

このテストケースDB システムは、以下のようなシンプルな構成で実現されています：

1. **あなたのデバイス** (PC/スマートフォン)
   - Webブラウザでアクセス
   - ユーザー認証で安全にログイン

2. **インターネット接続層** (Amazon AWS)
   - **Route 53**: ドメイン名解決（DNS）
   - **CloudFront**: グローバルコンテンツ配信ネットワーク（CDN）

3. **クラウド上のアプリケーション** (Amazon AWS - ECS Fargate)
   - **ECS Fargate** 上で実行される Next.js アプリケーション
   - テストケース管理
   - テスト結果記録
   - ユーザー管理
   - レポート生成

4. **クラウド上のデータ保存** (Amazon AWS)
   - **RDS Aurora PostgreSQL**: テスト情報、ユーザー情報などを安全に保存
   - **Amazon S3**: 制御仕様書、テスト証拠などの添付ファイルを保存

5. **バックアップ & 監視** (Amazon AWS)
   - **CloudWatch**: ログ記録とシステム監視 (24時間監視)
   - **X-Ray**: リクエストトレーシングと性能分析
   - **RDS 自動バックアップ**: 毎日自動的にデータをバックアップ
   - **AWS Batch**: 非同期処理（CSV取込など）を夜間に実行

### 主要な特徴

| 特徴 | 説明 |
|-----|------|
| **信頼性** | 複数のデータセンター (マルチAZ) で運用、自動フェイルオーバー対応 |
| **セキュリティ** | 全データ暗号化、アクセス制御、監査ログ記録 |
| **可用性** | 99.9% の稼働保証 (年間99時間以内のダウンタイム) |
| **スケーラビリティ** | ユーザー数やデータ量に応じて自動的に拡張 |
| **バックアップ** | 毎日自動バックアップ、7日間保持 |

---

### ビジュアルアーキテクチャ図

```plantuml
@startuml 簡潔版_テストケースDBアーキテクチャ

skinparam linetype ortho
skinparam rectangle {
    BackgroundColor #FFFFFF
    BorderColor #333333
    FontColor #000000
}

rectangle "ユーザー" #E8F4F8 {
    card "Web ブラウザ\nスマートフォン" as users
}

rectangle "クラウド インターネット" #FFF4E6 {
    card "Route 53 & CloudFront\n(DNS & CDN 高速配信)" as cdn
}

rectangle "アプリケーション\n(AWS クラウド)" #E8F4F8 {
    card "ECS Fargate\n(Next.js アプリ\nテストケース入力\n結果記録 等)" as app
}

rectangle "データ保存\n(AWS クラウド)" #F0F0F0 {
    card "RDS Aurora\nPostgreSQL\n(テスト情報)" as db
    card "Amazon S3\n(添付ファイル\nエビデンス画像)" as storage
}

rectangle "バックアップ & 監視\n(AWS クラウド)" #F5F5F5 {
    card "CloudWatch & X-Ray\n(ログ・監視\n自動バックアップ)" as backup
    card "AWS Batch\n(非同期処理\nCSV取込等)" as batch
}

users --> cdn: インターネット接続
cdn --> app: リクエスト送信
app --> db: データ読み書き
app --> storage: ファイル管理
db --> backup: 毎日自動バックアップ
app --> batch: 自動処理（夜間）
storage --> backup: ファイル整理

note right of users
  • PCやスマートフォンから
    いつでもアクセス
  • ユーザー認証で安全
end note

note right of app
  • テストケース管理
  • テスト結果記録
  • レポート生成
  • ユーザー管理
end note

note right of db
  • テスト情報を整理
    して保存
  • 高速検索
  • データ暗号化
end note

note right of storage
  • 制御仕様書
  • データフロー図
  • テスト証拠
    （画像など）
end note

note right of backup
  • 毎日自動バックアップ
  • ディザスタリカバリ対応
  • 古いファイル自動削除
end note

legend right
    信頼性: マルチAZ、自動フェイルオーバー
    セキュリティ: 暗号化、アクセス制御、監査ログ
    可用性: 99.9% SLA
    スケーラビリティ: 自動スケーリング
end legend

@enduml
```

---

## 詳細版アーキテクチャ（技術者向け）

### PlantUML アーキテクチャ図

```plantuml
@startuml テストケースDB_システムアーキテクチャ

skinparam linetype ortho
skinparam rectangle {
    BackgroundColor #FFFFFF
    BorderColor #333333
    FontColor #000000
}
skinparam note {
    BackgroundColor #FFFFCC
    BorderColor #666666
}

' ユーザー層
rectangle "ユーザー層" #E8F4F8 {
    card "Webブラウザ" as browser
}

' フロントエンド層
rectangle "フロントエンド層" #E8F4F8 {
    rectangle "Next.js Frontend\n(React 19 + TailwindCSS)" {
        card "Reactコンポーネント" as components
        card "Redux ストア\n(auth, sidebar)" as redux
    }
}

' バックエンド層
rectangle "バックエンド層" #FFF4E6 {
    rectangle "Next.js API Routes (TypeScript)" {
        card "APIエンドポイント\n/api/test-groups\n/api/test-cases\n/api/test-results\n/api/tags, /api/users\n/api/import-*\n/api/s3-presigned-url" as endpoints
    }
    card "NextAuth.js\n(JWT認証)" as auth
    card "Prisma ORM" as prisma
}

' データベース層
rectangle "データベース層" #F0F0F0 {
    database "PostgreSQL (Neon)" as postgres
    note right of postgres
        mt_users (ユーザー)
        mt_tags (タグ)
        tt_test_groups (テストグループ)
        tt_test_cases (テストケース)
        tt_test_contents (テスト内容)
        tt_test_results (テスト結果)
        tt_test_evidences (エビデンス)
        tt_import_results (インポート結果)
    end note
}

' AWSサービス
rectangle "AWSサービス (ap-northeast-1)" #FFF0F5 {
    card "AWS S3\n(ファイルストレージ)" as s3
    note right of s3
        • テストケースファイル
        • エビデンス画像
        • 一時ファイル (24h lifecycle)
        • 署名付きURL: 1時間有効
    end note
}

' オプションサービス
rectangle "オプションサービス" #F5F5F5 {
    card "AWS Batch\n(非同期インポート)" as batch
}

' 接続関係
browser --> components: UI操作
components --> redux: 状態管理
components --> endpoints: API呼び出し
redux --> auth: JWT トークン

endpoints --> auth: トークン検証
endpoints --> prisma: クエリ実行
prisma --> postgres: SQL

endpoints --> s3: 署名付きURL
s3 --> postgres: メタデータ保存

endpoints -.-> batch: オプション

legend right
    <b>主要技術スタック</b>
    Frontend: Next.js 15.3 + React 19 + Redux
    Backend: Node.js + NextAuth.js + Prisma
    Database: PostgreSQL (Neon)
    Storage: AWS S3 (ap-northeast-1)
    Security: JWT認証、ロールベースアクセス制御
end legend

@enduml
```

## 主要コンポーネント

### フロントエンド
- **技術**: Next.js 15.3.3 + React 19
- **状態管理**: Redux Toolkit
- **スタイリング**: TailwindCSS 4.1.10
- **UIコンポーネント**: Radix UI
- **認証**: NextAuth.js セッションプロバイダー

### バックエンド
- **実行環境**: Node.js (Next.js API ルート)
- **認証**: NextAuth.js Credentials プロバイダー
- **ORM**: Prisma 6.19.0
- **データベースクエリ**: Prisma + Raw PostgreSQL (pg クライアント)
- **ファイル処理**: AWS SDK for S3

### データベース
- **種類**: PostgreSQL (Neon サーバーレス)
- **スキーマ**: 8つのメインモデル (ソフトデリート対応)
- **機能**: トランザクション、複合キー、監査フィールド (created_at, updated_at, created_by, updated_by)

### AWSサービス
- **S3**: テストケースファイル、エビデンス、一時アップロードのストレージ
- **Batch** (オプション): 非同期インポート処理用
- **リージョン**: ap-northeast-1 (東京)

## データフロー

### 1. テストケース新規登録
```
ユーザー → ブラウザ → Reactフォーム
  ↓
NextAuth検証
  ↓
Next.js API (/api/test-cases/regist)
  ↓
ファイルアップロード → AWS S3 (署名付きURL)
  ↓
メタデータ保存 → PostgreSQL (Prisma経由)
  ↓
確認 → ブラウザ
```

### 2. テスト結果記録
```
ユーザー → テスト結果フォーム
  ↓
エビデンスアップロード → AWS S3
  ↓
API /api/test-groups/[groupId]/cases/[tid]/results
  ↓
レコード作成 in tt_test_results
  ↓
前回結果をアーカイブ → tt_test_results_history
  ↓
Redux ストア更新
```

### 3. インポート処理
```
CSVファイルアップロード
  ↓
/api/import-cases または /api/import-users
  ↓
パース & バリデーション (CSV パーサー)
  ↓
データベーストランザクション
  ├→ レコード作成
  ├→ エラーログ
  └→ ステータス更新
  ↓
結果をブラウザに返す
```

## 環境変数設定
```bash
# データベース
DATABASE_URL=postgresql://user@localhost:5432/testcase_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<base64エンコード済みシークレット>

# AWS
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=<キー>
AWS_SECRET_ACCESS_KEY=<シークレット>
AWS_S3_BUCKET_NAME=test-case-db-files

# ログ
NEXT_PUBLIC_ENABLE_CLIENT_LOGGING=true
```

## AWS デプロイメントアーキテクチャ

### ランタイムシーケンス（ユーザーリクエスト）

```plantuml
@startuml ランタイムシーケンス

participant "ユーザー" as user
participant "Route 53" as dns
participant "CloudFront" as cdn
participant "ALB" as alb
participant "ECS Instance" as ecs
participant "Aurora" as db
participant "S3" as s3
participant "CloudWatch" as logs

autonumber

user -> dns: DNS Query (yourdomain.com)
dns --> user: IP Address (CloudFront)

alt Static Assets
  user -> cdn: GET /static/...
  cdn -> alb: GET /static/...
  alb -> ecs: Forward Static Request
else API/Dynamic
  user -> alb: POST /api/test-cases
  alb -> ecs: Route to Instance\n(Round Robin)
end

ecs -> db: SELECT / INSERT Query
db --> ecs: Return Results\n(Connection Pool)

ecs -> s3: Presigned URL / Upload File
s3 --> ecs: Acknowledgment

ecs -> logs: Write Application Logs
logs --> ecs: Logged

ecs --> alb: Response (JSON)
alb --> user: 200 OK\n(Content)

@enduml
```

### デプロイメントシーケンス（CI/CD）

```plantuml
@startuml デプロイメントシーケンス

participant "Developer" as dev
participant "GitHub" as github
participant "GitHub Actions" as actions
participant "Docker Builder" as docker
participant "Amazon ECR" as ecr
participant "ECS Service" as ecs
participant "ECS Task" as task1
participant "ECS Task" as task2
participant "ECS Task" as task3

autonumber

dev -> github: git push to main
activate github
github -> actions: Trigger Workflow

activate actions
actions -> docker: Build Docker Image\n(Dockerfile)
activate docker
docker --> actions: Image Built\n(test-case-db:latest)
deactivate docker

actions -> ecr: Login + Push Image
activate ecr
ecr --> actions: Pushed\ntest-case-db:latest
deactivate ecr

actions -> ecs: Update Service\n(force-new-deployment)
deactivate actions

activate ecs
ecs -> task1: Stop Old Task
ecs -> task2: Stop Old Task
ecs -> task3: Stop Old Task

note over ecs
  Pull from ECR
  create new tasks
end note

ecs -> ecr: Pull Image\ntest-case-db:latest
ecs -> task1: Launch New Task (v2)
ecs -> task2: Launch New Task (v2)
ecs -> task3: Launch New Task (v2)

task1 -> task1: Health Check ✓
task2 -> task2: Health Check ✓
task3 -> task3: Health Check ✓

ecs -> ecs: Update Target Group\nRoute Traffic to v2
ecs --> github: Deployment Complete ✓
deactivate ecs
deactivate github

@enduml
```

### データベースバックアップ & ストレージシーケンス

```plantuml
@startuml バックアップ＆ストレージ

participant "Aurora\n(Primary)" as aurora_primary
participant "Aurora Replica" as aurora_replica
participant "Automated Backup" as backup
participant "S3 Application" as s3_app
participant "S3 Archive" as s3_archive
participant "Glacier" as glacier

== Continuous Replication ==
autonumber 1
aurora_primary -> aurora_replica: Binary Log Stream\n(Sync)
aurora_replica --> aurora_primary: Acknowledged

== Daily Backup (00:00 UTC) ==
autonumber 2
aurora_primary -> backup: Create Automated Backup\n(Snapshot)
backup --> aurora_primary: Backup Complete\n(retention: 7 days)

== S3 Lifecycle ==
autonumber 3
s3_app -> s3_app: Store Files\n(created_at: Day 0)
note over s3_app
  /temp/* (24 hour retention)
  /archive/* (permanent)
end note

par S3 Temp Cleanup
  s3_app -> s3_app: Day 1 - Delete\ntemp files > 24h
else S3 Archive Transition
  s3_app -> s3_archive: Day 90 - Move\narchive to S3-IA
end

par Quarterly Archive
  s3_archive -> glacier: Day 90+ - Archive\nto Glacier\n(cost: $0.004/GB/month)
end

@enduml
```

## AWS 本番環境詳細アーキテクチャ図

```plantuml
@startuml AWS本番環境詳細アーキテクチャ

skinparam linetype ortho
skinparam rectangle {
    BackgroundColor #FFFFFF
    BorderColor #333333
    FontColor #000000
}

' ユーザー層
rectangle "ユーザー層" #E8F4F8 {
    card "Webユーザー" as users
}

' CDN & DNS
rectangle "CDN & DNS (グローバル)" #FFF4E6 {
    card "Route 53" as route53
    card "CloudFront" as cloudfront
}

' ロード分散
rectangle "ロード分散層 (ap-northeast-1)" #FFF4E6 {
    card "Application\nLoad Balancer\n(HTTPS/443)" as alb
}

' コンピュート層
rectangle "コンピュート層 (ECS Fargate)" #E8F4F8 {
    rectangle "ECS Cluster" {
        card "Next.js App\nContainer v1" as app1
        card "Next.js App\nContainer v2" as app2
        card "Next.js App\nContainer v3" as app3
    }
}

' バッチ処理層
rectangle "バッチ処理層 (AWS Batch)" #FFFACD {
    card "AWS Batch\nJob Queue" as batch_queue
    rectangle "Batch Compute Environment" {
        card "CSV Import\nJob" as batch_import
        card "Report\nGeneration Job" as batch_report
    }
}

' データベース層
rectangle "データベース層 (RDS Aurora)" #F0F0F0 {
    rectangle "Aurora PostgreSQL Cluster" {
        card "Primary\nInstance" as db_primary
        card "Read Replica\nAZ-1" as db_replica1
        card "Read Replica\nAZ-2" as db_replica2
    }
    card "Automated\nBackup" as db_backup
}

' ストレージ層
rectangle "ストレージ層 (S3)" #FFF0F5 {
    card "S3 Bucket\n(Application)" as s3_main
    card "S3 Standard-IA\n(Archive)" as s3_archive
    card "Glacier\n(Long-term)" as glacier
}

' 監視・ロギング層
rectangle "監視・ロギング・セキュリティ" #F5F5F5 {
    card "CloudWatch\nLogs" as cwlogs
    card "CloudWatch\nMetrics" as cwmetrics
    card "X-Ray\nTracing" as xray
    card "CloudTrail\nAudit" as cloudtrail
}

' キャッシング層
rectangle "キャッシング層 (オプション)" #FFFACD {
    card "ElastiCache\n(Redis)" as redis
}

' CI/CD パイプライン
rectangle "CI/CD & 構成管理" #E8F0FF {
    card "GitHub\nRepository" as github_repo
    card "GitHub\nActions" as github_actions
    card "Amazon ECR\n(Docker Registry)" as ecr
}

' ネットワーク層
rectangle "ネットワーク & セキュリティ" #F0F0F0 {
    card "VPC\n(Private Subnets)" as vpc
    card "Security\nGroups" as sg
    card "IAM Roles &\nPolicies" as iam
}

' 接続関係
users --> route53: DNS Query
route53 --> cloudfront: Static Assets
route53 --> alb: API Requests

cloudfront --> alb: Cache Miss
alb --> app1: Load Balance\n(Round Robin)
alb --> app2: Health Check
alb --> app3: Auto Scale

app1 --> db_primary: Write Ops\n(INSERT/UPDATE)
app2 --> db_replica1: Read Ops\n(SELECT)
app3 --> db_replica2: Read Ops\n(SELECT)

db_primary --> db_replica1: Replication
db_primary --> db_replica2: Replication
db_primary --> db_backup: Daily Snapshot\n(7-day retention)

app1 --> s3_main: Upload Files\n(Presigned URLs)
app2 --> s3_main: Download Files
app3 --> s3_main: Store Evidence

s3_main --> s3_archive: Lifecycle Policy\n(Day 90)
s3_archive --> glacier: Quarterly Archive\n(Day 180)

app1 --> redis: Cache Query\n(Session, Data)
app2 --> redis: Cache Hit
app3 --> redis: Cache Invalidate

app1 --> cwlogs: Application Logs
app2 --> cwmetrics: Performance Metrics
app3 --> xray: Distributed Trace
app1 --> cloudtrail: API Audit

batch_queue --> batch_import: CSV Import Jobs
batch_queue --> batch_report: Report Generation
batch_import --> db_primary: Write Results
batch_report --> db_replica1: Read Data
batch_report --> s3_main: Store Reports

github_repo --> github_actions: Trigger Build
github_actions --> ecr: Push Image
ecr --> app1: Deploy v1
ecr --> app2: Deploy v2
ecr --> app3: Deploy v3

vpc -.-> alb: Network
vpc -.-> db_primary: Network
vpc -.-> app1: Network
sg -.-> alb: Port 443 (HTTPS)
sg -.-> app1: Port 3000
sg -.-> db_primary: Port 5432
iam -.-> app1: Credentials
iam -.-> batch_import: Permissions

note right of db_primary
    **RDS Aurora PostgreSQL**
    • マルチAZ (High Availability)
    • Auto Failover: 30秒以内
    • Connection Pool: PgBouncer
    • Encryption: AWS KMS
    • Backup: 7日間保持
end note

note right of s3_main
    **S3 Lifecycle**
    Day 0: Standard (hot files)
    Day 90: Standard-IA (archive)
    Day 180: Glacier (cold storage)
    Cost: Standard $0.023/GB
          → S3-IA $0.0125/GB
          → Glacier $0.004/GB
end note

note right of batch_import
    **AWS Batch Jobs**
    • CSV Import (Daily 00:00 JST)
    • Report Generation (Weekly)
    • Data Archive (Monthly)
    • Max Duration: 12 hours
end note

legend right
    <b>AWS 本番環境構成</b>
    コンピュート: ECS Fargate (オートスケーリング)
    データベース: RDS Aurora PostgreSQL (マルチAZ)
    ストレージ: S3 (ライフサイクル管理)
    バッチ: AWS Batch (非同期ジョブ)
    キャッシング: ElastiCache Redis (オプション)
    監視: CloudWatch + X-Ray
    CI/CD: GitHub Actions → ECR → ECS
end legend

@enduml
```

## ランタイムアーキテクチャ図

```plantuml
@startuml 本番環境ランタイムアーキテクチャ

skinparam linetype ortho
skinparam rectangle {
    BackgroundColor #FFFFFF
    BorderColor #333333
}

' インターネット層
rectangle "インターネット" #E8F4F8 {
    card "ユーザー" as users
}

' DNS & CDN
rectangle "DNS & CDN層" #FFF4E6 {
    card "Route 53\n(DNS)" as route53
    card "CloudFront\n(CDN/Cache)" as cloudfront
}

' ロードバランサー
rectangle "ロード分散層" #FFF4E6 {
    card "ALB\n(HTTPS/443)" as alb
}

' コンピュート層
rectangle "コンピュート層 (ap-northeast-1)" #E8F4F8 {
    rectangle "ECS Fargate Cluster" {
        card "Next.js\n(Replica 1)" as app1
        card "Next.js\n(Replica 2)" as app2
        card "Next.js\n(Replica 3)" as app3
    }
}

' データ層
rectangle "データ層" #F0F0F0 {
    card "Aurora Primary\nPostgreSQL" as aurora_p
    card "Aurora Replica\n(Read)" as aurora_r
}

' ストレージ層
rectangle "ストレージ層" #FFF0F5 {
    card "S3\nApplication" as s3_app
    card "S3\nArchive\n(24h cleanup)" as s3_archive
}

' モニタリング & ロギング
rectangle "モニタリング層" #F5F5F5 {
    card "CloudWatch\nLogs" as cwlogs
    card "CloudWatch\nMetrics" as cwmetrics
    card "X-Ray" as xray
}

' 接続関係 (ランタイム)
users --> route53: 1. DNS Query

route53 --> cloudfront: 2. Resolve Static Assets
route53 --> alb: 3. Resolve API Endpoint

cloudfront --> alb: 4. Cache Miss → ALB

alb --> app1: 5a. Load Balance\n(Round Robin)
alb --> app2: 5b. Health Check
alb --> app3: 5c. Auto Scale

app1 --> aurora_p: 6a. Write Query\n(INSERT/UPDATE)
app2 --> aurora_r: 6b. Read Query\n(SELECT)
app3 --> aurora_p: 6c. Async Job

aurora_p --> aurora_r: 7. Binary Replication\n(Sync)

app1 --> s3_app: 8a. Upload/Download\n(Presigned URL)
app2 --> s3_app: 8b. File Operation
app3 --> s3_app: 8c. Evidence Storage

app1 --> cwlogs: 9a. Application Logs
app2 --> cwlogs: 9b. Error Logs
app3 --> cwlogs: 9c. Audit Logs

app1 --> cwmetrics: 10a. Performance Metrics
app2 --> xray: 10b. Distributed Trace
app3 --> xray: 10c. API Performance

legend right
    <b>ランタイムシーケンス</b>
    1-4: DNS + CDN ルーティング
    5: ALB ロードバランシング
    6-7: データベース読み書き
    8: ファイル操作
    9-10: モニタリング・ロギング
end legend

@enduml
```

### AWS デプロイメント実装詳細

#### 1. **コンピュート層** - 2つの選択肢

**オプションA: ECS on Fargate (推奨 - 本番環境)**
```bash
# ECS Task Definition (Fargate)
- CPU: 1024 (1 vCPU) / 2048 (2 vCPU)
- メモリ: 2GB / 4GB
- ネットワークモード: awsvpc
- ログドライバー: awslogs (CloudWatch Logs)
- Auto Scaling: Target Tracking (CPU 70%, Memory 80%)
- リージョン: ap-northeast-1
```

**オプションB: App Runner (開発・小規模)**
```bash
# App Runner Service
- ソース: GitHub リポジトリ
- 自動デプロイ: 有効
- CPU: 0.25 vCPU / 1 vCPU
- メモリ: 512 MB / 2 GB
- スケーリング: 1～10 インスタンス
- コールドスタート時間: 1～2分
```

#### 2. **データベース層**

```bash
# Amazon Aurora PostgreSQL
- マルチAZ配置 (高可用性)
- 読み取りレプリカ: 1～15個 (読み込み負荷分散)
- バックアップ保持期間: 7日 (自動日次バックアップ)
- 自動フェイルオーバー: 有効 (30秒以内)
- パラメータグループ: カスタム最適化
- 暗号化: 保存時 (AWS KMS)、転送中 (SSL/TLS)
- ビジネスアワー外: 予約済みインスタンス
```

#### 3. **ストレージ層**

```bash
# Amazon S3
- バケット: test-case-db-files (us-east-1 リージョン)
- アクセス: VPC Endpoint (NAT料金削減)
- ライフサイクルポリシー:
  - /temp/* → 24時間後削除
  - /archive/* → 90日後 Glacier へ移動
- バージョニング: 有効 (データ保護)
- サーバー側暗号化: AES-256
- CloudFront オリジン: ダウンロード高速化
```

#### 4. **セキュリティ設定**

```bash
# VPC & ネットワークセキュリティ
- VPC: プライベートサブネット (各AZ)
- セキュリティグループ:
  * ALB: 443 (HTTPS) からのトラフィック許可
  * ECS: ALB からのみ 3000ポート許可
  * Aurora: ECS からのみ 5432ポート許可
- NAT ゲートウェイ: 送信トラフィック用

# IAM ロール & ポリシー
- ecsTaskExecutionRole: CloudWatch Logs, ECR 読み取り
- ecsTaskRole: S3, RDS (IAM認証)
- GitHub Actions: OIDC フェデレーション (キー不要)

# SSL/TLS
- ACM 証明書: 無料自動更新
- 最小TLSバージョン: 1.2
```

#### 5. **CI/CD パイプライン (GitHub Actions)**

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    steps:
      # 1. AWS認証 (OIDC)
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/GitHubActionsRole
          aws-region: ap-northeast-1

      # 2. コンテナビルド
      - name: Build Docker image
        run: |
          aws ecr get-login-password --region ap-northeast-1 | \
            docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
          docker build -t test-case-db:${{ github.sha }} .
          docker tag test-case-db:${{ github.sha }} \
            ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/test-case-db:latest

      # 3. ECR へプッシュ
      - name: Push to Amazon ECR
        run: |
          docker push ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/test-case-db:latest

      # 4. ECS デプロイ
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster test-case-db-cluster \
            --service test-case-db-service \
            --force-new-deployment \
            --region ap-northeast-1
```

#### 6. **環境変数・シークレット管理**

```bash
# AWS Secrets Manager
- NEXTAUTH_SECRET: 暗号化保存
- DATABASE_URL: Aurora エンドポイント
- AWS_ACCESS_KEY_ID: IAM ロール使用（不要）
- AWS_SECRET_ACCESS_KEY: IAM ロール使用（不要）

# Parameter Store (非機密設定)
- NEXTAUTH_URL: https://yourdomain.com
- AWS_REGION: ap-northeast-1
- AWS_S3_BUCKET_NAME: test-case-db-files
```

#### 7. **コスト最適化**

| リソース | 推定月額費用 | 最適化 |
|---------|----------|------|
| **ECS Fargate** | $50～100 | 自動スケーリング、オンデマンド |
| **Aurora PostgreSQL** | $100～200 | 予約済みインスタンス、オートスケーリング |
| **S3** | $10～50 | ライフサイクルポリシー、アクセスレベル |
| **CloudFront** | $20～50 | キャッシュ設定、リージョン最適化 |
| **CloudWatch** | $10～20 | ログ保持期間: 7日、メトリクスフィルター |
| **NAT Gateway** | $30 | VPC エンドポイント使用 |
| **合計** | **$220～450** | 予約済みインスタンス活用で -30% |

#### 8. **スケーリング戦略**

```bash
# ECS Auto Scaling
- ターゲットトラッキング: CPU 70%, Memory 80%
- 段階スケーリング: スケールアップ +2インスタンス, スケールダウン -1インスタンス
- クールダウン時間: 5分

# Aurora Auto Scaling
- 読み取りレプリカ: 自動追加（コンピュートスケーリング）
- ストレージ: 自動拡張 (初期 100GB → 最大 128TB)
```

#### 9. **ディザスタリカバリ**

```bash
# バックアップ戦略
- Aurora: 自動日次バックアップ + ポイントイン タイムリカバリ (7日)
- S3: バージョニング有効 + CloudTrail監査
- RTO (目標復旧時間): 30分
- RPO (目標復旧時点): 5分

# マルチリージョン (オプション)
- プライマリ: ap-northeast-1 (東京)
- セカンダリ: ap-southeast-1 (シンガポール)
- DMS (Database Migration Service) でレプリケーション
```

## セキュリティ機能

1. **認証**: NextAuth.js メール/パスワード + JWT
2. **認可**: ロールベースアクセス制御 (ADMIN, TEST_MANAGER, GENERAL)
3. **パスワード**: bcryptjsでハッシュ化 (ソルト付き)
4. **API保護**: ミドルウェアで JWT トークン検証
5. **S3アクセス**: 署名付きURL (1時間有効期限)
6. **監査ログ**: created_by, updated_by, created_at, updated_at フィールド
7. **ソフトデリート**: is_deleted フラグでデータ保持

## パフォーマンス考慮事項

1. **データベース**: コネクションプーリング (Neon経由)
2. **S3**: 署名付きURLで直接アップロード (サーバー経由不要)
3. **キャッシング**: Redux ストアでクライアント状態管理
4. **ページネーション**: APIエンドポイントで limit/offset サポート
5. **クエリ最適化**: PostgreSQL インデックス
6. **ログ**: クライアント/サーバー側ログでモニタリング

