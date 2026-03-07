# AWS環境構築手順書（開発・本番共通）

## 目次

1. [はじめに](#1-はじめに)
2. [前提条件](#2-前提条件)
3. [全体構成](#3-全体構成)
4. [開発環境と本番環境のリソース共用方針](#4-開発環境と本番環境のリソース共用方針)
5. [構築手順](#5-構築手順)
   - [Step 1: VPCとネットワーク](#step-1-vpcとネットワーク)
   - [Step 2: VPCエンドポイント](#step-2-vpcエンドポイント)
   - [Step 3: セキュリティグループ](#step-3-セキュリティグループ)
   - [Step 4: RDS PostgreSQL](#step-4-rds-postgresql)
   - [Step 5: Secrets Manager](#step-5-secrets-manager)
   - [Step 6: S3バケット](#step-6-s3バケット)
   - [Step 7: IAMロール（開発・本番共用）](#step-7-iamロール開発本番共用)
   - [Step 8: ECRリポジトリ](#step-8-ecrリポジトリ)
   - [Step 9: ECSクラスターとタスク定義](#step-9-ecsクラスターとタスク定義)
   - [Step 10: SSL証明書（ACM）](#step-10-ssl証明書acm)
   - [Step 11: ロードバランサー（ALB）](#step-11-ロードバランサーalb)
   - [Step 12: WAF設定](#step-12-waf設定)
   - [Step 13: Route 53 DNS設定](#step-13-route-53-dns設定)
   - [Step 14: CloudWatch設定・証明書失効通知](#step-14-cloudwatch設定証明書失効通知)
   - [Step 15: CloudFront設定（testgenアプリ統合）](#step-15-cloudfront設定testgenアプリ統合)
6. [コスト最適化設定（開発環境）](#6-コスト最適化設定開発環境)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. はじめに

### 本ドキュメントの目的

このガイドは、ProofLinkシステムをAWS上に構築する手順を説明します。**全ての操作をAWSマネジメントコンソール（Webブラウザ）で実施**します。

### 対象環境

- **開発環境**: コストを抑えた小規模構成
- **本番環境**: 可用性とセキュリティを重視した構成

### 主な変更点（2026-03-07）

- ✅ **CloudFront設定を追加（Step 15）**: testgenアプリ（htmx + Lambda）をtestcasedbと同一ドメインで統合配信
- ✅ **アーキテクチャ図を更新**: CloudFront + Lambda構成を反映
- ✅ **WAF設定をCloudFront対応に拡張**: us-east-1（Global）スコープのIP Set・Web ACL追加
- ✅ **ALBへの直接アクセス制限手順を追加**: CloudFront経由のみに制限

### 以前の変更点（2026-03-02）

- ✅ **NATゲートウェイを廃止**: VPCエンドポイントのみで構成（コスト削減・セキュリティ強化）
- ✅ **開発・本番のリソース共用方針を明記**: IAMロール等の共用可能なリソースを整理
- ✅ **S3バケット構成を修正**: インポート用・エビデンス用の2バケット構成に変更
- ✅ **Secrets Managerの設定方法を修正**: DATABASE_URLを正しく格納する手順に変更
- ✅ **本番ドメイン設定手順を追加**: Route 53によるドメイン設定を詳述
- ✅ **ACM証明書失効通知を追加**: SNS + EventBridgeによるメール通知設定

### 以前の変更点（2026-01-28）

- ✅ **ECSをプライベートサブネットに配置**: セキュリティ強化（ALB経由のみアクセス可）
- ✅ **WAF追加**: IP制限によるアクセス制御
- ✅ **Secrets Manager追加**: RDS認証情報の安全な管理
- ✅ **VPCエンドポイント追加**: ECR、Secrets Manager用
- ✅ **AWSコンソール操作**: CLI不要、全てブラウザ操作で完結

---

## 2. 前提条件

### 2.1 必要なもの

| 項目 | 説明 |
|------|------|
| AWSアカウント | 管理者権限（AdministratorAccess）を持つアカウント |
| ドメイン | 本番環境用（例: prooflink.example.com） |
| メールアドレス | SSL証明書検証用・証明書失効通知用 |

### 2.2 使用リージョン

本手順では **東京リージョン（ap-northeast-1）** を使用します。

### 2.3 事前確認事項

| 確認項目 | 開発環境 | 本番環境 |
|---------|---------|---------|
| 独自ドメイン | 不要（ALBのDNS名を使用） | 必要 |
| SSL証明書 | 不要（HTTP可） | 必要 |
| Multi-AZ構成 | 不要 | 推奨 |

---

## 3. 全体構成

### 3.1 セキュリティを重視した構成

**セキュリティ要件:**
- ECS Fargateはプライベートサブネットに配置（ALB経由のみアクセス可）
- WAFでIP制限を実施（許可されたIPのみアクセス可）
- RDS認証情報はSecrets Managerで管理
- VPCエンドポイントでプライベート通信（NATゲートウェイ不使用）
- ECSタスクからインターネットへの直接アクセスは不可（セキュリティ強化）

### 3.2 アーキテクチャ図

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                    │
│                                                                          │
│  ┌────────────────────┐  ┌─────────────┐                                │
│  │  WAF（CloudFront用）│  │ Secrets Mgr │                                │
│  │  （IP制限, us-east-1）│  │ （RDS認証）  │                                │
│  └─────────┬──────────┘  └─────────────┘                                │
│            │                                                             │
│  ┌─────────▼──────────────────────────────────────────┐                 │
│  │        CloudFront (prooflink.example.com)           │                 │
│  │                                                     │                 │
│  │   /testgen*  ──→ Lambda Function URL (htmxアプリ)   │                 │
│  │   /* (default) ──→ ALB (testcasedb)                 │                 │
│  └──────────────────────┬──────────────────────────────┘                 │
│                         │                                                │
│  ┌──────────────────────▼─────────────────────────────────────────────┐ │
│  │           VPC (10.0.0.0/16)                                         │ │
│  │                                                                     │ │
│  │  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  │        Public Subnet (10.0.1.0/24, 10.0.2.0/24)              │ │ │
│  │  │                                                               │ │ │
│  │  │  ┌──────────────┐                                             │ │ │
│  │  │  │     ALB      │                                             │ │ │
│  │  │  │ (Internet-   │                                             │ │ │
│  │  │  │  facing)     │                                             │ │ │
│  │  │  └──────┬───────┘                                             │ │ │
│  │  └─────────┼─────────────────────────────────────────────────────┘ │ │
│  │            │                                                       │ │
│  │  ┌─────────▼─────────────────────────────────────────────────────┐ │ │
│  │  │      Private Subnet (10.0.11.0/24, 10.0.12.0/24)             │ │ │
│  │  │                                                               │ │ │
│  │  │  ┌──────────────────┐  ┌──────────────────┐                  │ │ │
│  │  │  │  ECS Fargate     │  │ RDS PostgreSQL   │                  │ │ │
│  │  │  │ （プライベート）   │─▶│ （Multi-AZ）     │                  │ │ │
│  │  │  └──────────────────┘  └──────────────────┘                  │ │ │
│  │  │                                                               │ │ │
│  │  │  ┌──────────────────────────────────────────────────────────┐│ │ │
│  │  │  │  VPCエンドポイント                                        ││ │ │
│  │  │  │  (S3, ECR API/DKR, Secrets Mgr, CW Logs)               ││ │ │
│  │  │  └──────────────────────────────────────────────────────────┘│ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  ┌─────────┐ │
│  │    S3      │  │     ECR      │  │  CloudWatch    │  │ Lambda  │ │
│  │（ストレージ）│  │（コンテナ     │  │ （ログ・監視）  │  │(testgen)│ │
│  │            │  │ レジストリ）  │  │                │  │         │ │
│  └────────────┘  └──────────────┘  └────────────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                         ▲
                         │ HTTPS（許可IPのみ）
                         │
                  ┌──────┴──────┐
                  │   ユーザー   │
                  └─────────────┘
```

### 3.3 主要コンポーネント

| コンポーネント | 用途 | 配置場所 |
|--------------|------|---------|
| **CloudFront** | CDN・パスベースルーティング（testcasedb / testgen振り分け） | エッジロケーション |
| **WAF** | IP制限によるアクセス制御 | CloudFrontに関連付け（us-east-1） |
| **ALB** | アプリケーションへの負荷分散 | パブリックサブネット |
| **ECS Fargate** | testcasedbアプリケーション実行 | **プライベートサブネット** |
| **Lambda** | testgenアプリケーション実行（htmx） | マネージドサービス |
| **RDS PostgreSQL** | データベース | プライベートサブネット |
| **Secrets Manager** | RDS認証情報の管理 | マネージドサービス |
| **S3** | ファイルストレージ（インポート用・エビデンス用） | マネージドサービス |
| **ECR** | Dockerイメージ保管 | マネージドサービス |
| **VPCエンドポイント** | プライベート通信（NATゲートウェイ不要） | VPC内 |

> **NATゲートウェイを使用しない理由**: 本構成ではECSタスクからのAWSサービスへのアクセスは全てVPCエンドポイント経由で行います。外部インターネットへのアクセスは不要なため、NATゲートウェイは使用しません。これにより月額約¥5,000〜¥10,000のコスト削減が可能で、かつECSタスクからの意図しない外部通信を防止できます。

---

## 4. 開発環境と本番環境のリソース共用方針

開発環境を先に構築し、本番環境を後から追加する場合のリソース共用方針を以下に示します。

### 4.1 共用できるリソース（再作成不要）

以下のリソースは開発環境で作成したものを本番環境でもそのまま使用します。

| リソース | 説明 | 理由 |
|---------|------|------|
| **IAMロール** | `prooflink-ecs-task-execution-role`<br>`prooflink-ecs-task-role` | S3ポリシーがワイルドカード（`prooflink-*`）で両環境のバケットをカバー |
| **Route 53 ホストゾーン** | `example.com` のホストゾーン | 同一ドメイン内に開発・本番のレコードを追加可能 |
| **WAF IPセット** | `prooflink-allowed-ips`（Regional）<br>`prooflink-allowed-ips-global`（CloudFront用） | 同じ許可IPアドレスリストを使用する場合 |
| **CloudFrontディストリビューション** | `prooflink.example.com` | testcasedb・testgenの両アプリを統合配信 |
| **SNSトピック** | `prooflink-cert-expiry-alert` | 証明書失効通知は環境を問わず同じ通知先でよい |

### 4.2 本番環境用に新規作成が必要なリソース

| リソース | 開発環境 | 本番環境（新規作成） |
|---------|---------|-------------------|
| VPC・サブネット | `prooflink-dev-vpc` | `prooflink-prod-vpc` |
| VPCエンドポイント | 開発VPC内 | 本番VPC内に新規作成 |
| セキュリティグループ | 開発VPC内 | 本番VPC内に新規作成（VPCに紐づくため共用不可） |
| RDS | `prooflink-dev-db` | `prooflink-prod-db` |
| Secrets Manager | `prooflink/dev/*` | `prooflink/prod/*` |
| S3バケット | `prooflink-dev-imports`<br>`prooflink-dev-evidence` | `prooflink-prod-imports`<br>`prooflink-prod-evidence` |
| ECRリポジトリ | `prooflink-dev-app` | `prooflink-prod-app` |
| ECSクラスター | `prooflink-dev-cluster` | `prooflink-prod-cluster` |
| ALB | `prooflink-dev-alb` | `prooflink-prod-alb` |
| ACM証明書（東京） | 不要（HTTP） | 本番ドメイン用に新規取得 |
| ACM証明書（us-east-1） | 不要 | CloudFront用に新規取得 |
| WAF Web ACL（Regional） | `prooflink-dev-waf-acl` | `prooflink-prod-waf-acl`（本番ALBに関連付け） |
| WAF Web ACL（Global） | 不要 | `prooflink-prod-cf-waf-acl`（CloudFrontに関連付け） |
| CloudFront | 不要 | `prooflink-prod-cf`（本番のみ） |
| CloudWatch ロググループ | `/ecs/prooflink-dev-*` | `/ecs/prooflink-prod-*` |

> **ポイント**: 本番環境の構築手順は開発環境と同じです。各Stepで「本番環境」の設定値を選択してください。

---

## 5. 構築手順

### Step 1: VPCとネットワーク

#### 1-1. VPCの作成

1. **AWSマネジメントコンソール**にログイン
2. 画面上部の検索バーで「**VPC**」と入力してVPCダッシュボードを開く
3. 左メニューから「**VPC**」→「**VPCを作成**」をクリック

**設定値:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 作成するリソース | VPCなど | VPCなど |
| 名前タグの自動生成 | `prooflink-dev` | `prooflink-prod` |
| IPv4 CIDRブロック | `10.0.0.0/16` | `10.0.0.0/16` |
| IPv6 CIDRブロック | なし | なし |
| テナンシー | デフォルト | デフォルト |
| **アベイラビリティゾーン（AZ）の数** | **1** | **2** |
| **パブリックサブネットの数** | **1** | **2** |
| **プライベートサブネットの数** | **1** | **2** |
| **NATゲートウェイ** | **なし** | **なし** |
| **VPCエンドポイント** | S3ゲートウェイ | S3ゲートウェイ |

4. 「**VPCを作成**」をクリック

**作成されるリソース:**

開発環境:
```
prooflink-dev-vpc (10.0.0.0/16)
├── prooflink-dev-subnet-public1-ap-northeast-1a (10.0.1.0/24)
├── prooflink-dev-subnet-private1-ap-northeast-1a (10.0.11.0/24)
├── prooflink-dev-igw（インターネットゲートウェイ）
├── prooflink-dev-vpce-s3（S3 VPCエンドポイント）
└── ルートテーブル（パブリック用、プライベート用）
```

本番環境:
```
prooflink-prod-vpc (10.0.0.0/16)
├── prooflink-prod-subnet-public1-ap-northeast-1a (10.0.1.0/24)
├── prooflink-prod-subnet-public2-ap-northeast-1c (10.0.2.0/24)
├── prooflink-prod-subnet-private1-ap-northeast-1a (10.0.11.0/24)
├── prooflink-prod-subnet-private2-ap-northeast-1c (10.0.12.0/24)
├── prooflink-prod-igw（インターネットゲートウェイ）
├── prooflink-prod-vpce-s3（S3 VPCエンドポイント）
└── ルートテーブル（パブリック用、プライベート用）
```

> **重要**: NATゲートウェイは「なし」を選択します。プライベートサブネットからのAWSサービスへのアクセスはStep 2のVPCエンドポイントで対応します。

---

### Step 2: VPCエンドポイント

NATゲートウェイを使用しないため、プライベートサブネットからAWSサービスにアクセスするには**VPCエンドポイントが必須**です。

> **重要**: 以下のVPCエンドポイントが全て作成されていないと、ECSタスクの起動やログ送信が失敗します。

#### 2-1. ECR APIエンドポイント

1. 「**VPC**」→「**エンドポイント**」→「**エンドポイントを作成**」

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-{env}-vpce-ecr-api` |
| サービスカテゴリ | AWSサービス |
| サービス | `com.amazonaws.ap-northeast-1.ecr.api` |
| VPC | `prooflink-{env}-vpc` |
| サブネット | プライベートサブネットを選択 |
| セキュリティグループ | VPCエンドポイント用SG（Step 3で作成） |
| ポリシー | フルアクセス |

> `{env}` は `dev` または `prod` に読み替えてください。

#### 2-2. ECR DKRエンドポイント

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-{env}-vpce-ecr-dkr` |
| サービス | `com.amazonaws.ap-northeast-1.ecr.dkr` |
| （その他の設定は2-1と同様） | |

#### 2-3. Secrets Managerエンドポイント

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-{env}-vpce-secretsmanager` |
| サービス | `com.amazonaws.ap-northeast-1.secretsmanager` |
| （その他の設定は2-1と同様） | |

#### 2-4. CloudWatch Logsエンドポイント

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-{env}-vpce-logs` |
| サービス | `com.amazonaws.ap-northeast-1.logs` |
| （その他の設定は2-1と同様） | |

> **補足**: S3はVPC作成時にゲートウェイ型エンドポイント（無料）が作成済みです。ECR API/DKR、Secrets Manager、CloudWatch Logsはインターフェース型エンドポイント（有料・各約¥400/月）です。

> **VPCエンドポイントが必要な理由（NATゲートウェイなしの場合）:**
> - **ECR API + DKR**: ECSがDockerイメージをプルするために必要
> - **S3ゲートウェイ**: ECRのイメージレイヤー取得に必要（VPC作成時に自動作成済み）
> - **Secrets Manager**: ECSタスク起動時に環境変数をSecrets Managerから取得するために必要
> - **CloudWatch Logs**: ECSタスクのログ送信に必要

---

### Step 3: セキュリティグループ

#### 3-1. ALB用セキュリティグループ

1. 「**VPC**」→「**セキュリティグループ**」→「**セキュリティグループを作成**」

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-{env}-alb-sg` |
| 説明 | Security group for ALB |
| VPC | `prooflink-{env}-vpc` |

**インバウンドルール:**

開発環境:
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTP | 80 | 0.0.0.0/0 | 開発環境はHTTP許可 |
| HTTPS | 443 | 0.0.0.0/0 | HTTPS |

本番環境:
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | 0.0.0.0/0 | HTTPSのみ許可（WAFでIP制限） |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| カスタムTCP | 3000 | `prooflink-{env}-ecs-sg` | ECSへの通信のみ |

#### 3-2. ECS用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-{env}-ecs-sg` |
| 説明 | Security group for ECS tasks |
| VPC | `prooflink-{env}-vpc` |

**インバウンドルール:**
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| カスタムTCP | 3000 | `prooflink-{env}-alb-sg` | ALBからのアクセスのみ許可 |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | `prooflink-{env}-vpce-sg` | VPCエンドポイント経由（ECR, Secrets Manager, CloudWatch Logs） |
| PostgreSQL | 5432 | `prooflink-{env}-rds-sg` | RDSへの接続 |

> **ポイント**: NATゲートウェイを使用しないため、アウトバウンドに `0.0.0.0/0` は不要です。VPCエンドポイントとRDSへの通信のみ許可することで、ECSタスクからの意図しない外部通信を防止できます。

#### 3-3. RDS用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-{env}-rds-sg` |
| 説明 | Security group for RDS PostgreSQL |
| VPC | `prooflink-{env}-vpc` |

**インバウンドルール:**
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| PostgreSQL | 5432 | `prooflink-{env}-ecs-sg` | ECSからのアクセスのみ |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

#### 3-4. VPCエンドポイント用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-{env}-vpce-sg` |
| 説明 | Security group for VPC Endpoints |
| VPC | `prooflink-{env}-vpc` |

**インバウンドルール:**
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | `prooflink-{env}-ecs-sg` | ECSからのアクセス |
| HTTPS | 443 | VPC CIDR (10.0.0.0/16) | VPC内からのアクセス |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

> **注意**: Step 2のVPCエンドポイント作成時にこのセキュリティグループを指定するため、先にこのStep 3でSGを作成してからStep 2を実行するか、VPCエンドポイント作成後にSGを変更してください。実際の作業順序としては、**SGを先に全て作成してからVPCエンドポイントを作成**することを推奨します。

---

### Step 4: RDS PostgreSQL

> **注意**: Secrets Manager（Step 5）でDATABASE_URLを登録するためにRDSエンドポイントが必要です。RDSを先に作成します。

#### 4-1. サブネットグループの作成

1. 「**RDS**」→「**サブネットグループ**」→「**DBサブネットグループを作成**」

| 項目 | 値 |
|------|-----|
| 名前 | `prooflink-{env}-db-subnet-group` |
| 説明 | Subnet group for prooflink database |
| VPC | `prooflink-{env}-vpc` |
| アベイラビリティゾーン | プライベートサブネットのあるAZを選択 |
| サブネット | **プライベートサブネット**を選択 |

開発環境: 1つのプライベートサブネットを選択
本番環境: 2つのプライベートサブネットを選択

> **注意**: RDSのサブネットグループには最低2つのAZが必要です。開発環境でAZが1つの場合でも、RDSサブネットグループ作成時には2つのAZのサブネットが必要になることがあります。その場合は、VPCに追加のプライベートサブネット（別AZ）を手動で作成してください。

#### 4-2. RDSインスタンスの作成

1. 「**RDS**」→「**データベース**」→「**データベースの作成**」

**エンジンのオプション:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| エンジンタイプ | PostgreSQL | PostgreSQL |
| エンジンバージョン | PostgreSQL 15.x | PostgreSQL 15.x |
| テンプレート | **開発/テスト** | **本番稼働用** |

**設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| DBインスタンス識別子 | `prooflink-dev-db` | `prooflink-prod-db` |
| マスターユーザー名 | `postgres` | `postgres` |
| マスターパスワード | （強力なパスワードを設定） | （強力なパスワードを設定） |

> **パスワードの要件**: 最低8文字、英数字記号を含む

**インスタンスの設定:**

| 項目 | 開発環境（コスト重視） | 本番環境（性能重視） |
|------|-------------------|------------------|
| DBインスタンスクラス | **db.t4g.micro** (2vCPU 1GB)<br>月額約1,500円 | **db.t4g.medium** (2vCPU 4GB)<br>月額約6,000円 |
| ストレージタイプ | **gp3** | **gp3** |
| ストレージ割り当て | **20 GiB** | **100 GiB** |
| ストレージ自動スケーリング | 無効 | 有効（最大500GiB） |
| IOPS | 3000（gp3デフォルト） | 3000〜12000 |

**可用性と耐久性:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| Multi-AZ配置 | **スタンバイなし**（Single-AZ） | **Multi-AZ DBインスタンス** |

**接続:**

| 項目 | 値 |
|------|-----|
| VPC | `prooflink-{env}-vpc` |
| DBサブネットグループ | `prooflink-{env}-db-subnet-group` |
| **パブリックアクセス** | **なし**（重要） |
| VPCセキュリティグループ | `prooflink-{env}-rds-sg` |
| データベースポート | 5432 |

**追加設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 最初のデータベース名 | `prooflink_dev` | `prooflink_prod` |
| **自動バックアップ** | **無効**（コスト削減） | **有効** |
| バックアップ保持期間 | - | 7日 |
| **暗号化** | **無効** | **有効（推奨）** |
| **削除保護** | 無効 | **有効** |
| **Performance Insights** | 無効 | 有効 |

2. 「**データベースの作成**」をクリック

作成には10〜15分かかります。ステータスが「**利用可能**」になるまで待ちます。

#### 4-3. データベース接続情報の確認

1. 作成したRDSインスタンスをクリック
2. 「**接続とセキュリティ**」タブで**エンドポイント**をコピー

例: `prooflink-dev-db.xxxxx.ap-northeast-1.rds.amazonaws.com`

この情報は次のStep 5（Secrets Manager）でDATABASE_URLを作成する際に使用します。

---

### Step 5: Secrets Manager

RDSの接続文字列とアプリケーション用シークレットを安全に管理するためにSecrets Managerを使用します。

#### 5-1. RDS接続文字列シークレットの作成

1. 「**Secrets Manager**」→「**新しいシークレットを保存する**」

| 項目 | 値 |
|------|-----|
| シークレットのタイプ | **その他のシークレットのタイプ** |
| キー/値のペア | 下記参照 |
| 暗号化キー | `aws/secretsmanager`（デフォルト） |

**キー/値の設定:**

| キー | 値 |
|------|-----|
| `DATABASE_URL` | `postgresql://postgres:{パスワード}@{RDSエンドポイント}:5432/{DB名}` |

開発環境の例:
```
postgresql://postgres:YourPassword123@prooflink-dev-db.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/prooflink_dev
```

本番環境の例:
```
postgresql://postgres:YourPassword123@prooflink-prod-db.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/prooflink_prod
```

2. 「**次**」をクリック

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| シークレットの名前 | `prooflink/dev/rds-credentials` | `prooflink/prod/rds-credentials` |
| 説明 | RDS connection string for ProofLink dev | RDS connection string for ProofLink prod |

3. 「**次**」をクリック（自動ローテーションはオフ）
4. 「**保存**」をクリック

#### 5-2. アプリケーションシークレットの作成

1. 「**Secrets Manager**」→「**新しいシークレットを保存する**」

| 項目 | 値 |
|------|-----|
| シークレットのタイプ | **その他のシークレットのタイプ** |

**キー/値の設定:**

| キー | 値 |
|------|-----|
| `NEXTAUTH_SECRET` | （ランダムに生成した文字列） |

> **NEXTAUTH_SECRETの生成方法:**
>
> Linuxの場合: `openssl rand -base64 64`
>
> Windowsの場合: PowerShellで `[Convert]::ToBase64String((1..64|%{Get-Random -Max 256}))`

2. 「**次**」をクリック

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| シークレットの名前 | `prooflink/dev/app-secrets` | `prooflink/prod/app-secrets` |
| 説明 | Application secrets for ProofLink dev | Application secrets for ProofLink prod |

3. 「**次**」→「**保存**」をクリック

#### 5-3. シークレットのARN確認

作成した各シークレットをクリックし、**シークレットのARN**をコピーします。

例:
- `arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/dev/rds-credentials-xxxxxx`
- `arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/dev/app-secrets-xxxxxx`

これらのARNは後ほどECSタスク定義で使用します。

#### 5-4. ECSタスク実行ロールにSecrets Managerアクセス権限を追加

ECSタスク実行ロール（`prooflink-ecs-task-execution-role`）にSecrets Managerへのアクセス権限を追加する必要があります。

1. 「**IAM**」→「**ロール**」→`prooflink-ecs-task-execution-role`をクリック
2. 「**許可を追加**」→「**インラインポリシーを作成**」
3. 「**JSON**」タブを選択して以下を貼り付け:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "SecretsManagerAccess",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "arn:aws:secretsmanager:ap-northeast-1:*:secret:prooflink/*"
            ]
        }
    ]
}
```

4. ポリシー名: `ProoflinkSecretsManagerReadPolicy`
5. 「**ポリシーを作成**」をクリック

---

### Step 6: S3バケット

アプリケーションではインポート用とエビデンス用の**2つのS3バケット**を使用します。

#### 6-1. インポート用バケットの作成

1. 「**S3**」→「**バケットを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| バケット名 | `prooflink-dev-imports` | `prooflink-prod-imports` |
| AWSリージョン | ap-northeast-1 | ap-northeast-1 |
| オブジェクト所有者 | ACL無効（推奨） | ACL無効（推奨） |
| **ブロックパブリックアクセス** | **すべてブロック**（必須） | **すべてブロック**（必須） |
| バケットのバージョニング | 無効 | 有効 |
| デフォルトの暗号化 | SSE-S3 | SSE-S3 |

2. 「**バケットを作成**」をクリック

#### 6-2. エビデンス用バケットの作成

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| バケット名 | `prooflink-dev-evidence` | `prooflink-prod-evidence` |
| （その他の設定は6-1と同様） | | |

> **バケット名の注意**: S3バケット名は全世界で一意である必要があります。バケット名が既に使用されている場合は、末尾にランダム文字列を追加してください（例: `prooflink-prod-imports-20260302`）。

#### 6-3. CORSの設定（ブラウザから直接アップロードする場合）

各バケットで以下のCORS設定を行います:

1. バケットを選択
2. 「**アクセス許可**」タブ
3. 「**クロスオリジンリソース共有（CORS）**」→「**編集**」

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://your-alb-domain.ap-northeast-1.elb.amazonaws.com",
            "https://prooflink.example.com"
        ],
        "ExposeHeaders": ["ETag"]
    }
]
```

> **注意**: `AllowedOrigins` は実際のALB DNS名とドメイン名に置き換えてください。

4. 「**変更を保存**」をクリック

---

### Step 7: IAMロール（開発・本番共用）

> **共用リソース**: IAMロールはアカウント全体のリソースのため、開発環境で作成済みの場合は本番環境で再作成不要です。S3ポリシーがワイルドカード（`prooflink-*`）で両環境をカバーしています。

#### 7-1. ECSタスク実行ロール

このロールは、ECSがECRからイメージをプルし、CloudWatch Logsにログを送信するために必要です。

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service → **Elastic Container Service Task** |

2. 「**次へ**」をクリック

**許可ポリシー:**
- `AmazonECSTaskExecutionRolePolicy`（AWSマネージドポリシー）

3. 「**次へ**」をクリック

| 項目 | 値 |
|------|-----|
| ロール名 | `prooflink-ecs-task-execution-role` |
| 説明 | Execution role for ECS tasks |

4. 「**ロールを作成**」をクリック

> **重要**: 作成後、Step 5-4のSecrets Managerアクセス用インラインポリシーも追加してください。

#### 7-2. ECSタスクロール

このロールは、アプリケーションがS3やCloudWatch Logsにアクセスするために必要です。

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service → **Elastic Container Service Task** |

2. 「**次へ**」をクリック（ポリシーは後で追加）

| 項目 | 値 |
|------|-----|
| ロール名 | `prooflink-ecs-task-role` |

3. 「**ロールを作成**」をクリック

4. 作成したロール `prooflink-ecs-task-role` をクリック

5. 「**許可を追加**」→「**インラインポリシーを作成**」

6. 「**JSON**」タブを選択して以下を貼り付け:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3Access",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::prooflink-*",
                "arn:aws:s3:::prooflink-*/*"
            ]
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams"
            ],
            "Resource": "arn:aws:logs:ap-northeast-1:*:log-group:/ecs/prooflink-*:*"
        },
        {
            "Sid": "BatchAccess",
            "Effect": "Allow",
            "Action": [
                "batch:SubmitJob",
                "batch:DescribeJobs"
            ],
            "Resource": "*"
        }
    ]
}
```

7. ポリシー名: `ProoflinkECSTaskPolicy`
8. 「**ポリシーを作成**」をクリック

> **ポイント**: S3のResourceに `prooflink-*` を使用しているため、`prooflink-dev-imports`、`prooflink-dev-evidence`、`prooflink-prod-imports`、`prooflink-prod-evidence` の全バケットに対してアクセスできます。

---

### Step 8: ECRリポジトリ

#### 8-1. アプリケーション用リポジトリの作成

1. 「**ECR**」→「**リポジトリ**」→「**リポジトリを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 可視性設定 | プライベート | プライベート |
| リポジトリ名 | `prooflink-dev-app` | `prooflink-prod-app` |
| タグのイミュータビリティ | 無効 | 有効（推奨） |
| プッシュ時のスキャン | 無効 | 有効（推奨） |
| 暗号化設定 | AES-256 | AES-256 |

2. 「**リポジトリを作成**」をクリック

#### 8-2. バッチワーカー用リポジトリの作成

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| リポジトリ名 | `prooflink-dev-batch` | `prooflink-prod-batch` |
| （その他の設定は8-1と同様） | | |

#### 8-3. リポジトリURIの確認

作成したリポジトリをクリックして、**URI**をコピーします。

例: `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app`

この情報は後ほどDockerイメージのプッシュ時に使用します。

---

### Step 9: ECSクラスターとタスク定義

#### 9-1. ECSクラスターの作成

1. 「**ECS**」→「**クラスター**」→「**クラスターの作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| クラスター名 | `prooflink-dev-cluster` | `prooflink-prod-cluster` |
| インフラストラクチャ | AWS Fargate（サーバーレス） | AWS Fargate（サーバーレス） |
| Container Insights | オフ（コスト削減） | オン（推奨） |

2. 「**作成**」をクリック

#### 9-2. CloudWatch Logsグループの作成

アプリケーションログを管理するためのロググループを作成します。

**ECSコンテナ標準出力ログ用:**

1. 「**CloudWatch**」→「**ロググループ**」→「**ロググループを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロググループ名 | `/ecs/prooflink-dev-app` | `/ecs/prooflink-prod-app` |
| ログの保持期間 | 7日 | 30日 |

**サーバーログ用（APIエラー、DB接続エラーなど）:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロググループ名 | `/ecs/prooflink-dev-app-server` | `/ecs/prooflink-prod-app-server` |
| ログの保持期間 | 7日 | 30日 |

**クライアントログ用（ブラウザエラー、UI操作ログなど）:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロググループ名 | `/ecs/prooflink-dev-app-client` | `/ecs/prooflink-prod-app-client` |
| ログの保持期間 | 3日 | 7日 |

> **注意**: クライアントログは量が多くなる傾向があるため、保持期間を短めに設定してコストを削減します。

#### 9-3. タスク定義の作成

1. 「**ECS**」→「**タスク定義**」→「**新しいタスク定義の作成**」

**基本設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| タスク定義ファミリー | `prooflink-dev-task` | `prooflink-prod-task` |
| 起動タイプ | AWS Fargate | AWS Fargate |
| OS/アーキテクチャ | Linux/X86_64 | Linux/X86_64 |
| **CPU** | **0.5 vCPU**（コスト削減） | **1 vCPU** |
| **メモリ** | **1 GB**（コスト削減） | **2 GB** |
| タスクロール | `prooflink-ecs-task-role` | `prooflink-ecs-task-role` |
| タスク実行ロール | `prooflink-ecs-task-execution-role` | `prooflink-ecs-task-execution-role` |

**コンテナの設定:**

| 項目 | 値 |
|------|-----|
| コンテナ名 | `prooflink-app` |
| **イメージURI** | `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-{env}-app:latest` |
| ポートマッピング | コンテナポート: `3000`, プロトコル: TCP, 名前: `app-3000-tcp` |

**環境変数:**

| キー | 値の種類 | 開発環境の値 | 本番環境の値 | 説明 |
|------|---------|------------|------------|------|
| NEXTAUTH_URL | Value | `http://{ALBのDNS名}` | `https://prooflink.example.com` | アプリケーションURL |
| AWS_REGION | Value | `ap-northeast-1` | `ap-northeast-1` | AWSリージョン |
| S3_IMPORT_BUCKET | Value | `prooflink-dev-imports` | `prooflink-prod-imports` | インポート用S3バケット名 |
| S3_EVIDENCE_BUCKET | Value | `prooflink-dev-evidence` | `prooflink-prod-evidence` | エビデンス用S3バケット名 |
| AWS_BATCH_JOB_QUEUE | Value | `prooflink-dev-job-queue` | `prooflink-prod-job-queue` | AWS Batchジョブキュー名 |
| AWS_BATCH_USER_IMPORT_JOB_DEFINITION | Value | `prooflink-dev-user-import` | `prooflink-prod-user-import` | AWS Batchジョブ定義名 |
| ENABLE_CLOUDWATCH_LOGS | Value | `true` | `true` | CloudWatch Logs直接送信の有効化 |
| CLOUDWATCH_SERVER_LOG_GROUP | Value | `/ecs/prooflink-dev-app-server` | `/ecs/prooflink-prod-app-server` | サーバーログ用ロググループ名 |
| CLOUDWATCH_CLIENT_LOG_GROUP | Value | `/ecs/prooflink-dev-app-client` | `/ecs/prooflink-prod-app-client` | クライアントログ用ロググループ名 |
| NEXT_PUBLIC_CLIENT_LOG_SEND_LEVEL | Value | `warn` | `warn` | クライアントログ送信レベル |
| NEXT_PUBLIC_CLIENT_LOG_BATCH_SIZE | Value | `10` | `10` | クライアントログバッチサイズ |
| NEXT_PUBLIC_CLIENT_LOG_BATCH_INTERVAL | Value | `30000` | `30000` | クライアントログバッチ送信間隔（ms） |

> **注意**: `NODE_ENV=production`、`PORT=3000`、`HOSTNAME=0.0.0.0` はDockerfileで設定済みのため、ECSタスク定義での設定は不要です。

**シークレットから取得する環境変数（Secrets Manager経由）:**

| キー | ValueFrom（開発環境） | ValueFrom（本番環境） |
|------|----------------------|----------------------|
| DATABASE_URL | `arn:aws:secretsmanager:ap-northeast-1:{AWSアカウントID}:secret:prooflink/dev/rds-credentials-xxxxxx:DATABASE_URL::` | `arn:aws:secretsmanager:ap-northeast-1:{AWSアカウントID}:secret:prooflink/prod/rds-credentials-xxxxxx:DATABASE_URL::` |
| NEXTAUTH_SECRET | `arn:aws:secretsmanager:ap-northeast-1:{AWSアカウントID}:secret:prooflink/dev/app-secrets-xxxxxx:NEXTAUTH_SECRET::` | `arn:aws:secretsmanager:ap-northeast-1:{AWSアカウントID}:secret:prooflink/prod/app-secrets-xxxxxx:NEXTAUTH_SECRET::` |

> **設定方法（タスク定義JSON）:**
>
> ```json
> "secrets": [
>   {
>     "name": "DATABASE_URL",
>     "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/dev/rds-credentials-xxxxxx:DATABASE_URL::"
>   },
>   {
>     "name": "NEXTAUTH_SECRET",
>     "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/dev/app-secrets-xxxxxx:NEXTAUTH_SECRET::"
>   }
> ]
> ```

> **注意**: ARNの末尾 `-xxxxxx` はSecrets Managerが自動付与するランダム文字列です。Step 5-3で確認した実際のARNを使用してください。

**ログ設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ログドライバー | awslogs | awslogs |
| awslogs-group | `/ecs/prooflink-dev-app` | `/ecs/prooflink-prod-app` |
| awslogs-region | `ap-northeast-1` | `ap-northeast-1` |
| awslogs-stream-prefix | `ecs` | `ecs` |

2. 「**作成**」をクリック

#### 9-4. ECSサービスの作成

1. 「**ECS**」→「**クラスター**」→ `prooflink-{env}-cluster`
2. 「**サービス**」タブ→「**作成**」

**デプロイ設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 起動タイプ | Fargate | Fargate |
| タスク定義 | `prooflink-dev-task` | `prooflink-prod-task` |
| サービス名 | `prooflink-dev-service` | `prooflink-prod-service` |
| 必要なタスク | `1` | `2` |

**ネットワーク設定（重要: プライベートサブネットを使用）:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| VPC | `prooflink-dev-vpc` | `prooflink-prod-vpc` |
| サブネット | **プライベートサブネット1** | **プライベートサブネット1, 2**（Multi-AZ） |
| セキュリティグループ | `prooflink-dev-ecs-sg` | `prooflink-prod-ecs-sg` |
| パブリックIP | **オフ（DISABLED）** | **オフ（DISABLED）** |

> **重要**: ECS Fargateはプライベートサブネットに配置します。パブリックIPは**割り当てない**でください。AWSサービスへのアクセスはVPCエンドポイント経由で行います。

**ロードバランサー設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロードバランサータイプ | Application Load Balancer | Application Load Balancer |
| ロードバランサー | `prooflink-dev-alb` | `prooflink-prod-alb` |
| ターゲットグループ | `prooflink-dev-tg` | `prooflink-prod-tg` |
| コンテナ名 | `prooflink-app` | `prooflink-app` |
| コンテナポート | `3000` | `3000` |

3. 「**作成**」をクリック

サービスが起動し、タスクがRunning状態になるまで数分かかります。

---

### Step 10: SSL証明書（ACM）

> **注意**: 開発環境でHTTPのみを使用する場合は、このステップをスキップできます。本番環境では必須です。

#### 10-1. Route 53 ホストゾーンの確認

ACM証明書のDNS検証にはRoute 53のホストゾーンが必要です。

1. 「**Route 53**」→「**ホストゾーン**」を開く
2. 使用するドメイン（例: `example.com`）のホストゾーンが存在することを確認

**ホストゾーンがない場合（外部レジストラでドメインを管理している場合）:**

1. 「**Route 53**」→「**ホストゾーン**」→「**ホストゾーンの作成**」
2. ドメイン名: `example.com`
3. タイプ: パブリックホストゾーン
4. 「**ホストゾーンの作成**」をクリック
5. 作成されたホストゾーンの**NSレコード**（4つのネームサーバー）を確認
6. ドメインのレジストラ管理画面でネームサーバーをRoute 53のNSレコードに変更

> **注意**: ネームサーバー変更後、DNS伝搬に最大48時間かかる場合があります。

#### 10-2. パブリック証明書のリクエスト

1. 「**Certificate Manager**」→「**証明書をリクエスト**」

| 項目 | 値 |
|------|-----|
| 証明書タイプ | パブリック証明書をリクエスト |

2. 「**次へ**」をクリック

| 項目 | 値 |
|------|-----|
| ドメイン名 | `prooflink.example.com` |
| 検証方法 | **DNS検証**（推奨） |

> **ヒント**: ワイルドカード証明書（`*.example.com`）を取得すれば、将来サブドメインを追加する際にも対応できます。

3. 「**リクエスト**」をクリック

#### 10-3. DNS検証の実施

1. 作成した証明書をクリック
2. 「**Route 53でレコードを作成**」ボタンをクリック（Route 53を使用している場合）
3. 検証が完了するまで5〜30分待機

証明書のステータスが「**発行済み**」になれば完了です。

> **重要**: DNS検証で発行した証明書は、Route 53のCNAMEレコードが存在する限り**自動更新**されます。ただし、万が一自動更新に失敗した場合に備えて、Step 14で失効通知を設定します。

---

### Step 11: ロードバランサー（ALB）

#### 11-1. ターゲットグループの作成

1. 「**EC2**」→「**ターゲットグループ**」→「**ターゲットグループの作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ターゲットタイプ | **IPアドレス** | **IPアドレス** |
| ターゲットグループ名 | `prooflink-dev-tg` | `prooflink-prod-tg` |
| プロトコル | HTTP | HTTP |
| ポート | 3000 | 3000 |
| VPC | `prooflink-dev-vpc` | `prooflink-prod-vpc` |

**ヘルスチェック設定:**

| 項目 | 値 |
|------|-----|
| ヘルスチェックプロトコル | HTTP |
| ヘルスチェックパス | `/api/health` |
| 正常のしきい値 | 2 |
| 非正常のしきい値 | 3 |
| タイムアウト | 5秒 |
| 間隔 | 30秒 |
| 成功コード | 200 |

2. 「**次へ**」をクリック
3. ターゲットは後で登録するので、そのまま「**ターゲットグループの作成**」をクリック

#### 11-2. Application Load Balancerの作成

1. 「**EC2**」→「**ロードバランサー**」→「**ロードバランサーの作成**」
2. 「**Application Load Balancer**」の「**作成**」をクリック

**基本的な設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロードバランサー名 | `prooflink-dev-alb` | `prooflink-prod-alb` |
| スキーム | **インターネット向け** | **インターネット向け** |
| IPアドレスタイプ | IPv4 | IPv4 |

**ネットワークマッピング:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| VPC | `prooflink-dev-vpc` | `prooflink-prod-vpc` |
| マッピング | パブリックサブネット1つ | パブリックサブネット2つ |

**セキュリティグループ:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| セキュリティグループ | `prooflink-dev-alb-sg` | `prooflink-prod-alb-sg` |

**リスナーとルーティング:**

開発環境（HTTPのみ）:
| プロトコル | ポート | デフォルトアクション |
|-----------|--------|-----------------|
| HTTP | 80 | `prooflink-dev-tg`に転送 |

本番環境（HTTPS）:
| プロトコル | ポート | デフォルトアクション |
|-----------|--------|-----------------|
| HTTP | 80 | HTTPSにリダイレクト（ポート443） |
| HTTPS | 443 | `prooflink-prod-tg`に転送 |

HTTPS リスナーの追加設定:
| 項目 | 値 |
|------|-----|
| セキュリティポリシー | ELBSecurityPolicy-TLS13-1-2-2021-06 |
| デフォルトSSL/TLS証明書 | ACMで取得した証明書を選択 |

2. 「**ロードバランサーの作成**」をクリック

作成には数分かかります。ステータスが「**アクティブ**」になるまで待ちます。

#### 11-3. ALBのDNS名の確認

1. 作成したロードバランサーをクリック
2. 「**DNS名**」をコピー

例: `prooflink-dev-alb-123456789.ap-northeast-1.elb.amazonaws.com`

開発環境ではこのDNS名でアクセスします。ECSタスク定義の `NEXTAUTH_URL` にもこの値を設定してください。

---

### Step 12: WAF設定

> **注意**: IP制限によるアクセス制御が必要な場合に設定します。

#### 12-1. IP Setの作成（開発・本番共用可）

> **共用リソース**: 同じ許可IPアドレスを使用する場合、IP Setは1つで両環境のWeb ACLから参照できます。

1. 「**WAF & Shield**」→「**IP sets**」→「**Create IP set**」

| 項目 | 値 |
|------|-----|
| IP set name | `prooflink-allowed-ips` |
| Region | Asia Pacific (Tokyo) |
| IP version | IPv4 |
| IP addresses | 許可するIPアドレスを1行ずつ入力（CIDR形式） |

例:
```
203.0.113.0/24
198.51.100.10/32
```

2. 「**Create IP set**」をクリック

#### 12-2. Web ACLの作成

環境ごとに個別のWeb ACLを作成します。

1. 「**WAF & Shield**」→「**Web ACLs**」→「**Create web ACL**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| Name | `prooflink-dev-waf-acl` | `prooflink-prod-waf-acl` |
| Resource type | Regional resources | Regional resources |
| Region | Asia Pacific (Tokyo) | Asia Pacific (Tokyo) |

2. 「**Next**」をクリック

#### 12-3. ルールの追加

1. 「**Add rules**」→「**Add my own rules and rule groups**」
2. Rule type: **IP set**

| 項目 | 値 |
|------|-----|
| Name | `allow-specific-ips` |
| IP set | `prooflink-allowed-ips` |
| IP address to use | Source IP address |
| Action | **Allow** |

3. 「**Add rule**」をクリック
4. **Default action**: **Block**（デフォルトでブロック、許可IPのみ通過）
5. 「**Next**」→「**Next**」→「**Create web ACL**」をクリック

#### 12-4. ALBへの関連付け

1. 作成したWeb ACLをクリック
2. 「**Associated AWS resources**」タブ
3. 「**Add AWS resources**」
4. 対応する環境のALBを選択
5. 「**Add**」をクリック

> **重要**: WAFを設定すると、許可されたIPアドレス以外からのアクセスはすべてブロックされます。

---

### Step 13: Route 53 DNS設定

> **注意**: 本番環境で独自ドメインを使用する場合に設定します。開発環境ではALBのDNS名を直接使用するため不要です。

#### 13-1. Aレコードの作成（本番ドメイン用）

> **注意**: CloudFront（Step 15）を設定する場合は、ここではALBへのAレコードを作成し、Step 15-4でCloudFrontに切り替えます。

1. 「**Route 53**」→「**ホストゾーン**」→ドメイン（例: `example.com`）を選択
2. 「**レコードを作成**」をクリック

| 項目 | 値 |
|------|-----|
| レコード名 | `prooflink`（`prooflink.example.com` になる） |
| レコードタイプ | A - IPv4アドレス |
| エイリアス | はい |
| トラフィックのルーティング先 | Application Load Balancerへのエイリアス |
| リージョン | アジアパシフィック（東京） |
| ロードバランサー | `prooflink-prod-alb` |

3. 「**レコードを作成**」をクリック

数分後、`https://prooflink.example.com` でアクセスできるようになります。

> **注意**: `prooflink.example.com` は実際に使用するドメイン名に置き換えてください。
>
> **次のステップ**: testgenアプリを統合する場合は、Step 15に進んでCloudFrontを設定してください。Step 15-4でこのAレコードのルーティング先をCloudFrontに変更します。

---

### Step 14: CloudWatch設定・証明書失効通知

#### 14-1. アラームの作成（本番環境推奨）

開発環境ではコスト削減のためスキップ可能です。

**ECS CPU使用率アラーム:**

1. 「**CloudWatch**」→「**アラーム**」→「**アラームの作成**」
2. 「**メトリクスの選択**」をクリック
3. 「**ECS**」→「**クラスター名, サービス名**」
4. `CPUUtilization` を選択

| 項目 | 値 |
|------|-----|
| 統計 | 平均 |
| 期間 | 5分 |
| しきい値のタイプ | 静的 |
| しきい値 | 80 |
| アラーム条件 | より大きい |

5. 「**次へ**」をクリック
6. SNSトピックを設定（通知先メールアドレス）
7. アラーム名: `prooflink-{env}-ecs-cpu-high`
8. 「**アラームの作成**」をクリック

#### 14-2. ACM証明書失効通知の設定（SNS + EventBridge）

ACM証明書はDNS検証で発行した場合、通常は自動更新されますが、万が一自動更新に失敗した場合に備えてメール通知を設定します。

##### 14-2-1. SNSトピックの作成

1. 「**SNS**」→「**トピック**」→「**トピックの作成**」

| 項目 | 値 |
|------|-----|
| タイプ | スタンダード |
| 名前 | `prooflink-cert-expiry-alert` |
| 表示名 | ProofLink Certificate Alert |

2. 「**トピックの作成**」をクリック

##### 14-2-2. メール購読の追加

1. 作成したトピックをクリック
2. 「**サブスクリプションの作成**」をクリック

| 項目 | 値 |
|------|-----|
| プロトコル | Eメール |
| エンドポイント | 通知先メールアドレス（例: `admin@example.com`） |

3. 「**サブスクリプションの作成**」をクリック
4. 指定したメールアドレスに確認メールが届くので、メール内の「**Confirm subscription**」リンクをクリック

> **重要**: メール内のリンクをクリックしないと通知が届きません。必ず確認してください。

##### 14-2-3. EventBridgeルールの作成

1. 「**EventBridge**」→「**ルール**」→「**ルールを作成**」

| 項目 | 値 |
|------|-----|
| 名前 | `prooflink-acm-cert-expiry-rule` |
| イベントバス | default |
| ルールタイプ | **イベントパターンを持つルール** |

2. 「**次へ**」をクリック

**イベントパターンの設定:**

| 項目 | 値 |
|------|-----|
| イベントソース | AWSイベントまたはEventBridgeパートナーイベント |
| AWSのサービス | **Certificate Manager** |
| イベントタイプ | **ACM Certificate Approaching Expiration** |

または、「**パターンを編集**」で以下のJSONを直接入力:

```json
{
    "source": ["aws.acm"],
    "detail-type": ["ACM Certificate Approaching Expiration"]
}
```

3. 「**次へ**」をクリック

**ターゲットの設定:**

| 項目 | 値 |
|------|-----|
| ターゲットタイプ | AWSのサービス |
| ターゲット | **SNSトピック** |
| トピック | `prooflink-cert-expiry-alert` |

4. 「**次へ**」→「**次へ**」→「**ルールの作成**」をクリック

> **通知タイミング**: ACMは証明書の有効期限が切れる**45日前、30日前、15日前、7日前、3日前、1日前**にEventBridgeイベントを発行します。DNS検証の証明書は通常自動更新されますが、この通知により異常を早期に検知できます。

> **共用リソース**: SNSトピックとEventBridgeルールは1つで全ての ACM証明書（開発・本番両方）の失効通知をカバーします。

#### 14-3. CloudWatch Logs Insightsクエリ例

ログを効率的に検索・分析するためのクエリ例です。

**サーバーエラーのみ抽出:**
```
fields @timestamp, message, data
| filter logSource = "server" and level = "error"
| sort @timestamp desc
| limit 100
```

**クライアントエラーを画面別に集計:**
```
fields @timestamp, screenName, message, userId, url
| filter logSource = "client" and level = "error"
| stats count() by screenName
| sort count desc
```

**特定ユーザーのクライアントログ:**
```
fields @timestamp, screenName, message, url
| filter logSource = "client" and userId = 123
| sort @timestamp desc
| limit 50
```

**API エラーレート（5分間隔）:**
```
fields @timestamp, message
| filter logSource = "server" and level = "error"
| stats count() as errorCount by bin(5m)
| sort @timestamp desc
```

**クライアントログ量の監視:**
```
fields @timestamp
| filter logSource = "client"
| stats count() as logCount by bin(1h)
| sort @timestamp desc
```

---

### Step 15: CloudFront設定（testgenアプリ統合）

> **注意**: このステップは本番環境でのみ実施します。CloudFrontを使用して `prooflink.example.com` 配下で testcasedb（`/`）と testgen（`/testgen`）の2つのアプリケーションを統合配信します。

#### 構成概要

```
ユーザー
  │
  ▼
CloudFront (prooflink.example.com)
  ├── /testgen*   ──→ Lambda Function URL（htmxアプリ）
  └── /* (default) ──→ ALB（testcasedb ECS）
```

- testcasedb: 既存のALB → ECS Fargate構成をCloudFrontのデフォルトオリジンとして利用
- testgen: 既存のCloudFront + Lambda構成のLambda Function URLをCloudFrontの追加オリジンとして利用
- WAFによるIP制限はCloudFrontに関連付け（既存ALBのWAFと同じIPセットを使用）

#### 15-1. ACM証明書の取得（us-east-1）

CloudFrontで使用するACM証明書は **us-east-1（バージニア北部）** で取得する必要があります。

1. **リージョンを「米国東部（バージニア北部）us-east-1」に切り替え**
2. 「**Certificate Manager**」→「**証明書をリクエスト**」

| 項目 | 値 |
|------|-----|
| 証明書タイプ | パブリック証明書をリクエスト |
| ドメイン名 | `prooflink.example.com` |
| 検証方法 | **DNS検証**（推奨） |

3. 「**リクエスト**」をクリック
4. 作成した証明書をクリック → 「**Route 53でレコードを作成**」
5. 証明書のステータスが「**発行済み**」になるまで待機（5〜30分）

> **ヒント**: Step 10で取得した東京リージョンの証明書とは**別に**、us-east-1でも証明書が必要です。ワイルドカード証明書（`*.example.com`）を取得済みの場合でも、us-east-1に同じドメインの証明書が必要です。DNS検証用のCNAMEレコードは東京リージョンの証明書と同じ値になるため、Route 53に既にレコードがあれば自動的に検証されます。

#### 15-2. WAF設定（CloudFront用・us-east-1）

CloudFrontに関連付けるWAFは **us-east-1（Global）** スコープで作成する必要があります。

##### IP Setの作成（Global）

1. **リージョンを「米国東部（バージニア北部）us-east-1」のまま操作**
2. 「**WAF & Shield**」→「**IP sets**」→「**Create IP set**」

| 項目 | 値 |
|------|-----|
| IP set name | `prooflink-allowed-ips-global` |
| Region | **Global (CloudFront)** |
| IP version | IPv4 |
| IP addresses | Step 12で設定したものと同じIPアドレスを入力 |

3. 「**Create IP set**」をクリック

> **重要**: 東京リージョンで作成した `prooflink-allowed-ips` はCloudFrontには使用できません。CloudFront用にGlobalスコープのIP Setを別途作成する必要があります。IPアドレスの追加・変更時は両方のIP Setを更新してください。

##### Web ACLの作成（CloudFront用）

1. 「**WAF & Shield**」→「**Web ACLs**」→「**Create web ACL**」

| 項目 | 値 |
|------|-----|
| Name | `prooflink-prod-cf-waf-acl` |
| Resource type | **CloudFront distributions** |

2. 「**Next**」をクリック

##### ルールの追加

1. 「**Add rules**」→「**Add my own rules and rule groups**」
2. Rule type: **IP set**

| 項目 | 値 |
|------|-----|
| Name | `allow-specific-ips` |
| IP set | `prooflink-allowed-ips-global` |
| IP address to use | Source IP address |
| Action | **Allow** |

3. 「**Add rule**」をクリック
4. **Default action**: **Block**
5. 「**Next**」→「**Next**」→「**Create web ACL**」をクリック

> **注意**: CloudFrontへのWAF関連付けは、Step 15-3でCloudFrontディストリビューション作成時に行います。

#### 15-3. CloudFrontディストリビューションの作成

1. **リージョンを「米国東部（バージニア北部）us-east-1」のまま操作**（CloudFrontはグローバルサービスですが、コンソールはus-east-1で操作します）
2. 「**CloudFront**」→「**ディストリビューションを作成**」

##### オリジン1の設定（ALB - testcasedb）

| 項目 | 値 |
|------|-----|
| オリジンドメイン | `prooflink-prod-alb-XXXXXXXXX.ap-northeast-1.elb.amazonaws.com`（ALBのDNS名） |
| プロトコル | HTTPS only |
| HTTPSポート | 443 |
| オリジン名 | `prooflink-alb` |

> **注意**: ALBのDNS名はStep 11-3で確認した値を入力してください。

**「ディストリビューションを作成」ボタンはまだクリックしない**でください。先にデフォルトビヘイビアを設定します。

##### デフォルトビヘイビアの設定（testcasedb用）

| 項目 | 値 |
|------|-----|
| パスパターン | Default (*) |
| オリジン | `prooflink-alb` |
| ビューワープロトコルポリシー | Redirect HTTP to HTTPS |
| 許可されたHTTPメソッド | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| キャッシュポリシー | CachingDisabled |
| オリジンリクエストポリシー | AllViewerExceptHostHeader |

> **重要**: testcasedbはNext.jsの動的アプリケーションのため、キャッシュは無効にします。`AllViewerExceptHostHeader` を選択することで、CloudFrontがALBにリクエストを転送する際にHostヘッダーをALBのドメインに書き換えます。

##### ディストリビューション設定

| 項目 | 値 |
|------|-----|
| 代替ドメイン名（CNAME） | `prooflink.example.com` |
| カスタムSSL証明書 | Step 15-1で取得したus-east-1の証明書を選択 |
| セキュリティポリシー | TLSv1.2_2021（推奨） |
| デフォルトルートオブジェクト | 空欄のまま |
| AWS WAF ウェブACL | `prooflink-prod-cf-waf-acl`（Step 15-2で作成） |
| 説明 | ProofLink Production Distribution |

3. 「**ディストリビューションを作成**」をクリック

ディストリビューションのデプロイには数分〜15分程度かかります。ステータスが「**有効**」になるまで待ちます。

4. 作成されたディストリビューションの「**ドメイン名**」をメモ（例: `d1234567890.cloudfront.net`）

##### オリジン2の追加（Lambda Function URL - testgen）

1. 作成したディストリビューションをクリック
2. 「**オリジン**」タブ → 「**オリジンを作成**」

| 項目 | 値 |
|------|-----|
| オリジンドメイン | Lambda Function URLのドメイン部分（例: `xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws`） |
| プロトコル | HTTPS only |
| オリジン名 | `prooflink-testgen-lambda` |

3. 「**オリジンを作成**」をクリック

> **確認**: Lambda Function URLは、Lambda関数の「設定」→「関数URL」で確認できます。`https://` は除いたドメイン部分のみを入力してください。

##### ビヘイビアの追加（testgen用）

1. 「**ビヘイビア**」タブ → 「**ビヘイビアを作成**」

| 項目 | 値 |
|------|-----|
| パスパターン | `/testgen*` |
| オリジン | `prooflink-testgen-lambda` |
| ビューワープロトコルポリシー | Redirect HTTP to HTTPS |
| 許可されたHTTPメソッド | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE |
| キャッシュポリシー | CachingDisabled |
| オリジンリクエストポリシー | AllViewerExceptHostHeader |

2. 「**ビヘイビアを作成**」をクリック

> **ビヘイビアの優先順位**: CloudFrontは上から順にパスパターンをマッチさせます。`/testgen*` が `Default (*)` より上にあることを確認してください。「**ビヘイビア**」タブで順序を確認・変更できます。

#### 15-4. Route 53の更新（ALB → CloudFrontに変更）

既存のRoute 53 Aレコードを、ALBからCloudFrontディストリビューションに変更します。

1. 「**Route 53**」→「**ホストゾーン**」→ ドメイン（例: `example.com`）を選択
2. `prooflink.example.com` のAレコードを選択 → 「**レコードを編集**」

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| レコードタイプ | A - IPv4アドレス | A - IPv4アドレス（変更なし） |
| エイリアス | はい | はい（変更なし） |
| トラフィックのルーティング先 | Application Load Balancerへのエイリアス | **CloudFrontディストリビューションへのエイリアス** |
| ディストリビューション | - | Step 15-3で作成したディストリビューションを選択 |

3. 「**保存**」をクリック

> **注意**: DNS伝搬に数分かかる場合があります。切り替え後、`https://prooflink.example.com` と `https://prooflink.example.com/testgen` の両方でアクセスできることを確認してください。

#### 15-5. ALBへの直接アクセスを制限

CloudFront経由のアクセスのみを許可するため、ALBへの直接アクセスを制限します。

##### 方法: ALBセキュリティグループの修正

ALBのセキュリティグループのインバウンドルールを、CloudFrontのIPレンジのみに制限します。

1. 「**EC2**」→「**セキュリティグループ**」→ `prooflink-prod-alb-sg` を選択
2. 「**インバウンドルール**」→「**インバウンドルールを編集**」

既存のルール（`0.0.0.0/0` からの80/443）を削除し、以下に置き換えます:

| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | **AWSプレフィックスリスト** `com.amazonaws.global.cloudfront.origin-facing` | CloudFrontからのアクセスのみ許可 |

3. 「**ルールを保存**」をクリック

> **注意**: AWSマネージドプレフィックスリスト `com.amazonaws.global.cloudfront.origin-facing` を使用すると、CloudFrontのIPレンジが自動的に管理されます。セキュリティグループのソース入力欄で「pl-」と入力すると、プレフィックスリストが候補に表示されます。

> **重要**: この設定により、ALBのDNS名に直接アクセスしてもブロックされます。全てのアクセスは `prooflink.example.com`（CloudFront経由）で行ってください。

#### 15-6. 動作確認

以下のURLにアクセスして動作を確認します:

| URL | 期待される動作 |
|-----|--------------|
| `https://prooflink.example.com` | testcasedbアプリが表示される |
| `https://prooflink.example.com/testgen` | testgenアプリ（htmx）が表示される |
| `https://prooflink.example.com/api/health` | `{"status":"ok"}` が返る |
| ALBのDNS名に直接アクセス | アクセスがブロックされる |
| 許可IP以外からのアクセス | WAFによりブロックされる（403 Forbidden） |

> **トラブルシューティング**: testgenアプリが正しく表示されない場合は、Lambda Function URL側のアプリケーションが `/testgen` プレフィックス付きのパスを処理できるか確認してください。CloudFrontはパスパターンをそのまま（`/testgen/xxx`）オリジンに転送します。Lambda側のルーティング設定の調整が必要な場合があります。

#### 15-7. 既存testgen用CloudFrontディストリビューションの整理

testgenアプリが `prooflink.example.com/testgen` 経由でアクセスできることを確認した後、既存のtestgen用CloudFrontディストリビューション（`xxx.cloudfront.net`）は不要になります。

1. 「**CloudFront**」→ 既存のtestgen用ディストリビューションを選択
2. 「**無効化**」をクリック（即時削除ではなく、まず無効化して一定期間様子を見ることを推奨）
3. 問題がないことを確認後、「**削除**」をクリック

> **注意**: 無効化後も数日間は既存のURLでアクセスが試みられる可能性があります。関係者にURLの変更を周知してから無効化してください。

---

## 6. コスト最適化設定（開発環境）

### 6.1 開発環境の月額コスト目安

| リソース | 設定 | 月額概算（東京リージョン） |
|---------|------|---------------------|
| **RDS PostgreSQL** | db.t4g.micro, 20GB, Single-AZ | **¥1,500** |
| **ECS Fargate** | 0.5vCPU, 1GB, 24時間稼働 | **¥1,800** |
| **ALB** | 最小構成 | **¥2,500** |
| **VPCエンドポイント（インターフェース型）** | 4エンドポイント | **¥1,600** |
| **S3** | 10GB, 少量リクエスト | **¥100** |
| **ECR** | 10GB | **¥100** |
| **CloudWatch Logs** | 7日保持, 1GB/月 | **¥100** |
| **データ転送** | 1GB/月 | **¥10** |
| **合計** | | **約¥7,710/月** |

> **NATゲートウェイ不使用のメリット**: NATゲートウェイ（月額約¥5,000〜¥10,000）を使用しないことで、大幅なコスト削減を実現しています。代わりにVPCインターフェースエンドポイント（4つ × 約¥400/月）で必要なAWSサービスへの接続を確保しています。

### 6.2 VPCエンドポイントのコスト内訳

| エンドポイント | タイプ | 月額概算 |
|-------------|-------|---------|
| S3 | ゲートウェイ（無料） | **¥0** |
| ECR API | インターフェース | **¥400** |
| ECR DKR | インターフェース | **¥400** |
| Secrets Manager | インターフェース | **¥400** |
| CloudWatch Logs | インターフェース | **¥400** |
| **合計** | | **¥1,600** |

### 6.3 RDSのコスト削減設定

#### 自動停止・起動スケジュール（開発時間外は停止）

**Systems Manager Automationを使用:**

1. 「**Systems Manager**」→「**オートメーション**」→「**オートメーションを実行**」
2. ドキュメント: `AWS-StopRdsInstance`
3. スケジュール: EventBridgeで毎日22:00に停止
4. ドキュメント: `AWS-StartRdsInstance`
5. スケジュール: EventBridgeで毎日9:00に起動

**効果**: 夜間・休日停止で約50%のコスト削減

#### ストレージ自動スケーリングを無効化

開発環境では固定20GBで十分です。

### 6.4 ECSのコスト削減設定

#### タスクサイズの最小化

| 項目 | 推奨設定 |
|------|---------|
| CPU | 0.5 vCPU（最小） |
| メモリ | 1 GB（最小） |

#### Auto Scalingを無効化

開発環境では常時1タスクで十分です。

### 6.5 S3のコスト削減設定

#### ライフサイクルポリシーの設定

1. インポート用S3バケットを選択
2. 「**管理**」タブ→「**ライフサイクルルールを作成**」

| 項目 | 値 |
|------|-----|
| ルール名 | `delete-old-imports` |
| ルールスコープ | バケット内の全オブジェクトに適用 |
| アクション | 現在のバージョンを完全削除 |
| 日数 | 30日 |

**効果**: 古いインポートファイルを自動削除してストレージコストを削減

### 6.6 CloudWatch Logsのコスト削減

#### ログ保持期間の短縮

開発環境: 3〜7日
本番環境: 30日以上

### 6.7 その他のコスト削減Tips

| 項目 | 方法 | 効果 |
|------|------|------|
| **未使用リソースの削除** | 定期的に未使用のEBSスナップショット、AMI、EIPを削除 | 月数百円〜 |
| **リザーブドインスタンス** | 本番環境で1年以上使用する場合は検討 | 30〜40%削減 |
| **Savings Plans** | Fargate含む全体的なコスト削減 | 最大17%削減 |

---

## 7. トラブルシューティング

### 7.1 ECSタスクが起動しない

#### 原因1: ECRイメージがプルできない

**確認方法:**
1. 「**ECS**」→クラスター→サービス→「**イベント**」タブ
2. エラーメッセージを確認

```
CannotPullContainerError: pull image manifest has been retried 5 time(s)
```

**解決策:**
- ECSタスク実行ロールに `AmazonECSTaskExecutionRolePolicy` がアタッチされているか確認
- ECRリポジトリにイメージが存在するか確認
- イメージURIが正しいか確認

#### 原因2: VPCエンドポイント経由でECRにアクセスできない

**確認方法:**
プライベートサブネットからECRへのアクセスには**VPCエンドポイントが必須**です（NATゲートウェイを使用しないため）。

**解決策:**
1. 以下のVPCエンドポイントが全て正しく作成されているか確認:
   - `com.amazonaws.ap-northeast-1.ecr.api`（ECR API）
   - `com.amazonaws.ap-northeast-1.ecr.dkr`（ECR DKR）
   - S3ゲートウェイエンドポイント（ECRのイメージレイヤー取得用）
2. VPCエンドポイント用セキュリティグループで、ECSからのHTTPS（443）が許可されているか確認
3. VPCエンドポイントが正しいVPCとプライベートサブネットに関連付けられているか確認
4. VPCエンドポイントの「DNS名を有効化」がオンになっているか確認

#### 原因3: Secrets Managerからシークレットを取得できない

**確認方法:**
ECSタスクのイベントで以下のようなエラーを確認:

```
ResourceInitializationError: unable to pull secrets
```

**解決策:**
1. Secrets Manager用VPCエンドポイントが作成されているか確認
2. ECSタスク実行ロールに `secretsmanager:GetSecretValue` 権限があるか確認（Step 5-4参照）
3. シークレットのARNがタスク定義で正しく設定されているか確認（末尾の `:KEY_NAME::` 形式に注意）

#### 原因4: データベース接続エラー

**確認方法:**
CloudWatch Logsでエラーを確認

```
Error: connect ETIMEDOUT
```

**解決策:**
- RDSセキュリティグループに `prooflink-{env}-ecs-sg` からのポート5432が許可されているか確認
- `DATABASE_URL` の形式が正しいか確認（`postgresql://postgres:{password}@{endpoint}:5432/{dbname}`）
- RDSエンドポイントが正しいか確認
- RDSインスタンスが起動中（利用可能）であるか確認

### 7.2 ALBヘルスチェックが失敗する

**確認方法:**
1. 「**EC2**」→「**ターゲットグループ**」→ `prooflink-{env}-tg`
2. 「**ターゲット**」タブでステータスを確認

**解決策:**
- ヘルスチェックパス `/api/health` が正しく実装されているか確認
- ECSタスクのポート3000が正しく開いているか確認
- セキュリティグループでALBからECSへの通信（ポート3000）が許可されているか確認

### 7.3 VPCエンドポイント経由の通信が失敗する

**確認方法:**
ECSタスクのログでAWSサービスへの接続エラーを確認

**解決策:**
1. **エンドポイントの存在確認**: 必要な全てのVPCエンドポイント（ECR API, ECR DKR, S3, Secrets Manager, CloudWatch Logs）が作成されているか確認
2. **セキュリティグループの確認**: VPCエンドポイント用SG（`prooflink-{env}-vpce-sg`）のインバウンドでHTTPS（443）がECS SGから許可されているか確認
3. **サブネットの確認**: VPCエンドポイントがECSタスクと同じプライベートサブネットに配置されているか確認
4. **DNS解決の確認**: VPCエンドポイントの「プライベートDNS名を有効化」がオンになっているか確認

### 7.4 コストが予想より高い

**確認方法:**
1. 「**コストエクスプローラー**」で最もコストがかかっているサービスを特定
2. 「**Cost and Usage Reports**」で詳細を確認

**よくある原因:**
- ECSタスクが複数起動している → サービスの希望タスク数を1に設定
- RDSがMulti-AZになっている → 開発環境ではSingle-AZに変更
- 不要なVPCエンドポイントが残っている → 使用していないインターフェースエンドポイントを削除
- データ転送量が多い → CloudFront導入を検討

---

## 次のステップ

環境構築が完了したら、以下のドキュメントを参照してください:

- **アプリケーションのデプロイ**: `CI_CD_SETUP.md`
- **ローカル開発環境**: `LOCAL_DEVELOPMENT_S3_SETUP.md`
- **クイックスタート**: `QUICKSTART.md`

---

**作成日**: 2026-01-23
**最終更新**: 2026-03-07
**対象環境**: 開発・本番共通
