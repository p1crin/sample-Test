# AWS環境構築手順書(開発・本番共通)

## 目次

1. [はじめに](#1-はじめに)
2. [前提条件](#2-前提条件)
3. [全体構成](#3-全体構成)
4. [構築手順](#4-構築手順)
   - [Step 1: VPCとネットワーク](#step-1-vpcとネットワーク)
   - [Step 2: NAT Gateway](#step-2-nat-gateway)
   - [Step 3: VPCエンドポイント](#step-3-vpcエンドポイント)
   - [Step 4: セキュリティグループ](#step-4-セキュリティグループ)
   - [Step 5: Secrets Manager](#step-5-secrets-manager)
   - [Step 6: RDS PostgreSQL](#step-6-rds-postgresql)
   - [Step 7: S3バケット](#step-7-s3バケット)
   - [Step 8: IAMロール](#step-8-iamロール)
   - [Step 9: ECRリポジトリ](#step-9-ecrリポジトリ)
   - [Step 10: ECSクラスターとタスク定義](#step-10-ecsクラスターとタスク定義)
   - [Step 11: SSL証明書(ACM)](#step-11-ssl証明書acm)
   - [Step 12: ロードバランサー(ALB)](#step-12-ロードバランサーalb)
   - [Step 13: WAF設定](#step-13-waf設定)
   - [Step 14: Route 53 DNS設定](#step-14-route-53-dns設定)
   - [Step 15: CloudWatch設定](#step-15-cloudwatch設定)
   - [Step 16: AWS Batch設定](#step-16-aws-batch設定ユーザーテストケースインポート)
5. [コスト最適化設定(開発環境)](#5-コスト最適化設定開発環境)
6. [トラブルシューティング](#6-トラブルシューティング)

---

## 1. はじめに

### 本ドキュメントの目的

このガイドは、ProofLinkシステムをAWS上に構築する手順を説明します。**全ての操作をAWSマネジメントコンソール(Webブラウザ)で実施**します。

### 対象環境

- **開発環境**: コストを抑えた小規模構成
- **本番環境**: 可用性とセキュリティを重視した構成

### 主な変更点(2026-01-28)

- ✅ **ECSをプライベートサブネットに配置**: セキュリティ強化（ALB経由のみアクセス可）
- ✅ **NAT Gateway追加**: プライベートサブネットからの外部通信用
- ✅ **WAF追加**: IP制限によるアクセス制御
- ✅ **Secrets Manager追加**: RDS認証情報の安全な管理
- ✅ **VPCエンドポイント追加**: ECR、Secrets Manager用
- ✅ **AWSコンソール操作**: CLI不要、全てブラウザ操作で完結

---

## 2. 前提条件

### 2.1 必要なもの

| 項目 | 説明 |
|------|------|
| AWSアカウント | 管理者権限(AdministratorAccess)を持つアカウント |
| ドメイン | 本番環境用(例: prooflink.example.com) |
| メールアドレス | SSL証明書検証用 |

### 2.2 使用リージョン

本手順では **東京リージョン(ap-northeast-1)** を使用します。

### 2.3 事前確認事項

| 確認項目 | 開発環境 | 本番環境 |
|---------|---------|---------|
| 独自ドメイン | 不要(ALBのDNS名を使用) | 必要 |
| SSL証明書 | 不要(HTTP可) | 必要 |
| Multi-AZ構成 | 不要 | 推奨 |

---

## 3. 全体構成

### 3.1 セキュリティを重視した構成

**本番環境のセキュリティ要件:**
- ECS Fargateはプライベートサブネットに配置（ALB経由のみアクセス可）
- WAFでIP制限を実施（許可されたIPのみアクセス可）
- RDS認証情報はSecrets Managerで管理
- VPCエンドポイントでプライベート通信

**開発環境のコスト最適化:**
- NAT Gatewayは1台のみ（本番は2台で冗長化）
- VPCエンドポイントでNAT Gateway経由のトラフィックを削減

### 3.2 アーキテクチャ図

```
┌────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                              │
│                                                                │
│  ┌─────────────┐  ┌─────────────┐                             │
│  │    WAF      │  │ Secrets Mgr │                             │
│  │ (IP制限)    │  │ (RDS認証)   │                             │
│  └──────┬──────┘  └─────────────┘                             │
│         │                                                      │
│  ┌──────▼──────────────────────────────────────────────────┐  │
│  │           VPC (10.0.0.0/16)                              │  │
│  │                                                          │  │
│  │  ┌────────────────────────────────────────────────────┐ │  │
│  │  │        Public Subnet (10.0.1.0/24, 10.0.2.0/24)    │ │  │
│  │  │                                                    │ │  │
│  │  │  ┌──────────────┐     ┌──────────────────┐        │ │  │
│  │  │  │     ALB      │     │  NAT Gateway     │        │ │  │
│  │  │  │ (Internet-   │     │  (外部通信用)     │        │ │  │
│  │  │  │  facing)     │     └────────┬─────────┘        │ │  │
│  │  │  └──────┬───────┘              │                  │ │  │
│  │  └─────────┼──────────────────────┼──────────────────┘ │  │
│  │            │                      │                    │  │
│  │  ┌─────────▼──────────────────────▼──────────────────┐ │  │
│  │  │      Private Subnet (10.0.11.0/24, 10.0.12.0/24)  │ │  │
│  │  │                                                    │ │  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐       │ │  │
│  │  │  │  ECS Fargate     │  │ RDS PostgreSQL   │       │ │  │
│  │  │  │  (プライベート)   │─▶│  (Multi-AZ)      │       │ │  │
│  │  │  └──────────────────┘  └──────────────────┘       │ │  │
│  │  │                                                    │ │  │
│  │  │  ┌──────────────────────────────────────────────┐ │ │  │
│  │  │  │  VPCエンドポイント (S3, ECR, Secrets Mgr)   │ │ │  │
│  │  │  └──────────────────────────────────────────────┘ │ │  │
│  │  └────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │    S3      │  │     ECR      │  │  CloudWatch    │        │
│  │ (ストレージ)│  │ (コンテナ    │  │  (ログ・監視)  │        │
│  │            │  │  レジストリ) │  │                │        │
│  └────────────┘  └──────────────┘  └────────────────┘        │
└────────────────────────────────────────────────────────────────┘
                         ▲
                         │ HTTPS (許可IPのみ)
                         │
                  ┌──────┴──────┐
                  │   ユーザー   │
                  └─────────────┘
```

### 3.3 主要コンポーネント

| コンポーネント | 用途 | 配置場所 |
|--------------|------|---------|
| **WAF** | IP制限によるアクセス制御 | ALBに関連付け |
| **ALB** | HTTPS終端、負荷分散 | パブリックサブネット |
| **NAT Gateway** | プライベートサブネットからの外部通信 | パブリックサブネット |
| **ECS Fargate** | アプリケーション実行 | **プライベートサブネット** |
| **RDS PostgreSQL** | データベース | プライベートサブネット |
| **Secrets Manager** | RDS認証情報の管理 | マネージドサービス |
| **S3** | ファイルストレージ | マネージドサービス |
| **ECR** | Dockerイメージ保管 | マネージドサービス |
| **AWS Batch** | バッチ処理実行（ユーザー・テストケースインポート） | マネージドサービス（Fargate） |
| **VPCエンドポイント** | プライベート通信 | VPC内 |

---

## 4. 構築手順

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
| **アベイラビリティゾーン(AZ)の数** | **1** | **2** |
| **パブリックサブネットの数** | **1** | **2** |
| **プライベートサブネットの数** | **1** | **2** |
| **NATゲートウェイ** | **1 AZ内** | **AZ ごとに 1** |
| **VPCエンドポイント** | S3ゲートウェイ | S3ゲートウェイ |

4. 「**VPCを作成**」をクリック

**作成されるリソース:**

開発環境:
```
prooflink-dev-vpc (10.0.0.0/16)
├── prooflink-dev-subnet-public1-ap-northeast-1a (10.0.1.0/24)
├── prooflink-dev-subnet-private1-ap-northeast-1a (10.0.11.0/24)
├── prooflink-dev-igw (インターネットゲートウェイ)
├── prooflink-dev-nat-public1 (NAT Gateway)
├── prooflink-dev-vpce-s3 (S3 VPCエンドポイント)
└── ルートテーブル (パブリック用、プライベート用)
```

本番環境:
```
prooflink-prod-vpc (10.0.0.0/16)
├── prooflink-prod-subnet-public1-ap-northeast-1a (10.0.1.0/24)
├── prooflink-prod-subnet-public2-ap-northeast-1c (10.0.2.0/24)
├── prooflink-prod-subnet-private1-ap-northeast-1a (10.0.11.0/24)
├── prooflink-prod-subnet-private2-ap-northeast-1c (10.0.12.0/24)
├── prooflink-prod-igw (インターネットゲートウェイ)
├── prooflink-prod-nat-public1 (NAT Gateway - AZ-a)
├── prooflink-prod-nat-public2 (NAT Gateway - AZ-c)
├── prooflink-prod-vpce-s3 (S3 VPCエンドポイント)
└── ルートテーブル (パブリック用、プライベート用)
```

> **重要**: 本番環境ではNAT Gatewayを各AZに1台ずつ配置して冗長化します。開発環境はコスト削減のため1台のみ。

---

### Step 2: NAT Gateway

> **注意**: VPC作成時に「NATゲートウェイ」を選択していれば自動作成されます。手動で作成する場合は以下を参照。

#### 2-1. NAT Gatewayの作成（手動の場合）

1. 「**VPC**」→「**NATゲートウェイ**」→「**NATゲートウェイを作成**」

| 項目 | 値 |
|------|-----|
| 名前 | `prooflink-nat-public1` |
| サブネット | パブリックサブネットを選択 |
| 接続タイプ | パブリック |
| Elastic IP割り当てID | 「**Elastic IPを割り当て**」をクリック |

2. 「**NATゲートウェイを作成**」をクリック

#### 2-2. プライベートサブネットのルートテーブル更新

1. 「**VPC**」→「**ルートテーブル**」→プライベートサブネット用のルートテーブルを選択
2. 「**ルート**」タブ→「**ルートを編集**」
3. 以下のルートを追加:

| 送信先 | ターゲット |
|--------|----------|
| `0.0.0.0/0` | NAT Gateway |

4. 「**変更を保存**」をクリック

---

### Step 3: VPCエンドポイント

プライベートサブネットからAWSサービスにアクセスするためのVPCエンドポイントを作成します。

#### 3-1. ECR APIエンドポイント

1. 「**VPC**」→「**エンドポイント**」→「**エンドポイントを作成**」

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-vpce-ecr-api` |
| サービスカテゴリ | AWSサービス |
| サービス | `com.amazonaws.ap-northeast-1.ecr.api` |
| VPC | `prooflink-prod-vpc` |
| サブネット | プライベートサブネットを選択 |
| セキュリティグループ | VPCエンドポイント用SG（後述） |
| ポリシー | フルアクセス |

#### 3-2. ECR DKRエンドポイント

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-vpce-ecr-dkr` |
| サービス | `com.amazonaws.ap-northeast-1.ecr.dkr` |

#### 3-3. Secrets Managerエンドポイント

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-vpce-secretsmanager` |
| サービス | `com.amazonaws.ap-northeast-1.secretsmanager` |

#### 3-4. CloudWatch Logsエンドポイント

| 項目 | 値 |
|------|-----|
| 名前タグ | `prooflink-vpce-logs` |
| サービス | `com.amazonaws.ap-northeast-1.logs` |

> **注意**: S3はゲートウェイ型エンドポイント（無料）を使用。ECR、Secrets Manager、CloudWatch Logsはインターフェース型エンドポイント（有料）を使用。

---

### Step 4: セキュリティグループ

#### 4-1. ALB用セキュリティグループ

1. 「**VPC**」→「**セキュリティグループ**」→「**セキュリティグループを作成**」

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-alb-sg` |
| 説明 | Security group for ALB |
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |

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
| カスタムTCP | 3000 | `prooflink-ecs-sg` | ECSへの通信のみ |

#### 4-2. ECS用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-ecs-sg` |
| 説明 | Security group for ECS tasks |
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |

**インバウンドルール:**
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| カスタムTCP | 3000 | `prooflink-alb-sg` | ALBからのアクセスのみ許可 |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | 0.0.0.0/0 | 外部API、NAT Gateway経由 |
| PostgreSQL | 5432 | `prooflink-rds-sg` | RDSへの接続 |
| HTTPS | 443 | `prooflink-vpce-sg` | VPCエンドポイント経由 |

> **ポイント**: ECSタスクはプライベートサブネットに配置。ALBからのアクセスのみ受け付け、外部通信はNAT Gateway経由。

#### 4-3. RDS用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-rds-sg` |
| 説明 | Security group for RDS PostgreSQL |
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |

**インバウンドルール:**
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| PostgreSQL | 5432 | `prooflink-ecs-sg` | ECSからのアクセスのみ |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

#### 4-4. VPCエンドポイント用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `prooflink-vpce-sg` |
| 説明 | Security group for VPC Endpoints |
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |

**インバウンドルール:**
| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | `prooflink-ecs-sg` | ECSからのアクセス |
| HTTPS | 443 | VPC CIDR (10.0.0.0/16) | VPC内からのアクセス |

**アウトバウンドルール:**
| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

---

### Step 5: Secrets Manager

RDSの認証情報を安全に管理するためにSecrets Managerを使用します。

#### 5-1. シークレットの作成

1. 「**Secrets Manager**」→「**新しいシークレットを保存する**」

| 項目 | 値 |
|------|-----|
| シークレットのタイプ | **Amazon RDSデータベースの認証情報** |
| ユーザー名 | `postgres` |
| パスワード | (RDSで設定したパスワード) |
| 暗号化キー | `aws/secretsmanager`（デフォルト） |
| データベース | 後でRDS作成後に選択（または手動入力） |

2. 「**次**」をクリック

| 項目 | 値 |
|------|-----|
| シークレットの名前 | `prooflink/rds-credentials` |
| 説明 | RDS PostgreSQL credentials for ProofLink |

3. 「**次**」をクリック（自動ローテーションはオプション）
4. 「**保存**」をクリック

#### 5-2. シークレットのARN確認

作成したシークレットをクリックし、**シークレットのARN**をコピーします。

例: `arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/rds-credentials-xxxxxx`

このARNは後ほどECSタスク定義で使用します。

---

### Step 6: RDS PostgreSQL

#### 6-1. サブネットグループの作成

1. 「**RDS**」→「**サブネットグループ**」→「**DBサブネットグループを作成**」

| 項目 | 値 |
|------|-----|
| 名前 | `prooflink-db-subnet-group` |
| 説明 | Subnet group for prooflink database |
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |
| アベイラビリティゾーン | プライベートサブネットのあるAZを選択 |
| サブネット | **プライベートサブネット**を選択 |

開発環境: 1つのプライベートサブネットを選択
本番環境: 2つのプライベートサブネットを選択

#### 6-2. RDSインスタンスの作成

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
| マスターパスワード | (強力なパスワードを設定) | (強力なパスワードを設定) |

> **パスワードの要件**: 最低8文字、英数字記号を含む

**インスタンスの設定:**

| 項目 | 開発環境(コスト重視) | 本番環境(性能重視) |
|------|-------------------|------------------|
| DBインスタンスクラス | **db.t4g.micro** (2vCPU 1GB)<br>月額約1,500円 | **db.t4g.medium** (2vCPU 4GB)<br>月額約6,000円 |
| ストレージタイプ | **gp3** | **gp3** |
| ストレージ割り当て | **20 GiB** | **100 GiB** |
| ストレージ自動スケーリング | 無効 | 有効(最大500GiB) |
| IOPS | 3000 (gp3デフォルト) | 3000〜12000 |

**可用性と耐久性:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| Multi-AZ配置 | **スタンドバロン**(Single-AZ) | **Multi-AZ DBインスタンス** |

**接続:**

| 項目 | 値 |
|------|-----|
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |
| DBサブネットグループ | `prooflink-db-subnet-group` |
| **パブリックアクセス** | **なし** (重要) |
| VPCセキュリティグループ | `prooflink-rds-sg` |
| データベースポート | 5432 |

**追加設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 最初のデータベース名 | `prooflink_dev` | `prooflink_prod` |
| **自動バックアップ** | **無効** (コスト削減) | **有効** |
| バックアップ保持期間 | - | 7日 |
| **暗号化** | **無効** | **有効(推奨)** |
| **削除保護** | 無効 | **有効** |
| **Performance Insights** | 無効 | 有効 |

2. 「**データベースの作成**」をクリック

作成には10〜15分かかります。ステータスが「**利用可能**」になるまで待ちます。

#### 3-3. データベース接続情報の確認

1. 作成したRDSインスタンスをクリック
2. 「**接続とセキュリティ**」タブで**エンドポイント**をコピー

例: `prooflink-dev-db.xxxxx.ap-northeast-1.rds.amazonaws.com`

この情報は後ほどECSタスク定義で使用します。

---

### Step 4: S3バケット

#### 4-1. メインバケットの作成

1. 「**S3**」→「**バケットを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| バケット名 | `prooflink-dev-files-{ランダム文字列}` | `prooflink-prod-files-{ランダム文字列}` |
| AWSリージョン | ap-northeast-1 | ap-northeast-1 |
| オブジェクト所有者 | ACL無効(推奨) | ACL無効(推奨) |
| **ブロックパブリックアクセス** | **すべてブロック** (必須) | **すべてブロック** (必須) |
| バケットのバージョニング | 無効 | 有効 |
| デフォルトの暗号化 | SSE-S3 | SSE-S3 |

> **バケット名の注意**: S3バケット名は全世界で一意である必要があります。`{ランダム文字列}`には日付やアカウントIDを使用すると良いでしょう(例: `20260123`、AWSアカウントIDなど)。

2. 「**バケットを作成**」をクリック

#### 4-2. フォルダ構造の作成

バケット内に以下のフォルダ構造を作成します:

1. 作成したS3バケットを開く
2. 「**フォルダの作成**」をクリックして以下を作成:

```
prooflink-dev-files-xxxxx/
├── evidences/          # テストエビデンスファイル
├── imports/            # CSVインポートファイル
├── control-specs/      # 制御仕様書
└── dataflows/          # データフロー図
```

#### 4-3. CORSの設定(アプリケーションから直接アップロードする場合)

1. バケットを選択
2. 「**アクセス許可**」タブ
3. 「**クロスオリジンリソース共有(CORS)**」→「**編集**」

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://your-alb-domain.amazonaws.com",
            "https://prooflink.example.com"
        ],
        "ExposeHeaders": ["ETag"]
    }
]
```

4. 「**変更を保存**」をクリック

---

### Step 5: IAMロール

#### 5-1. ECSタスク実行ロール

このロールは、ECSがECRからイメージをプルし、CloudWatch Logsにログを送信するために必要です。

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service → **Elastic Container Service Task** |

2. 「**次へ**」をクリック

**許可ポリシー:**
- `AmazonECSTaskExecutionRolePolicy` (AWSマネージドポリシー)

3. 「**次へ**」をクリック

| 項目 | 値 |
|------|-----|
| ロール名 | `prooflink-ecs-task-execution-role` |
| 説明 | Execution role for ECS tasks |

4. 「**ロールを作成**」をクリック

#### 5-2. ECSタスクロール

このロールは、アプリケーションがS3やRDSにアクセスするために必要です。

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service → **Elastic Container Service Task** |

2. 「**次へ**」をクリック(ポリシーは後で追加)

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
                "arn:aws:s3:::prooflink-*-files-*",
                "arn:aws:s3:::prooflink-*-files-*/*"
            ]
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:ap-northeast-1:*:log-group:/ecs/prooflink-*:*"
        }
    ]
}
```

7. 「**次へ**」をクリック

| 項目 | 値 |
|------|-----|
| ポリシー名 | `ProoflinkECSTaskPolicy` |

8. 「**ポリシーを作成**」をクリック

---

### Step 6: ECRリポジトリ

#### 6-1. アプリケーション用リポジトリの作成

1. 「**ECR**」→「**リポジトリ**」→「**リポジトリを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 可視性設定 | プライベート | プライベート |
| リポジトリ名 | `prooflink-dev-app` | `prooflink-prod-app` |
| タグのイミュータビリティ | 無効 | 有効(推奨) |
| プッシュ時のスキャン | 無効 | 有効(推奨) |
| 暗号化設定 | AES-256 | AES-256 |

2. 「**リポジトリを作成**」をクリック

#### 6-2. リポジトリURIの確認

作成したリポジトリをクリックして、**URI**をコピーします。

例: `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app`

この情報は後ほどDockerイメージのプッシュ時に使用します。

---

### Step 10: ECSクラスターとタスク定義

#### 10-1. ECSクラスターの作成

1. 「**ECS**」→「**クラスター**」→「**クラスターの作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| クラスター名 | `prooflink-dev-cluster` | `prooflink-prod-cluster` |
| インフラストラクチャ | AWS Fargate(サーバーレス) | AWS Fargate(サーバーレス) |
| Container Insights | オフ(コスト削減) | オン(推奨) |

2. 「**作成**」をクリック

#### 10-2. CloudWatch Logsグループの作成

アプリケーションログを**サーバーログ**と**クライアントログ**で分離して管理します。

**サーバーログ用ロググループ（APIエラー、DB接続エラーなど）:**

1. 「**CloudWatch**」→「**ロググループ**」→「**ロググループを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロググループ名 | `/ecs/prooflink-dev-app-server` | `/ecs/prooflink-prod-app-server` |
| ログの保持期間 | 7日 | 30日 |

2. 「**作成**」をクリック

**クライアントログ用ロググループ（ブラウザエラー、UI操作ログなど）:**

1. 「**CloudWatch**」→「**ロググループ**」→「**ロググループを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| ロググループ名 | `/ecs/prooflink-dev-app-client` | `/ecs/prooflink-prod-app-client` |
| ログの保持期間 | 3日 | 7日 |

2. 「**作成**」をクリック

> **注意**: クライアントログは量が多くなる傾向があるため、保持期間を短めに設定してコストを削減します。

#### 10-3. タスク定義の作成

1. 「**ECS**」→「**タスク定義**」→「**新しいタスク定義の作成**」

**基本設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| タスク定義ファミリー | `prooflink-dev-task` | `prooflink-prod-task` |
| 起動タイプ | AWS Fargate | AWS Fargate |
| OS/アーキテクチャ | Linux/X86_64 | Linux/X86_64 |
| **CPU** | **0.5 vCPU** (コスト削減) | **1 vCPU** |
| **メモリ** | **1 GB** (コスト削減) | **2 GB** |
| タスクロール | `prooflink-ecs-task-role` | `prooflink-ecs-task-role` |
| タスク実行ロール | `prooflink-ecs-task-execution-role` | `prooflink-ecs-task-execution-role` |

**コンテナの設定:**

| 項目 | 値 |
|------|-----|
| コンテナ名 | `prooflink-app` |
| **イメージURI** | `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-app:latest` |
| ポートマッピング | コンテナポート: `3000`, プロトコル: TCP, 名前: `app-3000-tcp` |

**環境変数:**

| キー | 値の種類 | 値 | 説明 |
|------|---------|-----|------|
| NODE_ENV | Value | `production` | Node.js実行環境 |
| NEXTAUTH_URL | Value | `https://prooflink.example.com` | アプリケーションURL |
| AWS_REGION | Value | `ap-northeast-1` | AWSリージョン |
| AWS_S3_BUCKET_NAME | Value | `prooflink-dev-files-xxxxx` | S3バケット名 |
| ENABLE_CLOUDWATCH_LOGS | Value | `true` | CloudWatch Logs直接送信の有効化 |
| CLOUDWATCH_SERVER_LOG_GROUP | Value | `/ecs/prooflink-prod-app-server` | サーバーログ用ロググループ名 |
| CLOUDWATCH_CLIENT_LOG_GROUP | Value | `/ecs/prooflink-prod-app-client` | クライアントログ用ロググループ名 |
| NEXT_PUBLIC_CLIENT_LOG_SEND_LEVEL | Value | `warn` | クライアントログ送信レベル |
| NEXT_PUBLIC_CLIENT_LOG_BATCH_SIZE | Value | `10` | クライアントログバッチサイズ |
| NEXT_PUBLIC_CLIENT_LOG_BATCH_INTERVAL | Value | `30000` | クライアントログバッチ送信間隔(ms) |

**シークレットから取得する環境変数（Secrets Manager経由）:**

| キー | ValueFrom | 説明 |
|------|-----------|------|
| DATABASE_URL | `arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/rds-credentials:DATABASE_URL::` | データベース接続文字列 |
| NEXTAUTH_SECRET | `arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/app-secrets:NEXTAUTH_SECRET::` | NextAuth用シークレット |

> **設定方法（タスク定義JSON）:**
>
> ```json
> "secrets": [
>   {
>     "name": "DATABASE_URL",
>     "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/rds-credentials:DATABASE_URL::"
>   },
>   {
>     "name": "NEXTAUTH_SECRET",
>     "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prooflink/app-secrets:NEXTAUTH_SECRET::"
>   }
> ]
> ```

> **NEXTAUTH_SECRETの生成**:
>
> Linuxの場合: `openssl rand -base64 64`
>
> Windowsの場合: PowerShellで `[Convert]::ToBase64String((1..64|%{Get-Random -Max 256}))`
>
> 生成した値はStep 5で作成したSecrets Managerに `prooflink/app-secrets` として保存してください。

**ログ設定:**

| 項目 | 値 |
|------|-----|
| ログドライバー | awslogs |
| awslogs-group | `/ecs/prooflink-dev-app` |
| awslogs-region | `ap-northeast-1` |
| awslogs-stream-prefix | `ecs` |

2. 「**作成**」をクリック

#### 10-4. ECSサービスの作成

1. 「**ECS**」→「**クラスター**」→`prooflink-dev-cluster` または `prooflink-prod-cluster`
2. 「**サービス**」タブ→「**作成**」

**デプロイ設定:**

| 項目 | 値 |
|------|-----|
| 起動タイプ | Fargate |
| タスク定義 | `prooflink-dev-task` または `prooflink-prod-task` |
| サービス名 | `prooflink-service` |
| 必要なタスク | 開発: `1` / 本番: `2` |

**ネットワーク設定（重要: プライベートサブネットを使用）:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| VPC | `prooflink-dev-vpc` | `prooflink-prod-vpc` |
| サブネット | **プライベートサブネット1** | **プライベートサブネット1, 2**（Multi-AZ） |
| セキュリティグループ | `prooflink-ecs-sg` | `prooflink-ecs-sg` |
| パブリックIP | **オフ（DISABLED）** | **オフ（DISABLED）** |

> **重要**: ECS Fargateはプライベートサブネットに配置します。パブリックIPは**割り当てない**ため、インターネットへのアクセスはNAT Gateway経由となります。

**ロードバランサー設定:**

| 項目 | 値 |
|------|-----|
| ロードバランサータイプ | Application Load Balancer |
| ロードバランサー | `prooflink-alb` |
| ターゲットグループ | `prooflink-tg` |
| コンテナ名 | `prooflink-app` |
| コンテナポート | `3000` |

3. 「**作成**」をクリック

サービスが起動し、タスクがRunning状態になるまで数分かかります。

---

### Step 11: SSL証明書(ACM)

> **注意**: 開発環境でHTTPのみを使用する場合は、このステップをスキップできます。

#### 11-1. パブリック証明書のリクエスト

1. 「**Certificate Manager**」→「**証明書をリクエスト**」

| 項目 | 値 |
|------|-----|
| 証明書タイプ | パブリック証明書をリクエスト |

2. 「**次へ**」をクリック

| 項目 | 値 |
|------|-----|
| ドメイン名 | `prooflink.example.com` |
| 検証方法 | **DNS検証** (推奨) |

3. 「**リクエスト**」をクリック

#### 11-2. DNS検証の実施

1. 作成した証明書をクリック
2. 「**Route 53でレコードを作成**」ボタンをクリック(Route 53を使用している場合)
3. 検証が完了するまで5〜30分待機

証明書のステータスが「**発行済み**」になれば完了です。

---

### Step 12: ロードバランサー(ALB)

#### 12-1. ターゲットグループの作成

1. 「**EC2**」→「**ターゲットグループ**」→「**ターゲットグループの作成**」

| 項目 | 値 |
|------|-----|
| ターゲットタイプ | **IPアドレス** |
| ターゲットグループ名 | `prooflink-tg` |
| プロトコル | HTTP |
| ポート | 3000 |
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |

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

#### 12-2. Application Load Balancerの作成

1. 「**EC2**」→「**ロードバランサー**」→「**ロードバランサーの作成**」
2. 「**Application Load Balancer**」の「**作成**」をクリック

**基本的な設定:**

| 項目 | 値 |
|------|-----|
| ロードバランサー名 | `prooflink-alb` |
| スキーム | **インターネット向け** |
| IPアドレスタイプ | IPv4 |

**ネットワークマッピング:**

| 項目 | 値 |
|------|-----|
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |
| マッピング | **パブリックサブネット**を選択 |

開発環境: 1つのパブリックサブネットを選択
本番環境: 2つのパブリックサブネットを選択

**セキュリティグループ:**

| 項目 | 値 |
|------|-----|
| セキュリティグループ | `prooflink-alb-sg` |

**リスナーとルーティング:**

開発環境(HTTPのみ):
| プロトコル | ポート | デフォルトアクション |
|-----------|--------|-----------------|
| HTTP | 80 | `prooflink-tg`に転送 |

本番環境(HTTPS):
| プロトコル | ポート | デフォルトアクション |
|-----------|--------|-----------------|
| HTTP | 80 | HTTPSにリダイレクト(ポート443) |
| HTTPS | 443 | `prooflink-tg`に転送 |

HTTPS リスナーの追加設定:
| 項目 | 値 |
|------|-----|
| セキュリティポリシー | ELBSecurityPolicy-TLS13-1-2-2021-06 |
| デフォルトSSL/TLS証明書 | ACMで取得した証明書を選択 |

2. 「**ロードバランサーの作成**」をクリック

作成には数分かかります。ステータスが「**アクティブ**」になるまで待ちます。

#### 12-3. ALBのDNS名の確認

1. 作成したロードバランサーをクリック
2. 「**DNS名**」をコピー

例: `prooflink-alb-123456789.ap-northeast-1.elb.amazonaws.com`

このDNS名は開発環境でのアクセスに使用します。

---

### Step 13: WAF設定

> **注意**: 本番環境でIP制限を行う場合に必要です。

#### 13-1. Web ACLの作成

1. 「**WAF & Shield**」→「**Web ACLs**」→「**Create web ACL**」

| 項目 | 値 |
|------|-----|
| Name | `prooflink-waf-acl` |
| Resource type | Regional resources |
| Region | Asia Pacific (Tokyo) |
| Associated AWS resources | 後で設定（ALB作成後） |

2. 「**Next**」をクリック

#### 13-2. IP Setの作成

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

#### 13-3. ルールの追加

Web ACL作成画面で:

1. 「**Add rules**」→「**Add my own rules and rule groups**」
2. Rule type: **IP set**
3. 以下を設定:

| 項目 | 値 |
|------|-----|
| Name | `allow-specific-ips` |
| IP set | `prooflink-allowed-ips` |
| IP address to use | Source IP address |
| Action | **Allow** |

4. 「**Add rule**」をクリック

5. **Default action**: **Block**（デフォルトでブロック、許可IPのみ通過）

6. 「**Next**」→「**Next**」→「**Create web ACL**」をクリック

#### 13-4. ALBへの関連付け

1. 作成したWeb ACLをクリック
2. 「**Associated AWS resources**」タブ
3. 「**Add AWS resources**」
4. `prooflink-alb`を選択
5. 「**Add**」をクリック

> **重要**: WAFを設定すると、許可されたIPアドレス以外からのアクセスはすべてブロックされます。

---

### Step 14: Route 53 DNS設定

> **注意**: 本番環境で独自ドメインを使用する場合のみ必要です。

#### 14-1. Aレコードの作成

1. 「**Route 53**」→「**ホストゾーン**」→ドメイン(例: `example.com`)を選択
2. 「**レコードを作成**」をクリック

| 項目 | 値 |
|------|-----|
| レコード名 | `prooflink` |
| レコードタイプ | A - IPv4アドレス |
| エイリアス | はい |
| トラフィックのルーティング先 | Application Load Balancerへのエイリアス |
| リージョン | アジアパシフィック(東京) |
| ロードバランサー | `prooflink-alb` |

3. 「**レコードを作成**」をクリック

数分後、`https://prooflink.example.com` でアクセスできるようになります。

---

### Step 15: CloudWatch設定

#### 15-1. アラームの作成(本番環境推奨)

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
6. SNSトピックを設定(通知先メールアドレス)
7. アラーム名: `prooflink-ecs-cpu-high`
8. 「**アラームの作成**」をクリック

#### 15-2. CloudWatch Logs Insightsクエリ例

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

### Step 16: AWS Batch設定（ユーザー・テストケースインポート）

AWS Batchは、ユーザー一括インポートやテストケース一括インポートなどのバッチ処理を実行するために使用します。

#### 16-1. Batch用ECRリポジトリの作成

1. 「**ECR**」→「**リポジトリ**」→「**リポジトリを作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 可視性設定 | プライベート | プライベート |
| リポジトリ名 | `prooflink-dev-batch` | `prooflink-prod-batch` |
| タグのイミュータビリティ | 無効 | 有効(推奨) |
| プッシュ時のスキャン | 無効 | 有効(推奨) |
| 暗号化設定 | AES-256 | AES-256 |

2. 「**リポジトリを作成**」をクリック

#### 16-2. Batch用IAMロールの作成

**Batchサービスロール:**

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Batch |

2. 許可ポリシー: `AWSBatchServiceRole`（AWSマネージドポリシー）
3. ロール名: `prooflink-batch-service-role`
4. 「**ロールを作成**」をクリック

**Batch ECSタスク実行ロール:**

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service → Elastic Container Service Task |

2. 許可ポリシー: `AmazonECSTaskExecutionRolePolicy`
3. ロール名: `prooflink-batch-execution-role`
4. 「**ロールを作成**」をクリック

**Batchジョブロール（バッチジョブがS3やRDSにアクセスするため）:**

1. 「**IAM**」→「**ロール**」→「**ロールを作成**」

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWSのサービス |
| ユースケース | Elastic Container Service → Elastic Container Service Task |

2. 「**次へ**」をクリック（ポリシーは後で追加）
3. ロール名: `prooflink-batch-job-role`
4. 「**ロールを作成**」をクリック
5. 作成したロールをクリック→「**許可を追加**」→「**インラインポリシーを作成**」

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
        "arn:aws:s3:::prooflink-*-files-*",
        "arn:aws:s3:::prooflink-*-files-*/*"
      ]
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:*:log-group:/aws/batch/*:*"
    }
  ]
}
```

6. ポリシー名: `ProoflinkBatchJobPolicy`
7. 「**ポリシーを作成**」をクリック

#### 16-3. Batchコンピューティング環境の作成

1. 「**Batch**」→「**コンピューティング環境**」→「**作成**」

**基本設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| オーケストレーションタイプ | **Fargate** | **Fargate** |
| 名前 | `prooflink-dev-compute-env` | `prooflink-prod-compute-env` |

**インスタンス設定:**

| 項目 | 値 |
|------|-----|
| Fargate | Fargate と Fargate Spot の両方を選択 |
| 最大 vCPU 数 | 開発: `2` / 本番: `4` |

**ネットワーク設定:**

| 項目 | 値 |
|------|-----|
| VPC | `prooflink-dev-vpc` または `prooflink-prod-vpc` |
| サブネット | **プライベートサブネット**を選択 |
| セキュリティグループ | `prooflink-ecs-sg`（ECS用と同じ） |

**サービスロール:**

| 項目 | 値 |
|------|-----|
| サービスロール | `prooflink-batch-service-role` |

2. 「**作成**」をクリック

#### 16-4. Batchジョブキューの作成

1. 「**Batch**」→「**ジョブキュー**」→「**作成**」

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| 名前 | `prooflink-dev-job-queue` | `prooflink-prod-job-queue` |
| 優先度 | `1` | `1` |
| コンピューティング環境を選択 | `prooflink-dev-compute-env` | `prooflink-prod-compute-env` |

2. 「**作成**」をクリック

#### 16-5. CloudWatch Logsグループの作成

Batchジョブのログを保存するロググループを作成します。

```bash
aws logs create-log-group \
  --log-group-name /aws/batch/prooflink-dev \
  --region ap-northeast-1
```

#### 16-6. Batchジョブ定義の作成

**ユーザーインポート用ジョブ定義:**

1. 「**Batch**」→「**ジョブ定義**」→「**作成**」

**基本設定:**

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| オーケストレーションタイプ | Fargate | Fargate |
| 名前 | `prooflink-dev-user-import` | `prooflink-prod-user-import` |
| 実行タイムアウト | `3600`秒（1時間） | `7200`秒（2時間） |

**プラットフォームバージョン:**

| 項目 | 値 |
|------|-----|
| プラットフォームバージョン | LATEST |

**実行ロール:**

| 項目 | 値 |
|------|-----|
| 実行ロール | `prooflink-batch-execution-role` |
| ジョブロール | `prooflink-batch-job-role` |

**コンテナ設定:**

| 項目 | 値 |
|------|-----|
| イメージ | `123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/prooflink-dev-batch:latest` |
| コマンド | `node,dist/user-import.js` |
| vCPUs | 開発: `0.25` / 本番: `0.5` |
| メモリ | 開発: `512 MB` / 本番: `1024 MB` |

**環境変数:**

| キー | 値 |
|------|-----|
| NODE_ENV | `production` |
| AWS_REGION | `ap-northeast-1` |
| STORAGE_MODE | `s3` |
| INPUT_S3_BUCKET | `prooflink-dev-files-xxxxx` |
| OUTPUT_S3_BUCKET | `prooflink-dev-files-xxxxx` |
| AWS_S3_BUCKET_NAME | `prooflink-dev-files-xxxxx` |

> **DATABASE_URL** はSecrets Managerから取得する場合、シークレット設定で追加します

**ログ設定:**

| 項目 | 値 |
|------|-----|
| ログドライバー | awslogs |
| ログ設定 | ログストリームプレフィックス: `user-import` |

2. 「**作成**」をクリック

**テストケースインポート用ジョブ定義:**

同様の手順で以下の設定で作成します：

| 項目 | 値 |
|------|-----|
| 名前 | `prooflink-dev-test-case-import` |
| コマンド | `node,dist/test-case-import.js` |
| vCPUs | 開発: `0.5` / 本番: `1` |
| メモリ | 開発: `1024 MB` / 本番: `2048 MB` |

#### 16-7. BatchイメージのビルドとECRへのプッシュ

**ローカル環境から実行:**

```bash
# batchディレクトリに移動
cd batch

# 環境変数設定
export ENV=dev  # または prod
export AWS_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPOSITORY=prooflink-${ENV}-batch
export ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}
export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

# ECRにログイン
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Dockerイメージをビルド
docker build \
  --platform linux/amd64 \
  -t ${ECR_REPOSITORY}:${IMAGE_TAG} \
  -t ${ECR_REPOSITORY}:latest \
  -f DockerFile \
  .

# ECRにプッシュ
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
docker tag ${ECR_REPOSITORY}:latest ${ECR_URI}:latest
docker push ${ECR_URI}:${IMAGE_TAG}
docker push ${ECR_URI}:latest

echo "Batch image pushed: ${ECR_URI}:${IMAGE_TAG}"
```

#### 16-8. Batchジョブの実行テスト

**AWSマネジメントコンソールから:**

1. 「**Batch**」→「**ジョブ**」→「**ジョブを送信**」
2. ジョブ定義: `prooflink-dev-user-import`
3. ジョブキュー: `prooflink-dev-job-queue`
4. 環境変数の上書き（必要に応じて）:
   - `INPUT_S3_KEY`: `imports/users.csv`
   - `EXECUTOR_NAME`: `test-user`
5. 「**ジョブを送信**」をクリック

**AWS CLIから:**

```bash
aws batch submit-job \
  --job-name user-import-$(date +%Y%m%d-%H%M%S) \
  --job-queue prooflink-dev-job-queue \
  --job-definition prooflink-dev-user-import \
  --container-overrides '{
    "environment": [
      {"name": "INPUT_S3_KEY", "value": "imports/users.csv"},
      {"name": "EXECUTOR_NAME", "value": "admin"}
    ]
  }' \
  --region ap-northeast-1
```

#### 16-9. Batchジョブのモニタリング

**ジョブの状態確認:**

```bash
# 最近のジョブ一覧
aws batch list-jobs \
  --job-queue prooflink-dev-job-queue \
  --region ap-northeast-1

# 特定ジョブの詳細
aws batch describe-jobs \
  --jobs <JOB_ID> \
  --region ap-northeast-1
```

**CloudWatch Logsでログ確認:**

1. 「**CloudWatch**」→「**ロググループ**」
2. `/aws/batch/prooflink-dev` を選択
3. ログストリームを選択してログを確認

---

## 5. コスト最適化設定(開発環境)

### 5.1 開発環境の月額コスト目安

| リソース | 設定 | 月額概算(東京リージョン) |
|---------|------|---------------------|
| **RDS PostgreSQL** | db.t4g.micro, 20GB, Single-AZ | **¥1,500** |
| **ECS Fargate** | 0.5vCPU, 1GB, 24時間稼働 | **¥1,800** |
| **ALB** | 最小構成 | **¥2,500** |
| **NAT Gateway** | 1台（開発環境） | **¥5,000** |
| **S3** | 10GB, 少量リクエスト | **¥100** |
| **ECR** | 10GB（アプリ + バッチ） | **¥100** |
| **AWS Batch** | 月数回実行想定（Fargate利用） | **¥50** |
| **CloudWatch Logs** | 3日保持, 1GB/月 | **¥100** |
| **データ転送** | 1GB/月 | **¥10** |
| **合計** | | **約¥11,160/月** |

> **注意**: NAT Gatewayはプライベートサブネット構成に必要です。本番環境では高可用性のため2台（各AZに1台）配置し、月額約¥10,000追加となります。

### 5.2 開発環境のコスト削減オプション

NAT Gatewayのコストを削減したい場合、以下の方法を検討できます：

1. **VPCエンドポイント活用**: S3、ECR、Secrets Manager等へのアクセスはVPCエンドポイント経由（NAT Gateway不使用）
2. **外部API呼び出しの最小化**: 外部APIへのアクセスを最小限に抑える
3. **開発時間外のNAT Gateway削除**: 夜間・休日はNAT Gatewayを削除（※再作成時にEIPも変わる点に注意）

### 5.3 RDSのコスト削減設定

#### 自動停止・起動スケジュール(開発時間外は停止)

**Systems Manager Automationを使用:**

1. 「**Systems Manager**」→「**オートメーション**」→「**オートメーションを実行**」
2. ドキュメント: `AWS-StopRdsInstance`
3. スケジュール: EventBridgeで毎日22:00に停止
4. ドキュメント: `AWS-StartRdsInstance`
5. スケジュール: EventBridgeで毎日9:00に起動

**効果**: 夜間・休日停止で約50%のコスト削減

#### ストレージ自動スケーリングを無効化

開発環境では固定20GBで十分です。

### 5.4 ECSのコスト削減設定

#### タスクサイズの最小化

| 項目 | 推奨設定 |
|------|---------|
| CPU | 0.5 vCPU (最小) |
| メモリ | 1 GB (最小) |

#### Auto Scalingを無効化

開発環境では常時1タスクで十分です。

### 5.5 S3のコスト削減設定

#### ライフサイクルポリシーの設定

1. S3バケットを選択
2. 「**管理**」タブ→「**ライフサイクルルールを作成**」

| 項目 | 値 |
|------|-----|
| ルール名 | `delete-old-imports` |
| ルールスコープ | `imports/` プレフィックス |
| アクション | 現在のバージョンを完全削除 |
| 日数 | 30日 |

**効果**: 古いインポートファイルを自動削除してストレージコストを削減

### 5.6 CloudWatch Logsのコスト削減

#### ログ保持期間の短縮

開発環境: 3日
本番環境: 30日以上

#### 不要なログの削減

```javascript
// 本番環境以外では詳細ログを無効化
if (process.env.NODE_ENV !== 'production') {
  console.log = () => {};
}
```

### 5.7 その他のコスト削減Tips

| 項目 | 方法 | 効果 |
|------|------|------|
| **未使用リソースの削除** | 定期的に未使用のEBSスナップショット、AMI、EIPを削除 | 月数百円〜 |
| **リザーブドインスタンス** | 本番環境で1年以上使用する場合は検討 | 30〜40%削減 |
| **Savings Plans** | Fargate含む全体的なコスト削減 | 最大17%削減 |

---

## 6. トラブルシューティング

### 6.1 ECSタスクが起動しない

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
プライベートサブネットからECRへのアクセスにはVPCエンドポイントが必要です。

**解決策:**
1. VPCエンドポイント（ECR API、ECR DKR）が正しく作成されているか確認
2. VPCエンドポイント用セキュリティグループで、ECSからのHTTPS(443)が許可されているか確認
3. プライベートサブネットのルートテーブルでS3エンドポイントが関連付けられているか確認

#### 原因3: データベース接続エラー

**確認方法:**
CloudWatch Logsでエラーを確認

```
Error: connect ETIMEDOUT
```

**解決策:**
- RDSセキュリティグループに `prooflink-ecs-sg` からのポート5432が許可されているか確認
- `DATABASE_URL` の形式が正しいか確認
- RDSエンドポイントが正しいか確認

### 6.2 ALBヘルスチェックが失敗する

**確認方法:**
1. 「**EC2**」→「**ターゲットグループ**」→`prooflink-tg`
2. 「**ターゲット**」タブでステータスを確認

**解決策:**
- ヘルスチェックパス `/api/health` が正しく実装されているか確認
- ECSタスクのポート3000が正しく開いているか確認
- セキュリティグループでALBからECSへの通信が許可されているか確認

### 6.3 プライベートサブネットからインターネットにアクセスできない

**確認方法:**
ECSタスクのログで外部APIへの接続エラーを確認

**解決策:**
1. **NAT Gatewayの確認**: プライベートサブネットが配置されているAZにNAT Gatewayが存在するか確認
2. **ルートテーブルの確認**: プライベートサブネットのルートテーブルで `0.0.0.0/0` → NAT Gatewayのルートが存在するか確認
3. **セキュリティグループの確認**: ECSセキュリティグループのアウトバウンドルールでHTTPS(443)が許可されているか確認
4. **NAT Gatewayの状態**: NAT Gatewayのステータスが「Available」になっているか確認

### 6.4 コストが予想より高い

**確認方法:**
1. 「**コストエクスプローラー**」で最もコストがかかっているサービスを特定
2. 「**Cost and Usage Reports**」で詳細を確認

**よくある原因:**
- NAT Gatewayが複数ある → 開発環境では1台に削減（本番は各AZに1台必要）
- NAT Gateway経由のデータ転送量が多い → VPCエンドポイント活用でNAT Gateway経由を減らす
- ECSタスクが複数起動している → サービスの希望タスク数を1に設定
- RDSがMulti-AZになっている → 開発環境ではSingle-AZに変更
- データ転送量が多い → CloudFront導入を検討

---

## 次のステップ

環境構築が完了したら、以下のドキュメントを参照してください:

- **アプリケーションのデプロイ**: `CI_CD_SETUP.md`
- **ローカル開発環境**: `LOCAL_DEVELOPMENT_S3_SETUP.md`
- **クイックスタート**: `QUICKSTART.md`

---

**作成日**: 2026-01-23
**最終更新**: 2026-01-28
**対象環境**: 開発・本番共通
