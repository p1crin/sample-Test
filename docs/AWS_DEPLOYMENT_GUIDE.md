# AWS デプロイメント手順書（インターネット公開版・プロキシ経由アクセス）

## 目次

1. [前提条件](#1-前提条件)
2. [全体構成概要](#2-全体構成概要)
3. [VPC の作成](#3-vpc-の作成)
4. [セキュリティグループの作成](#4-セキュリティグループの作成)
5. [RDS PostgreSQL の作成](#5-rds-postgresql-の作成)
6. [S3 バケットの作成](#6-s3-バケットの作成)
7. [Secrets Manager の設定](#7-secrets-manager-の設定)
8. [IAM ロールの作成](#8-iam-ロールの作成)
9. [ECR リポジトリの作成](#9-ecr-リポジトリの作成)
10. [ECS クラスターの作成](#10-ecs-クラスターの作成)
11. [ACM 証明書の取得](#11-acm-証明書の取得)
12. [WAF の設定（必須）](#12-waf-の設定必須)
13. [Application Load Balancer の作成](#13-application-load-balancer-の作成)
14. [Route 53 DNS 設定](#14-route-53-dns-設定)
15. [AWS Batch の設定](#15-aws-batch-の設定)
16. [CloudWatch の設定](#16-cloudwatch-の設定)
17. [アプリケーションのデプロイ](#17-アプリケーションのデプロイ)
18. [動作確認](#18-動作確認)
19. [セキュリティチェックリスト](#19-セキュリティチェックリスト)
20. [注意事項・トラブルシューティング](#20-注意事項トラブルシューティング)

---

## 1. 前提条件

### 1.1 必要なもの

- AWS アカウント（Admin 権限あり）
- AWS CLI がインストールされていること
- Docker がインストールされていること
- 独自ドメイン（例: testcasedb.example.com）
- **客先のプロキシサーバーのIPアドレス（固定IP）**

### 1.2 AWS CLI の設定

```bash
# AWS CLI の設定
aws configure

# 以下を入力
# AWS Access Key ID: [アクセスキーID]
# AWS Secret Access Key: [シークレットアクセスキー]
# Default region name: ap-northeast-1
# Default output format: json
```

### 1.3 使用するリージョン

本手順では **ap-northeast-1（東京リージョン）** を使用します。

### 1.4 事前に確認すべき情報

| 確認項目 | 例 | 用途 |
|---------|-----|------|
| ドメイン名 | testcasedb.example.com | ALB、ACM証明書 |
| **プロキシサーバーIP** | **203.0.113.50/32** | **WAF、SG でのアクセス制限** |
| 管理者用 IP（オプション） | 203.0.113.100/32 | 緊急アクセス用 |

> **重要**: 全ユーザーが必ず客先のプロキシサーバーを経由してアクセスすることを前提としています。プロキシIPは固定IPである必要があります。

---

## 2. 全体構成概要

### 2.1 プロキシ経由アクセスのアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────┐
│                      客先ネットワーク                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  クライアント（社内ユーザー）                                    │  │
│  │                                                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │  │
│  │  │ 管理者PC  │  │ 一般PC   │  │ リモート │                    │  │
│  │  │          │  │          │  │ ワーク   │                    │  │
│  │  └─────┬────┘  └─────┬────┘  └────┬─────┘                    │  │
│  │        │             │             │                           │  │
│  │        └──────┬──────┴─────────────┘                           │  │
│  │               │                                                 │  │
│  │               ▼                                                 │  │
│  │  ┌─────────────────────────┐                                   │  │
│  │  │  プロキシサーバー         │                                   │  │
│  │  │  (固定IP: 203.0.113.50) │                                   │  │
│  │  └───────────┬─────────────┘                                   │  │
│  └──────────────┼─────────────────────────────────────────────────┘  │
│                 │                                                    │
│                 │ HTTPS (443)                                       │
└─────────────────┼────────────────────────────────────────────────────┘
                  │ インターネット
┌─────────────────┼────────────────────────────────────────────────────┐
│                 │            AWS Cloud                               │
│                 ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  AWS WAF (プロキシIP制限 + レート制限)                           │ │
│  │  許可IP: 203.0.113.50/32 のみ                                   │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                         │
│  ┌──────────────────────────┼──────────────────────────────────────┐ │
│  │                          │       VPC (10.0.0.0/16)               │ │
│  │                          │                                       │ │
│  │  ┌───────────────────────┴─────────────────────────────────────┐│ │
│  │  │                    Public Subnet                             ││ │
│  │  │                                                              ││ │
│  │  │  ┌─────────────────┐                                        ││ │
│  │  │  │  Internet-facing │                                        ││ │
│  │  │  │  ALB             │                                        ││ │
│  │  │  │  + プロキシIP制限 │                                        ││ │
│  │  │  └────────┬─────────┘                                        ││ │
│  │  │           │                                                  ││ │
│  │  └───────────┼──────────────────────────────────────────────────┘│ │
│  │              │                                                    │ │
│  │  ┌───────────┼──────────────────────────────────────────────────┐│ │
│  │  │           │       Private Subnet                             ││ │
│  │  │           ▼                                                  ││ │
│  │  │  ┌───────────────────────────────────────────────────────┐  ││ │
│  │  │  │      ECS Fargate                                      │  ││ │
│  │  │  │  ┌─────────────────────────┐                          │  ││ │
│  │  │  │  │ テストケースDBアプリ     │                          │  ││ │
│  │  │  │  │ + Prisma Client         │                          │  ││ │
│  │  │  │  └─────────────────────────┘                          │  ││ │
│  │  │  └───────────────┬───────────────────────────────────────┘  ││ │
│  │  │                  │                                          ││ │
│  │  │                  ▼                                          ││ │
│  │  │  ┌───────────────────────────────┐                         ││ │
│  │  │  │    RDS PostgreSQL Multi-AZ    │                         ││ │
│  │  │  └───────────────────────────────┘                         ││ │
│  │  │                                                             ││ │
│  │  │  ┌─────────────────┐                                       ││ │
│  │  │  │   AWS Batch     │ ← ファイルインポート処理              ││ │
│  │  │  └─────────────────┘                                       ││ │
│  │  └─────────────────────────────────────────────────────────────┘│ │
│  │                                                                  │ │
│  │  ┌──────────┐                                                   │ │
│  │  │   NAT    │ ← ECS/Batch から外部 API へのアクセス用            │ │
│  │  │ Gateway  │                                                   │ │
│  │  └──────────┘                                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────┐ ┌────────────────┐ ┌───────────┐ ┌─────────────┐      │
│  │    S3    │ │Secrets Manager │ │CloudWatch │ │ ACM 証明書  │      │
│  └──────────┘ └────────────────┘ └───────────┘ └─────────────┘      │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 主要な構成要素

| 項目 | 構成 | 説明 |
|------|------|------|
| ALB タイプ | **Internet-facing** | インターネットから直接アクセス可能 |
| ALB 配置 | **Public Subnet** | パブリックIPアドレスを持つ |
| アクセス制御 | **WAF プロキシIP制限 + SG** | プロキシIPのみ許可 |
| アクセス経路 | **プロキシサーバー経由** | 全ユーザーがプロキシ経由でアクセス |
| SSL 証明書 | **ACM パブリック証明書** | Let's Encrypt 互換 |
| WAF | **必須** | プロキシIP制限、レート制限、脅威検出 |
| NAT Gateway | **必須** | 外部 API アクセス用 |

---

## 3. VPC の作成

### 3.1 AWS コンソールでの作成手順

1. **AWS マネジメントコンソール** にログイン
2. サービス検索で **VPC** を検索してクリック
3. 左メニューから **VPC** → **VPCを作成** をクリック

### 3.2 VPC 設定

| 項目 | 値 |
|------|-----|
| 作成するリソース | VPC など |
| 名前タグの自動生成 | `testcasedb` |
| IPv4 CIDR ブロック | `10.0.0.0/16` |
| IPv6 CIDR ブロック | なし |
| テナンシー | デフォルト |
| アベイラビリティゾーン (AZ) の数 | 2 |
| パブリックサブネットの数 | 2 |
| プライベートサブネットの数 | 2 |
| NAT ゲートウェイ | 1 AZ 内 |
| VPC エンドポイント | S3 ゲートウェイ |

### 3.3 作成されるリソース

以下が自動で作成されます：

- VPC: `testcasedb-vpc`
- パブリックサブネット:
  - `testcasedb-subnet-public1-ap-northeast-1a` (10.0.0.0/20)
  - `testcasedb-subnet-public2-ap-northeast-1c` (10.0.16.0/20)
- プライベートサブネット:
  - `testcasedb-subnet-private1-ap-northeast-1a` (10.0.128.0/20)
  - `testcasedb-subnet-private2-ap-northeast-1c` (10.0.144.0/20)
- インターネットゲートウェイ: `testcasedb-igw`
- NAT ゲートウェイ: `testcasedb-nat-public1-ap-northeast-1a`
- ルートテーブル: パブリック用、プライベート用

---

## 4. セキュリティグループの作成

### 4.1 ALB 用セキュリティグループ（プロキシIP 制限付き）

1. **VPC** → **セキュリティグループ** → **セキュリティグループを作成**

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `testcasedb-alb-sg` |
| 説明 | Security group for Internet-facing ALB with proxy IP restriction |
| VPC | `testcasedb-vpc` |

**インバウンドルール（プロキシIP 制限）:**

| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | 203.0.113.50/32 | 客先プロキシサーバー（必須） |
| HTTPS | 443 | 203.0.113.100/32 | 管理者用緊急アクセスIP（オプション） |

> **重要**: 客先のプロキシサーバーIPのみを許可します。プロキシIPが変更された場合は、必ずこのセキュリティグループを更新してください。

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 4.2 ECS 用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `testcasedb-ecs-sg` |
| 説明 | Security group for ECS |
| VPC | `testcasedb-vpc` |

**インバウンドルール:**

| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| カスタム TCP | 3000 | testcasedb-alb-sg | Allow from ALB only |

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 4.3 RDS 用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `testcasedb-rds-sg` |
| 説明 | Security group for RDS |
| VPC | `testcasedb-vpc` |

**インバウンドルール:**

| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| PostgreSQL | 5432 | testcasedb-ecs-sg | Allow from ECS |
| PostgreSQL | 5432 | testcasedb-batch-sg | Allow from Batch |

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 4.4 Batch 用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `testcasedb-batch-sg` |
| 説明 | Security group for AWS Batch |
| VPC | `testcasedb-vpc` |

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 4.5 セキュリティグループ設計のポイント

```
┌─────────────────────────────────────────────────────────────┐
│                    アクセスフロー                            │
│                                                             │
│   客先プロキシサーバー (203.0.113.50)                        │
│       │                                                     │
│       │ HTTPS:443                                          │
│       ▼                                                     │
│   ┌─────────────────────┐                                   │
│   │ WAF                                                    │
│   │ ・プロキシIPチェック (203.0.113.50/32)                 │
│   │ ・レート制限                                           │
│   │ ・脅威検出                                             │
│   │ ・それ以外は拒否                                        │
│   └──────────┬──────────┘                                   │
│              ▼                                              │
│   ┌─────────────────────┐                                   │
│   │ ALB (testcasedb-alb-sg)                                │
│   │ ・203.0.113.50/32 許可（プロキシIP）                    │
│   │ ・それ以外は拒否                                        │
│   └──────────┬──────────┘                                   │
│              │ TCP:3000 (ALB-SGからのみ)                    │
│              ▼                                              │
│   ┌─────────────────────┐                                   │
│   │ ECS (testcasedb-ecs-sg)                                │
│   └──────────┬──────────┘                                   │
│              │ TCP:5432 (ECS-SGからのみ)                    │
│              ▼                                              │
│   ┌─────────────────────┐                                   │
│   │ RDS (testcasedb-rds-sg)                                │
│   └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. RDS PostgreSQL の作成

### 5.1 サブネットグループの作成

1. **RDS** → **サブネットグループ** → **DB サブネットグループを作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-db-subnet-group` |
| 説明 | Subnet group for testcasedb |
| VPC | `testcasedb-vpc` |
| アベイラビリティゾーン | ap-northeast-1a, ap-northeast-1c |
| サブネット | プライベートサブネット2つを選択 |

### 5.2 RDS インスタンスの作成

1. **RDS** → **データベース** → **データベースの作成**

#### 基本設定

| 項目 | 値 |
|------|-----|
| エンジンタイプ | PostgreSQL |
| エンジンバージョン | PostgreSQL 15.x (最新の安定版) |
| テンプレート | 本番稼働用 |
| 可用性と耐久性 | マルチAZ DB インスタンス |

#### 設定

| 項目 | 値 |
|------|-----|
| DB インスタンス識別子 | `testcasedb-postgres` |
| マスターユーザー名 | `postgres` |
| 認証情報の管理 | AWS Secrets Manager で管理する |

#### インスタンスの設定

| 項目 | 値 |
|------|-----|
| DB インスタンスクラス | db.t3.medium（本番では db.r6g.large 以上推奨） |
| ストレージタイプ | gp3 |
| ストレージ割り当て | 100 GiB |
| ストレージの自動スケーリング | 有効（最大 500 GiB） |

#### 接続

| 項目 | 値 |
|------|-----|
| VPC | `testcasedb-vpc` |
| DB サブネットグループ | `testcasedb-db-subnet-group` |
| パブリックアクセス | **なし（重要）** |
| VPC セキュリティグループ | `testcasedb-rds-sg` |
| アベイラビリティゾーン | 指定なし |
| データベースポート | 5432 |

#### 追加設定

| 項目 | 値 |
|------|-----|
| 最初のデータベース名 | `testcase_db` |
| 自動バックアップ | 有効 |
| バックアップ保持期間 | 7 日（本番では 14-35 日推奨） |
| 暗号化 | **有効（必須）** |
| 削除保護 | **有効（本番環境では必須）** |

---

## 6. S3 バケットの作成

### 6.1 メインバケットの作成

1. **S3** → **バケットを作成**

| 項目 | 値 |
|------|-----|
| バケット名 | `testcasedb-files-{アカウントID}` |
| AWS リージョン | ap-northeast-1 |
| オブジェクト所有者 | ACL 無効 |
| ブロックパブリックアクセス | **すべてブロック（必須）** |
| バケットのバージョニング | 有効 |
| デフォルトの暗号化 | SSE-S3 または SSE-KMS |

### 6.2 フォルダ構造の作成

```
testcasedb-files-{アカウントID}/
├── control-specs/        # 制御仕様書
├── dataflows/            # データフロー
├── evidences/            # エビデンス
├── imports/              # インポートファイル
└── capl-files/           # CAPLファイル
```

### 6.3 VPC エンドポイント経由のアクセス（推奨）

S3 へのアクセスをプライベートネットワーク内に留めるため、VPC エンドポイントを使用します。

1. **VPC** → **エンドポイント** → **エンドポイントを作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-s3-endpoint` |
| サービスカテゴリ | AWS サービス |
| サービス | com.amazonaws.ap-northeast-1.s3 (Gateway) |
| VPC | testcasedb-vpc |
| ルートテーブル | プライベートサブネットのルートテーブル |

---

## 7. Secrets Manager の設定

### 7.1 JWT シークレットの作成

1. **Secrets Manager** → **新しいシークレットを保存する**

| 項目 | 値 |
|------|-----|
| シークレットのタイプ | その他のシークレットのタイプ |
| キー/値ペア | |
| - `JWT_SECRET` | （ランダムな64文字以上の文字列） |
| - `NEXTAUTH_SECRET` | （ランダムな64文字以上の文字列） |
| 暗号化キー | aws/secretsmanager |

| 項目 | 値 |
|------|-----|
| シークレット名 | `testcasedb/jwt-secrets` |
| 説明 | JWT and NextAuth secrets for testcasedb |

**シークレット値の生成:**

```bash
# ランダムな文字列を生成
openssl rand -base64 64
```

---

## 8. IAM ロールの作成

### 8.1 ECS タスク実行ロール

1. **IAM** → **ロール** → **ロールを作成**

| 項目 | 値 |
|------|-----|
| 信頼されたエンティティタイプ | AWS サービス |
| ユースケース | Elastic Container Service → Elastic Container Service Task |
| ロール名 | `testcasedb-ecs-task-execution-role` |

**アタッチするポリシー:**

- `AmazonECSTaskExecutionRolePolicy`（AWS 管理）

**追加のインラインポリシー** (SecretsManagerAccess):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "arn:aws:secretsmanager:ap-northeast-1:*:secret:testcasedb/*",
                "arn:aws:secretsmanager:ap-northeast-1:*:secret:rds!*"
            ]
        }
    ]
}
```

### 8.2 ECS タスクロール

| 項目 | 値 |
|------|-----|
| ロール名 | `testcasedb-ecs-task-role` |

**追加のインラインポリシー:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::testcasedb-files-*",
                "arn:aws:s3:::testcasedb-files-*/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "arn:aws:secretsmanager:ap-northeast-1:*:secret:testcasedb/*",
                "arn:aws:secretsmanager:ap-northeast-1:*:secret:rds!*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "batch:SubmitJob",
                "batch:DescribeJobs",
                "batch:ListJobs"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:ap-northeast-1:*:log-group:/ecs/testcasedb:*"
        }
    ]
}
```

### 8.3 AWS Batch 用ロール

Batchタスク実行ロールとタスクロールを同様に作成してください。

---

## 9. ECR リポジトリの作成

### 9.1 アプリケーション用リポジトリ

1. **ECR** → **リポジトリを作成**

| 項目 | 値 |
|------|-----|
| リポジトリタイプ | プライベート |
| リポジトリ名 | `testcasedb/app` |
| イメージタグの変更可能性 | Immutable（推奨） |
| 暗号化設定 | AES-256 |
| イメージスキャン | プッシュ時にスキャン |

### 9.2 Batch 用リポジトリ

| 項目 | 値 |
|------|-----|
| リポジトリ名 | `testcasedb/batch` |

---

## 10. ECS クラスターの作成

### 10.1 クラスターの作成

1. **ECS** → **クラスター** → **クラスターの作成**

| 項目 | 値 |
|------|-----|
| クラスター名 | `testcasedb-cluster` |
| インフラストラクチャ | AWS Fargate |
| Container Insights | オン |

### 10.2 タスク定義の作成

1. **ECS** → **タスク定義** → **新しいタスク定義の作成**

#### 基本設定

| 項目 | 値 |
|------|-----|
| タスク定義ファミリー | `testcasedb-app` |
| 起動タイプ | AWS Fargate |
| OS/アーキテクチャ | Linux/X86_64 |
| タスクサイズ - CPU | 1 vCPU |
| タスクサイズ - メモリ | 2 GB |
| タスクロール | `testcasedb-ecs-task-role` |
| タスク実行ロール | `testcasedb-ecs-task-execution-role` |

#### 環境変数

| 名前 | 値のタイプ | 値 |
|------|-----------|-----|
| NODE_ENV | Value | production |
| NEXTAUTH_URL | Value | https://testcasedb.example.com |
| DATABASE_URL | ValueFrom | (Secrets Manager ARN) |
| JWT_SECRET | ValueFrom | (Secrets Manager ARN) |
| AWS_S3_BUCKET | Value | testcasedb-files-{アカウントID} |

---

## 11. ACM 証明書の取得

### 11.1 パブリック証明書のリクエスト

1. **Certificate Manager** → **証明書をリクエスト**

| 項目 | 値 |
|------|-----|
| 証明書タイプ | パブリック証明書をリクエスト |
| ドメイン名 | testcasedb.example.com |
| サブジェクトの別名 | www.testcasedb.example.com（オプション） |
| 検証方法 | **DNS 検証**（推奨） |

### 11.2 DNS 検証の実施

1. ACM が提供する CNAME レコードを Route 53 または外部 DNS に登録
2. 検証が完了するまで待機（通常5〜30分）

**Route 53 を使用している場合:**
- ACM コンソールから **Route 53 でレコードを作成** ボタンをクリックすると自動で追加されます

---

## 12. WAF の設定（必須）

### 12.1 IP セットの作成（プロキシIP）

1. **WAF & Shield** → **IP sets** → **Create IP set**

| 項目 | 値 |
|------|-----|
| IP set name | `testcasedb-proxy-ip` |
| Region | Asia Pacific (Tokyo) |
| IP version | IPv4 |
| IP addresses | |

```
203.0.113.50/32
```

> **重要**: 客先のプロキシサーバーの固定IPのみを登録してください。IPが変更された場合は、必ずこのIPセットを更新してください。

**管理者用緊急アクセスIP（オプション）:**

管理者が別のIPからアクセスする必要がある場合は、追加のIPセットを作成します。

```
203.0.113.100/32
```

### 12.2 Web ACL の作成

1. **WAF & Shield** → **Web ACLs** → **Create web ACL**

| 項目 | 値 |
|------|-----|
| Name | `testcasedb-waf` |
| Resource type | Regional resources |
| Region | Asia Pacific (Tokyo) |
| Associated resources | （後で ALB を関連付け） |

### 12.3 ルールの設定

**ルール 1: プロキシIP 許可ルール**

| 項目 | 値 |
|------|-----|
| Rule type | IP set |
| Name | `allow-proxy-ip` |
| IP set | testcasedb-proxy-ip |
| IP address to use | Source IP address |
| Action | Allow |
| Priority | 0 |

**ルール 2: レート制限**

| 項目 | 値 |
|------|-----|
| Rule type | Rate-based rule |
| Name | `rate-limit` |
| Rate limit | 2000（5分間で2000リクエスト） |
| IP address to use | Source IP address |
| Action | Block |
| Priority | 1 |

**ルール 3: AWS マネージドルール - コアルールセット**

| 項目 | 値 |
|------|-----|
| Rule type | AWS managed rule groups |
| Name | AWSManagedRulesCommonRuleSet |
| Action | Block |
| Priority | 2 |

**ルール 4: AWS マネージド ルール - 既知の悪意のある入力**

| 項目 | 値 |
|------|-----|
| Name | AWSManagedRulesKnownBadInputsRuleSet |
| Action | Block |
| Priority | 3 |

**デフォルトアクション:**

| 項目 | 値 |
|------|-----|
| Default action | **Block** |

> **重要**: デフォルトアクションを Block に設定することで、許可リスト以外の IP からのアクセスをすべてブロックします。

### 12.4 CloudWatch ログの有効化

WAF のログを CloudWatch に送信します:

1. Web ACL を選択
2. **Logging and metrics** タブ
3. **Enable logging**
4. ロググループ: `aws-waf-logs-testcasedb`

---

## 13. Application Load Balancer の作成

### 13.1 ターゲットグループの作成

1. **EC2** → **ターゲットグループ** → **ターゲットグループの作成**

| 項目 | 値 |
|------|-----|
| ターゲットタイプ | IP アドレス |
| ターゲットグループ名 | `testcasedb-tg` |
| プロトコル | HTTP |
| ポート | 3000 |
| VPC | testcasedb-vpc |

#### ヘルスチェック設定

| 項目 | 値 |
|------|-----|
| ヘルスチェックパス | `/api/health` |
| 正常のしきい値 | 2 |
| 非正常のしきい値 | 3 |
| タイムアウト | 5 秒 |
| 間隔 | 30 秒 |

### 13.2 Application Load Balancer の作成

1. **EC2** → **ロードバランサー** → **ロードバランサーの作成** → **Application Load Balancer**

| 項目 | 値 |
|------|-----|
| ロードバランサー名 | `testcasedb-alb` |
| スキーム | **インターネット向け（Internet-facing）** |
| IP アドレスタイプ | IPv4 |

#### ネットワークマッピング

| 項目 | 値 |
|------|-----|
| VPC | testcasedb-vpc |
| マッピング | **パブリックサブネット**（2つ選択） |

#### セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ | testcasedb-alb-sg |

#### リスナーとルーティング

**HTTP リスナー (80):**

| 項目 | 値 |
|------|-----|
| プロトコル | HTTP |
| ポート | 80 |
| デフォルトアクション | HTTPS へリダイレクト（ポート443） |

**HTTPS リスナー (443):**

| 項目 | 値 |
|------|-----|
| プロトコル | HTTPS |
| ポート | 443 |
| デフォルトアクション | 転送先 → testcasedb-tg |
| セキュリティポリシー | ELBSecurityPolicy-TLS13-1-2-2021-06 |
| SSL/TLS 証明書 | ACM で取得した証明書を選択 |

### 13.3 WAF を ALB に関連付け

1. **WAF & Shield** → **Web ACLs** → `testcasedb-waf`
2. **Associated AWS resources** タブ
3. **Add AWS resources**
4. `testcasedb-alb` を選択

---

## 14. Route 53 DNS 設定

### 14.1 ホストゾーンの確認

既存のホストゾーン（example.com）があることを確認します。

### 14.2 A レコードの作成

1. **Route 53** → **ホストゾーン** → `example.com`
2. **レコードを作成**

| 項目 | 値 |
|------|-----|
| レコード名 | testcasedb |
| レコードタイプ | A - IPv4 アドレス |
| エイリアス | はい |
| トラフィックのルーティング先 | Application Load Balancer |
| リージョン | Asia Pacific (Tokyo) |
| ロードバランサー | testcasedb-alb |

---

## 15. AWS Batch の設定

### 15.1 コンピュート環境の作成

```bash
aws batch create-compute-environment \
  --compute-environment-name testcasedb-compute-env \
  --type MANAGED \
  --state ENABLED \
  --compute-resources '{
    "type": "FARGATE",
    "maxvCpus": 4,
    "subnets": ["subnet-xxxxx", "subnet-yyyyy"],
    "securityGroupIds": ["sg-xxxxx"]
  }' \
  --region ap-northeast-1
```

### 15.2 ジョブキューの作成

```bash
aws batch create-job-queue \
  --job-queue-name testcasedb-job-queue \
  --state ENABLED \
  --priority 1 \
  --compute-environment-order '[
    {
      "order": 1,
      "computeEnvironment": "testcasedb-compute-env"
    }
  ]' \
  --region ap-northeast-1
```

### 15.3 ジョブ定義の作成

```json
{
  "jobDefinitionName": "testcasedb-import-job",
  "type": "container",
  "platformCapabilities": ["FARGATE"],
  "containerProperties": {
    "image": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/testcasedb/batch:latest",
    "jobRoleArn": "arn:aws:iam::123456789012:role/testcasedb-batch-task-role",
    "executionRoleArn": "arn:aws:iam::123456789012:role/testcasedb-batch-execution-role",
    "resourceRequirements": [
      {
        "type": "VCPU",
        "value": "0.25"
      },
      {
        "type": "MEMORY",
        "value": "512"
      }
    ],
    "environment": [
      {
        "name": "AWS_REGION",
        "value": "ap-northeast-1"
      },
      {
        "name": "NODE_ENV",
        "value": "production"
      }
    ],
    "secrets": [
      {
        "name": "DATABASE_URL",
        "valueFrom": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:testcasedb/database-url"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/aws/batch/testcasedb",
        "awslogs-region": "ap-northeast-1",
        "awslogs-stream-prefix": "import"
      }
    },
    "fargatePlatformConfiguration": {
      "platformVersion": "LATEST"
    }
  }
}
```

---

## 16. CloudWatch の設定

### 16.1 ロググループの作成

| ロググループ名 | 保持期間 | 暗号化 |
|---------------|---------|--------|
| /ecs/testcasedb | 90 日 | 有効（推奨） |
| /aws/batch/testcasedb | 90 日 | 有効 |
| aws-waf-logs-testcasedb | 90 日 | 有効 |

### 16.2 重要なアラーム

| アラーム | メトリクス | しきい値 | 通知先 |
|---------|-----------|---------|--------|
| ECS CPU 高負荷 | CPUUtilization | > 80% | SNS |
| RDS CPU 高負荷 | CPUUtilization | > 80% | SNS |
| RDS 接続数上限 | DatabaseConnections | > 80% of max | SNS |
| ALB 5xx エラー | HTTPCode_ELB_5XX_Count | > 10/5min | SNS |
| WAF ブロック急増 | BlockedRequests | > 100/5min | SNS |

---

## 17. アプリケーションのデプロイ

### 17.1 Dockerfile

```dockerfile
# ビルドステージ
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# 実行ステージ
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 17.2 ヘルスチェックエンドポイント

`app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'healthy' }, { status: 200 });
}
```

### 17.3 デプロイスクリプト

```bash
#!/bin/bash
set -e

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="ap-northeast-1"
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/testcasedb/app"
IMAGE_TAG=$(git rev-parse --short HEAD)

echo "Building Docker image..."
docker build -t testcasedb/app:${IMAGE_TAG} .

echo "Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

echo "Pushing image..."
docker tag testcasedb/app:${IMAGE_TAG} ${ECR_REPO}:${IMAGE_TAG}
docker push ${ECR_REPO}:${IMAGE_TAG}
docker tag testcasedb/app:${IMAGE_TAG} ${ECR_REPO}:latest
docker push ${ECR_REPO}:latest

echo "Updating ECS service..."
aws ecs update-service \
  --cluster testcasedb-cluster \
  --service testcasedb-service \
  --force-new-deployment \
  --region ${AWS_REGION}

echo "Deployment completed!"
```

---

## 18. 動作確認

### 18.1 DNS 解決の確認

```bash
# DNS が正しく解決されるか確認
nslookup testcasedb.example.com

# 期待結果: ALB のパブリック IP アドレスが返される
```

### 18.2 アプリケーション確認

```bash
# 許可されたIPから
curl https://testcasedb.example.com/api/health
# 期待結果: {"status":"healthy"}

# ブラウザでアクセス
# https://testcasedb.example.com
```

### 18.3 IP 制限確認

```bash
# 許可されていない IP からアクセスを試みる
# → 403 Forbidden になることを確認
```

### 18.4 SSL 証明書の確認

ブラウザで https://testcasedb.example.com にアクセスし、以下を確認:
- 鍵アイコンが表示される
- 証明書が有効
- 証明書のドメインが一致

---

## 19. セキュリティチェックリスト

### 19.1 ネットワーク

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| ALB | Internet-facing タイプになっているか | ☐ |
| ALB | パブリックサブネットに配置されているか | ☐ |
| SG | ALB に IP 制限が設定されているか | ☐ |
| SG | RDS への直接アクセスが制限されているか | ☐ |
| WAF | IP 許可ルールが設定されているか | ☐ |
| WAF | レート制限が設定されているか | ☐ |

### 19.2 データ保護

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| RDS | 暗号化が有効になっているか | ☐ |
| RDS | パブリックアクセスが無効になっているか | ☐ |
| S3 | パブリックアクセスがブロックされているか | ☐ |
| S3 | 暗号化が有効になっているか | ☐ |
| Secrets | シークレットが Secrets Manager に保存されているか | ☐ |

### 19.3 アクセス制御

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| IP 制限 | 許可 IP が必要最小限か | ☐ |
| IAM | 最小権限の原則に従っているか | ☐ |
| WAF | AWS マネージドルールが有効か | ☐ |
| 証明書 | ACM 証明書が使用されているか | ☐ |
| HTTPS | HTTP が HTTPS にリダイレクトされるか | ☐ |

### 19.4 監視・ログ

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| CloudWatch | ログが出力されているか | ☐ |
| CloudWatch | 重要なアラームが設定されているか | ☐ |
| WAF | ブロックログが記録されているか | ☐ |

### 19.5 運用

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| バックアップ | RDS の自動バックアップが有効か | ☐ |
| 削除保護 | RDS の削除保護が有効か | ☐ |
| バージョニング | S3 のバージョニングが有効か | ☐ |

---

## 20. 注意事項・トラブルシューティング

### 20.1 よくある問題と対処法

#### ALB にアクセスできない

| 確認項目 | 対処法 |
|---------|--------|
| DNS | 名前解決ができているか nslookup で確認 |
| セキュリティグループ | 接続元 IP が許可されているか確認 |
| WAF | IP がブロックされていないか CloudWatch ログを確認 |
| ターゲット | ターゲットグループのヘルスチェックが通っているか |

#### 証明書エラーが出る

| 確認項目 | 対処法 |
|---------|--------|
| DNS 検証 | ACM 証明書の検証が完了しているか |
| ドメイン名 | 証明書のドメインとアクセス先が一致しているか |
| 有効期限 | 証明書が期限切れになっていないか（ACM は自動更新） |

#### WAF でブロックされる

| 確認項目 | 対処法 |
|---------|--------|
| IP セット | 接続元 IP が許可リストに含まれているか |
| レート制限 | 短時間に大量リクエストを送っていないか |
| マネージドルール | 正当なリクエストが誤検知されていないか確認 |

### 20.2 運用上の重要な注意事項

> **セキュリティ関連:**

1. **IP レンジの変更は慎重に**
   - 新規追加時は事前テスト
   - 削除時は影響範囲を確認

2. **WAF ルールの定期見直し**
   - 誤検知がないか月次で確認
   - 脅威の傾向に応じてルールを調整

3. **証明書の自動更新確認**
   - ACM は自動更新されるが、DNS レコードが削除されていないか定期確認

> **運用関連:**

4. **デプロイ時の注意**
   - 本番デプロイは業務時間外を推奨
   - ロールバック手順を事前に準備

5. **バックアップの確認**
   - RDS スナップショットからの復元テストを定期実施
   - S3 バージョニングからの復元手順を確認

6. **コスト管理**
   - 月次でコストをレビュー
   - 不要なリソースは削除

### 20.3 障害時の連絡先

| 障害種別 | 連絡先 | 対応時間 |
|---------|--------|---------|
| AWS 障害 | AWS サポート | 24/365 |
| アプリケーション障害 | 開発チーム | 平日 9:00-18:00 |
| DNS 障害 | ドメイン管理者 | 平日 9:00-18:00 |

---

## 付録

### A. コスト見積もり（月額概算）

| サービス | 構成 | 概算月額 (USD) |
|---------|------|---------------|
| ECS Fargate | 1 vCPU, 2GB × 2 タスク | ~$60 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ | ~$150 |
| Application ALB | 1 ALB | ~$25 |
| NAT Gateway | 1 NAT + データ転送 | ~$45 |
| S3 | 100GB | ~$5 |
| WAF | 1 Web ACL + ルール | ~$10 |
| CloudWatch | ログ + メトリクス | ~$10 |
| Route 53 | ホストゾーン + クエリ | ~$1 |
| ACM | パブリック証明書 | **無料** |
| **合計** | | **~$306** |

### B. プロキシIP制限のベストプラクティス

1. **プロキシIPの管理**
   - プロキシサーバーの固定IPのみを登録
   - IP変更時の更新フローを確立（WAF IPセット + ALB SG）
   - 変更履歴を記録

2. **プロキシ経由アクセスの確認**
   - 全ユーザーがプロキシを経由していることを定期的に確認
   - プロキシバイパス設定がないことを確認
   - リモートワーク時もVPN経由でプロキシを通ることを確認

3. **緊急時のアクセス**
   - 管理者用の緊急アクセス IP を別途確保（オプション）
   - 一時的な IP 追加手順を文書化
   - プロキシ障害時の代替アクセス手段を検討

4. **モニタリング**
   - WAFログでプロキシIP以外からのアクセス試行を監視
   - 異常なアクセスパターンを検出
   - プロキシIPからの大量アクセスを監視

### C. 参考リンク

- [AWS WAF ガイド](https://docs.aws.amazon.com/waf/)
- [ECS Fargate ベストプラクティス](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [ACM ユーザーガイド](https://docs.aws.amazon.com/acm/)
- [ALB ユーザーガイド](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
