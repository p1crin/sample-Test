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
15. [AWS Batch の設定（ユーザインポート用）](#15-aws-batch-の設定ユーザインポート用)
16. [CloudWatch の設定](#16-cloudwatch-の設定)
17. [アプリケーションのデプロイ](#17-アプリケーションのデプロイ)
18. [動作確認](#18-動作確認)
19. [セキュリティチェックリスト](#19-セキュリティチェックリスト)
20. [注意事項・トラブルシューティング](#20-注意事項トラブルシューティング)
21. [付録](#付録)
    - [A. コスト見積もり](#a-コスト見積もり月額概算)
    - [B. プロキシIP制限のベストプラクティス](#b-プロキシip制限のベストプラクティス)
    - [C. 参考リンク](#c-参考リンク)
    - [D. 開発環境のセッティング手順](#付録d-開発環境のセッティング手順)

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

## 15. AWS Batch の設定（ユーザインポート用）

### 15.1 概要

AWS Batchを使用して、大量のユーザデータをCSVからインポートします。バッチジョブはFargateで実行され、S3からCSVを読み込み、PostgreSQLにデータを投入します。

**処理フロー:**
```
[Webアプリ] → [CSVをS3アップロード] → [AWS Batch起動] → [Fargateでバッチ実行]
                                                           ↓
                                                     [PostgreSQL更新]
                                                           ↓
                                                     [結果をS3保存]
```

### 15.2 事前準備

#### 15.2.1 必要な変数の確認

以下のコマンドで、必要な情報を取得しておきます:

```bash
# AWSアカウントID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: ${AWS_ACCOUNT_ID}"

# VPCとサブネットID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=testcasedb-vpc" --query 'Vpcs[0].VpcId' --output text)
PRIVATE_SUBNET_1=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=*private1*" --query 'Subnets[0].SubnetId' --output text)
PRIVATE_SUBNET_2=$(aws ec2 describe-subnets --filters "Name=tag:Name,Values=*private2*" --query 'Subnets[0].SubnetId' --output text)
BATCH_SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=testcasedb-batch-sg" --query 'SecurityGroups[0].GroupId' --output text)

echo "VPC ID: ${VPC_ID}"
echo "Private Subnet 1: ${PRIVATE_SUBNET_1}"
echo "Private Subnet 2: ${PRIVATE_SUBNET_2}"
echo "Batch SG: ${BATCH_SG}"
```

### 15.3 コンピュート環境の作成

```bash
aws batch create-compute-environment \
  --compute-environment-name testcasedb-compute-env \
  --type MANAGED \
  --state ENABLED \
  --compute-resources "{
    \"type\": \"FARGATE\",
    \"maxvCpus\": 4,
    \"subnets\": [\"${PRIVATE_SUBNET_1}\", \"${PRIVATE_SUBNET_2}\"],
    \"securityGroupIds\": [\"${BATCH_SG}\"]
  }" \
  --region ap-northeast-1
```

**確認:**
```bash
aws batch describe-compute-environments \
  --compute-environments testcasedb-compute-env \
  --region ap-northeast-1
```

### 15.4 ジョブキューの作成

```bash
aws batch create-job-queue \
  --job-queue-name testcasedb-job-queue \
  --state ENABLED \
  --priority 1 \
  --compute-environment-order "[
    {
      \"order\": 1,
      \"computeEnvironment\": \"testcasedb-compute-env\"
    }
  ]" \
  --region ap-northeast-1
```

**確認:**
```bash
aws batch describe-job-queues \
  --job-queues testcasedb-job-queue \
  --region ap-northeast-1
```

### 15.5 CloudWatch ロググループの作成

```bash
aws logs create-log-group \
  --log-group-name /aws/batch/testcasedb \
  --region ap-northeast-1

# ログ保持期間を90日に設定
aws logs put-retention-policy \
  --log-group-name /aws/batch/testcasedb \
  --retention-in-days 90 \
  --region ap-northeast-1
```

### 15.6 IAM ロールの作成

#### 15.6.1 Batch タスク実行ロール

```bash
# 信頼関係ポリシー
cat > batch-execution-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# ロール作成
aws iam create-role \
  --role-name testcasedb-batch-execution-role \
  --assume-role-policy-document file://batch-execution-trust-policy.json

# 管理ポリシーをアタッチ
aws iam attach-role-policy \
  --role-name testcasedb-batch-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Secrets Manager アクセス許可
cat > batch-execution-policy.json <<'EOF'
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
EOF

aws iam put-role-policy \
  --role-name testcasedb-batch-execution-role \
  --policy-name SecretsManagerAccess \
  --policy-document file://batch-execution-policy.json
```

#### 15.6.2 Batch タスクロール

```bash
# タスクロール作成
aws iam create-role \
  --role-name testcasedb-batch-task-role \
  --assume-role-policy-document file://batch-execution-trust-policy.json

# S3, Secrets Manager, CloudWatch アクセス許可
cat > batch-task-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::testcasedb-files-${AWS_ACCOUNT_ID}",
        "arn:aws:s3:::testcasedb-files-${AWS_ACCOUNT_ID}/*"
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
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:*:log-group:/aws/batch/testcasedb:*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name testcasedb-batch-task-role \
  --policy-name BatchTaskPolicy \
  --policy-document file://batch-task-policy.json
```

### 15.7 Dockerイメージのビルドとプッシュ

```bash
cd batch

# Dockerイメージのビルド
docker build -t testcasedb/batch:latest .

# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com

# タグ付けとプッシュ
docker tag testcasedb/batch:latest ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/testcasedb/batch:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/testcasedb/batch:latest
```

### 15.8 ジョブ定義の作成（ユーザインポート用）

```bash
# DATABASE_URLのSecrets Manager ARNを取得
DATABASE_SECRET_ARN=$(aws secretsmanager describe-secret \
  --secret-id rds!cluster-xxxxxx \
  --query 'ARN' \
  --output text)

# ジョブ定義JSONを作成
cat > user-import-job-definition.json <<EOF
{
  "jobDefinitionName": "testcasedb-user-import",
  "type": "container",
  "platformCapabilities": ["FARGATE"],
  "containerProperties": {
    "image": "${AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-1.amazonaws.com/testcasedb/batch:latest",
    "jobRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/testcasedb-batch-task-role",
    "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/testcasedb-batch-execution-role",
    "resourceRequirements": [
      {
        "type": "VCPU",
        "value": "0.5"
      },
      {
        "type": "MEMORY",
        "value": "1024"
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
        "valueFrom": "${DATABASE_SECRET_ARN}"
      }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/aws/batch/testcasedb",
        "awslogs-region": "ap-northeast-1",
        "awslogs-stream-prefix": "user-import"
      }
    },
    "fargatePlatformConfiguration": {
      "platformVersion": "LATEST"
    },
    "networkConfiguration": {
      "assignPublicIp": "DISABLED"
    }
  },
  "timeout": {
    "attemptDurationSeconds": 3600
  },
  "retryStrategy": {
    "attempts": 1
  }
}
EOF

# ジョブ定義を登録
aws batch register-job-definition \
  --cli-input-json file://user-import-job-definition.json \
  --region ap-northeast-1
```

**確認:**
```bash
aws batch describe-job-definitions \
  --job-definition-name testcasedb-user-import \
  --status ACTIVE \
  --region ap-northeast-1
```

### 15.9 アプリケーション環境変数の設定

メインアプリケーションのECSタスク定義に以下の環境変数を追加します:

```json
{
  "name": "AWS_BATCH_JOB_QUEUE",
  "value": "arn:aws:batch:ap-northeast-1:${AWS_ACCOUNT_ID}:job-queue/testcasedb-job-queue"
},
{
  "name": "AWS_BATCH_USER_IMPORT_JOB_DEFINITION",
  "value": "arn:aws:batch:ap-northeast-1:${AWS_ACCOUNT_ID}:job-definition/testcasedb-user-import:1"
},
{
  "name": "S3_IMPORT_BUCKET",
  "value": "testcasedb-files-${AWS_ACCOUNT_ID}"
}
```

### 15.10 動作確認

#### 15.10.1 テスト用CSVの準備

```csv
id,name,email,user_role,department,company,password
,山田太郎,yamada.taro@example.com,1,開発部,株式会社ABC,testpass123
,佐藤花子,sato.hanako@example.com,2,品質保証部,株式会社ABC,testpass456
```

#### 15.10.2 S3へアップロード

```bash
echo 'id,name,email,user_role,department,company,password
,山田太郎,yamada.taro@example.com,1,開発部,株式会社ABC,testpass123
,佐藤花子,sato.hanako@example.com,2,品質保証部,株式会社ABC,testpass456' > test-users.csv

aws s3 cp test-users.csv s3://testcasedb-files-${AWS_ACCOUNT_ID}/user-import/test-users.csv
```

#### 15.10.3 ジョブの手動実行（テスト）

```bash
aws batch submit-job \
  --job-name test-user-import-$(date +%Y%m%d-%H%M%S) \
  --job-queue testcasedb-job-queue \
  --job-definition testcasedb-user-import \
  --container-overrides "{
    \"environment\": [
      {\"name\": \"INPUT_S3_BUCKET\", \"value\": \"testcasedb-files-${AWS_ACCOUNT_ID}\"},
      {\"name\": \"INPUT_S3_KEY\", \"value\": \"user-import/test-users.csv\"},
      {\"name\": \"OUTPUT_S3_BUCKET\", \"value\": \"testcasedb-files-${AWS_ACCOUNT_ID}\"},
      {\"name\": \"EXECUTOR_NAME\", \"value\": \"admin\"}
    ]
  }" \
  --region ap-northeast-1
```

#### 15.10.4 ジョブステータスの確認

```bash
# ジョブIDを取得（前のコマンドの出力から）
JOB_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# ステータス確認
aws batch describe-jobs \
  --jobs ${JOB_ID} \
  --region ap-northeast-1 \
  --query 'jobs[0].status' \
  --output text

# ログ確認
aws logs tail /aws/batch/testcasedb --follow
```

#### 15.10.5 結果の確認

```bash
# S3から結果ファイルを取得
aws s3 ls s3://testcasedb-files-${AWS_ACCOUNT_ID}/user-import-results/

# 最新の結果をダウンロード
aws s3 cp s3://testcasedb-files-${AWS_ACCOUNT_ID}/user-import-results/result-latest.json ./

# 結果を表示
cat result-latest.json | jq
```

#### 15.10.6 データベース確認

```bash
# RDSに接続して確認
psql -h testcasedb-postgres.xxxxxx.ap-northeast-1.rds.amazonaws.com \
     -U postgres \
     -d testcase_db \
     -c "SELECT id, name, email, user_role FROM mt_users WHERE email LIKE '%@example.com';"
```

### 15.11 トラブルシューティング

#### ジョブが RUNNABLE で止まる

| 原因 | 対処法 |
|------|--------|
| コンピュート環境のリソース不足 | maxvCpus を増やす |
| サブネットの IP 枯渇 | サブネットの CIDR を拡張 |

#### ジョブが FAILED になる

```bash
# エラーログを確認
aws batch describe-jobs \
  --jobs ${JOB_ID} \
  --region ap-northeast-1 \
  --query 'jobs[0].container.reason'

# CloudWatch Logsを確認
aws logs tail /aws/batch/testcasedb --follow
```

#### DATABASE_URL が取得できない

| 確認項目 | 対処法 |
|---------|--------|
| Secrets Manager の ARN | 正しいARNが設定されているか確認 |
| IAM ロール権限 | batch-execution-role に GetSecretValue 権限があるか |
| Secrets Manager の値 | シークレットに正しいDATABASE_URLが保存されているか |

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
- [AWS Batch ユーザーガイド](https://docs.aws.amazon.com/batch/)

---

## 付録D: 開発環境のセッティング手順

本付録では、ローカル開発環境でアプリケーションとバッチジョブをセットアップする手順を説明します。

### D.1 前提条件

#### D.1.1 必要なソフトウェア

| ソフトウェア | バージョン | インストール方法 |
|------------|-----------|----------------|
| Node.js | 20.x LTS | [公式サイト](https://nodejs.org/) |
| Docker Desktop | 最新版 | [公式サイト](https://www.docker.com/products/docker-desktop) |
| PostgreSQL | 15.x | [公式サイト](https://www.postgresql.org/download/) or Docker |
| AWS CLI | 2.x | [公式サイト](https://aws.amazon.com/cli/) |
| Git | 最新版 | [公式サイト](https://git-scm.com/) |

#### D.1.2 環境確認

```bash
# バージョン確認
node -v    # v20.x.x
npm -v     # 10.x.x
docker -v  # Docker version 24.x.x
psql --version  # psql (PostgreSQL) 15.x
aws --version   # aws-cli/2.x.x
```

### D.2 プロジェクトのクローン

```bash
# リポジトリをクローン
git clone https://github.com/your-org/testcasedb.git
cd testcasedb
```

### D.3 PostgreSQLのセットアップ

#### D.3.1 Dockerを使用する場合（推奨）

```bash
# PostgreSQL コンテナを起動
docker run --name testcasedb-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=testcase_db \
  -p 5432:5432 \
  -d postgres:15

# 起動確認
docker ps | grep testcasedb-postgres
```

#### D.3.2 ローカルインストールを使用する場合

```bash
# PostgreSQLサービスを起動（macOS）
brew services start postgresql@15

# データベース作成
createdb testcase_db -U postgres
```

### D.4 メインアプリケーションのセットアップ

#### D.4.1 依存関係のインストール

```bash
# プロジェクトルートで実行
npm install
```

#### D.4.2 環境変数の設定

```bash
# .env.localファイルを作成
cp .env.example .env.local

# .env.localを編集
cat > .env.local <<'EOF'
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testcase_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=development-secret-key-change-in-production

# AWS Configuration (開発環境ではローカルのみで動作)
AWS_REGION=ap-northeast-1
S3_IMPORT_BUCKET=testcasedb-dev-bucket

# AWS Batch (開発環境では使用しない場合はコメントアウト)
# AWS_BATCH_JOB_QUEUE=
# AWS_BATCH_USER_IMPORT_JOB_DEFINITION=
EOF
```

#### D.4.3 Prismaのセットアップ

```bash
# Prisma Clientを生成
npx prisma generate

# データベースマイグレーション実行
npx prisma migrate dev

# 初期データ投入（必要に応じて）
npx prisma db seed
```

#### D.4.4 アプリケーション起動

```bash
# 開発サーバー起動
npm run dev

# ブラウザで確認
# http://localhost:3000
```

### D.5 バッチジョブのセットアップ

#### D.5.1 依存関係のインストール

```bash
cd batch
npm install
```

#### D.5.2 Prisma Client生成

```bash
# batchディレクトリで実行
npx prisma generate
```

#### D.5.3 環境変数の設定

```bash
# batch/.envファイルを作成
cat > .env <<'EOF'
# Database connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testcase_db

# AWS Configuration
AWS_REGION=ap-northeast-1

# User Import Configuration (ローカルテスト用)
INPUT_S3_BUCKET=testcasedb-dev-bucket
INPUT_S3_KEY=user-import/test-users.csv
OUTPUT_S3_BUCKET=testcasedb-dev-bucket
EXECUTOR_NAME=developer
EOF
```

### D.6 ローカルでのバッチテスト

#### D.6.1 ローカルファイルシステムを使用

S3の代わりにローカルファイルシステムを使用する場合、バッチコードを一時的に修正します。

```bash
# テスト用CSVファイルを作成
mkdir -p /tmp/testcasedb/user-import
cat > /tmp/testcasedb/user-import/test-users.csv <<'EOF'
id,name,email,user_role,department,company,password
,開発太郎,dev.taro@example.local,0,開発部,ローカル株式会社,devpass123
,テスト花子,test.hanako@example.local,2,QA部,ローカル株式会社,testpass456
EOF
```

#### D.6.2 バッチを直接実行

```bash
cd batch

# TypeScriptを直接実行
npm run user-import
```

#### D.6.3 Dockerコンテナでテスト

```bash
# Dockerイメージをビルド
docker build -t testcasedb-batch:dev .

# コンテナで実行
docker run --rm \
  --network host \
  -e DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testcase_db \
  -e AWS_REGION=ap-northeast-1 \
  -e INPUT_S3_BUCKET=testcasedb-dev-bucket \
  -e INPUT_S3_KEY=user-import/test-users.csv \
  -e OUTPUT_S3_BUCKET=testcasedb-dev-bucket \
  -e EXECUTOR_NAME=developer \
  testcasedb-batch:dev
```

### D.7 AWS開発環境との連携

開発環境でS3を使用する方法は2つあります：
1. **LocalStackを使用したローカルS3エミュレーション**（推奨）
2. **実際のAWS S3を使用**

#### D.7.1 LocalStackを使用したローカルS3エミュレーション（推奨）

LocalStackは、AWSサービスをローカルでエミュレートするツールです。開発環境でS3を使用する場合に推奨されます。

##### D.7.1.1 LocalStackのインストールと起動

```bash
# docker-compose.ymlを作成
cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"  # LocalStackのメインエンドポイント
    environment:
      - SERVICES=s3
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "./localstack-data:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: testcase_db
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
EOF

# LocalStackとPostgreSQLを起動
docker-compose up -d

# LocalStackが起動するまで待機（約10秒）
sleep 10
```

##### D.7.1.2 LocalStack用のS3バケット作成

```bash
# AWS CLIをLocalStackに向ける
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=ap-northeast-1

# バケット作成
aws s3 mb s3://testcasedb-dev-bucket --endpoint-url=http://localhost:4566

# フォルダ構造作成
aws s3api put-object \
  --bucket testcasedb-dev-bucket \
  --key user-import/ \
  --endpoint-url=http://localhost:4566

aws s3api put-object \
  --bucket testcasedb-dev-bucket \
  --key user-import-results/ \
  --endpoint-url=http://localhost:4566

aws s3api put-object \
  --bucket testcasedb-dev-bucket \
  --key control-specs/ \
  --endpoint-url=http://localhost:4566

aws s3api put-object \
  --bucket testcasedb-dev-bucket \
  --key dataflows/ \
  --endpoint-url=http://localhost:4566

aws s3api put-object \
  --bucket testcasedb-dev-bucket \
  --key evidences/ \
  --endpoint-url=http://localhost:4566

# バケット一覧確認
aws s3 ls --endpoint-url=http://localhost:4566
```

##### D.7.1.3 環境変数の設定（LocalStack用）

```bash
# .env.localに追加
cat >> .env.local <<'EOF'

# LocalStack S3設定
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=testcasedb-dev-bucket
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# 開発環境ではS3署名なしアクセスを許可
S3_FORCE_PATH_STYLE=true
EOF
```

##### D.7.1.4 S3クライアントのローカル設定

アプリケーションコードでLocalStackを使用するために、S3クライアントの設定を調整します。

**開発環境用S3クライアントヘルパー (`lib/s3-client.ts`):**

```typescript
import { S3Client } from '@aws-sdk/client-s3';

// 開発環境でLocalStackを使用する場合の設定
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  endpoint: process.env.AWS_ENDPOINT_URL, // LocalStack: http://localhost:4566
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', // LocalStackではtrue
  credentials: process.env.AWS_ENDPOINT_URL ? {
    // LocalStack使用時はダミー認証情報
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  } : undefined, // 本番環境ではIAMロールから自動取得
});
```

##### D.7.1.5 LocalStackでのS3操作テスト

```bash
# テストファイルをアップロード
echo "Test content" > test.txt
aws s3 cp test.txt s3://testcasedb-dev-bucket/test.txt \
  --endpoint-url=http://localhost:4566

# ファイル一覧確認
aws s3 ls s3://testcasedb-dev-bucket/ \
  --endpoint-url=http://localhost:4566

# ファイルをダウンロード
aws s3 cp s3://testcasedb-dev-bucket/test.txt downloaded.txt \
  --endpoint-url=http://localhost:4566

# 内容確認
cat downloaded.txt

# クリーンアップ
rm test.txt downloaded.txt
```

#### D.7.2 実際のAWS S3を使用する場合

本番環境に近い環境でテストする場合は、実際のAWS S3を使用します。

##### D.7.2.1 開発用IAMユーザーの作成

```bash
# IAMユーザー作成（AWS Management Consoleまたは以下のCLIで）
aws iam create-user --user-name testcasedb-dev-user

# S3アクセス用のポリシーを作成
cat > dev-s3-policy.json <<'EOF'
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
        "arn:aws:s3:::testcasedb-dev-bucket-*",
        "arn:aws:s3:::testcasedb-dev-bucket-*/*"
      ]
    }
  ]
}
EOF

# ポリシーを作成
aws iam create-policy \
  --policy-name testcasedb-dev-s3-access \
  --policy-document file://dev-s3-policy.json

# ユーザーにポリシーをアタッチ
aws iam attach-user-policy \
  --user-name testcasedb-dev-user \
  --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/testcasedb-dev-s3-access

# アクセスキーを作成
aws iam create-access-key --user-name testcasedb-dev-user

# ⚠️ 出力されたAccessKeyIdとSecretAccessKeyを安全に保存してください
```

##### D.7.2.2 AWS認証情報の設定

```bash
# AWS CLIの設定（プロファイル使用）
aws configure --profile testcasedb-dev

# 以下を入力
# AWS Access Key ID: [上記で作成したアクセスキー]
# AWS Secret Access Key: [上記で作成したシークレットキー]
# Default region name: ap-northeast-1
# Default output format: json

# プロファイルを環境変数で指定
export AWS_PROFILE=testcasedb-dev
```

##### D.7.2.3 開発用S3バケットの作成

```bash
# アカウントIDを取得
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# バケット作成（アカウントIDをサフィックスに付ける）
aws s3 mb s3://testcasedb-dev-bucket-${AWS_ACCOUNT_ID}

# バージョニング有効化
aws s3api put-bucket-versioning \
  --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} \
  --versioning-configuration Status=Enabled

# パブリックアクセスブロック（セキュリティ）
aws s3api put-public-access-block \
  --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# フォルダ構造作成
aws s3api put-object --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} --key user-import/
aws s3api put-object --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} --key user-import-results/
aws s3api put-object --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} --key control-specs/
aws s3api put-object --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} --key dataflows/
aws s3api put-object --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} --key evidences/
aws s3api put-object --bucket testcasedb-dev-bucket-${AWS_ACCOUNT_ID} --key capl-files/

# バケット確認
aws s3 ls s3://testcasedb-dev-bucket-${AWS_ACCOUNT_ID}/
```

##### D.7.2.4 環境変数の設定（実AWS用）

```bash
# .env.localに追加（LocalStack設定を置き換え）
cat > .env.local <<EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testcase_db

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=development-secret-key-change-in-production

# AWS S3設定（実環境）
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=testcasedb-dev-bucket-${AWS_ACCOUNT_ID}
# 開発環境では認証情報をここに記載するか、AWS CLIのプロファイルを使用
# AWS_ACCESS_KEY_ID=（IAMユーザーのアクセスキー）
# AWS_SECRET_ACCESS_KEY=（IAMユーザーのシークレットキー）

# AWS Batch（開発環境では通常使用しない）
# AWS_BATCH_JOB_QUEUE=
# AWS_BATCH_USER_IMPORT_JOB_DEFINITION=
EOF
```

**セキュリティのベストプラクティス:**

環境変数にアクセスキーを直接記載する代わりに、AWS CLIのプロファイルを使用することを推奨します。

```bash
# プロファイルを使用する場合
export AWS_PROFILE=testcasedb-dev
npm run dev
```

#### D.7.3 S3を使ったアプリケーションのテスト

##### D.7.3.1 ユーザーインポート機能のテスト

```bash
# テスト用CSVファイルを作成
cat > test-users.csv <<'EOF'
id,name,email,user_role,department,company,password
,開発太郎,dev.taro@example.local,0,開発部,ローカル株式会社,devpass123
,テスト花子,test.hanako@example.local,2,QA部,ローカル株式会社,testpass456
EOF

# LocalStackの場合
aws s3 cp test-users.csv s3://testcasedb-dev-bucket/user-import/test-users.csv \
  --endpoint-url=http://localhost:4566

# 実AWS S3の場合
aws s3 cp test-users.csv s3://testcasedb-dev-bucket-${AWS_ACCOUNT_ID}/user-import/test-users.csv

# バッチジョブを起動（アプリケーションのUIまたはAPIから）
# または直接バッチスクリプトを実行
cd batch
npm run user-import

# 結果を確認
# LocalStackの場合
aws s3 ls s3://testcasedb-dev-bucket/user-import-results/ \
  --endpoint-url=http://localhost:4566

# 実AWS S3の場合
aws s3 ls s3://testcasedb-dev-bucket-${AWS_ACCOUNT_ID}/user-import-results/
```

##### D.7.3.2 ファイルアップロード機能のテスト

アプリケーションのファイルアップロード機能をテストする場合:

```bash
# アプリケーションを起動
npm run dev

# ブラウザで http://localhost:3000 にアクセス
# テストケースにファイル（制御仕様書やデータフロー）をアップロード

# S3にファイルがアップロードされたことを確認
# LocalStackの場合
aws s3 ls s3://testcasedb-dev-bucket/control-specs/ --recursive \
  --endpoint-url=http://localhost:4566

# 実AWS S3の場合
aws s3 ls s3://testcasedb-dev-bucket-${AWS_ACCOUNT_ID}/control-specs/ --recursive
```

##### D.7.3.3 S3クライアントの動作確認スクリプト

開発環境でS3クライアントが正しく設定されているか確認するためのスクリプト:

```typescript
// scripts/test-s3-connection.ts
import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  endpoint: process.env.AWS_ENDPOINT_URL,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: process.env.AWS_ENDPOINT_URL ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  } : undefined,
});

async function testS3Connection() {
  try {
    // バケット一覧取得
    const listCommand = new ListBucketsCommand({});
    const listResponse = await s3Client.send(listCommand);
    console.log('✅ S3接続成功');
    console.log('バケット一覧:', listResponse.Buckets?.map(b => b.Name));

    // テストファイルをアップロード
    const bucketName = process.env.AWS_S3_BUCKET || 'testcasedb-dev-bucket';
    const testKey = 'test/connection-test.txt';
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: 'Test content from S3 connection test',
      ContentType: 'text/plain',
    });
    await s3Client.send(putCommand);
    console.log(`✅ アップロード成功: s3://${bucketName}/${testKey}`);

    // ファイルをダウンロード
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });
    const getResponse = await s3Client.send(getCommand);
    const content = await getResponse.Body?.transformToString();
    console.log('✅ ダウンロード成功');
    console.log('内容:', content);

  } catch (error) {
    console.error('❌ S3接続エラー:', error);
    process.exit(1);
  }
}

testS3Connection();
```

実行:

```bash
# TypeScriptを直接実行
npx tsx scripts/test-s3-connection.ts
```

#### D.7.4 開発用RDSへの接続

開発用RDSインスタンスがある場合:

```bash
# セキュリティグループで開発者のIPを許可（一時的）
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxx \
  --protocol tcp \
  --port 5432 \
  --cidr ${MY_IP}/32

# 接続確認
psql -h testcasedb-dev.xxxxxx.ap-northeast-1.rds.amazonaws.com \
     -U postgres \
     -d testcase_db
```

### D.8 ローカル開発のTips

#### D.8.1 ホットリロード

```bash
# メインアプリケーション
npm run dev  # ファイル変更時に自動リロード

# バッチ（tsx使用）
npm run user-import  # 変更後は再実行が必要
```

#### D.8.2 デバッグ

```bash
# Next.jsアプリのデバッグ
NODE_OPTIONS='--inspect' npm run dev

# VS Codeのデバッガーを使用
# .vscode/launch.jsonを参照
```

#### D.8.3 ログ確認

```bash
# アプリケーションログ
# ブラウザの開発者ツールコンソール

# サーバーログ
# ターミナルの出力を確認

# データベースログ（Docker使用時）
docker logs testcasedb-postgres
```

### D.9 データのリセット

```bash
# データベース全削除
npx prisma migrate reset

# 再度マイグレーション
npx prisma migrate dev

# 初期データ再投入
npx prisma db seed
```

### D.10 開発環境での注意事項

#### D.10.1 セキュリティ

- **本番データは使用しない**: 開発環境では必ずテストデータを使用
- **認証情報の管理**: `.env.local`はGitに含めない（`.gitignore`で除外されていることを確認）
- **AWS認証情報**: 開発用の限定的な権限のみを持つIAMユーザーを使用

#### D.10.2 パフォーマンス

- **Dockerリソース**: Docker Desktopに十分なメモリ（4GB以上推奨）を割り当てる
- **Node.jsメモリ**: 大量データ処理時は `NODE_OPTIONS=--max-old-space-size=4096` を設定

#### D.10.3 トラブルシューティング

##### 基本的な問題

| 問題 | 解決方法 |
|------|---------|
| PostgreSQL接続エラー | Dockerコンテナが起動しているか確認 `docker ps` |
| Prisma Client エラー | `npx prisma generate` を実行 |
| ポート競合 | 他のアプリケーションが3000, 5432を使用していないか確認 |
| npm install失敗 | `rm -rf node_modules package-lock.json && npm install` |

##### S3関連の問題

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| LocalStackに接続できない | LocalStackが起動していない | `docker-compose ps` で確認、`docker-compose up -d` で再起動 |
| S3バケットが見つからない | バケットが作成されていない | `aws s3 ls --endpoint-url=http://localhost:4566` で確認、未作成なら作成 |
| 認証情報エラー（LocalStack） | 環境変数が設定されていない | `.env.local` に `AWS_ACCESS_KEY_ID=test` `AWS_SECRET_ACCESS_KEY=test` を追加 |
| 認証情報エラー（実AWS） | IAMユーザーの認証情報が正しくない | `aws configure --profile testcasedb-dev` で再設定 |
| ファイルアップロードが失敗 | S3クライアントの設定が正しくない | `endpoint`, `forcePathStyle`, `credentials` の設定を確認 |
| `InvalidAccessKeyId` | アクセスキーが無効 | AWS Management Consoleで新しいアクセスキーを生成 |
| `NoSuchBucket` | バケット名が正しくない | 環境変数 `AWS_S3_BUCKET` の値を確認 |
| `AccessDenied` | IAMポリシーが不足 | IAMユーザーに適切なS3ポリシーがアタッチされているか確認 |

##### S3接続の診断コマンド

```bash
# LocalStackの状態確認
docker-compose ps

# LocalStackのログ確認
docker-compose logs localstack

# LocalStackのS3エンドポイント確認
curl http://localhost:4566/_localstack/health | jq

# バケット一覧確認（LocalStack）
aws s3 ls --endpoint-url=http://localhost:4566

# バケット一覧確認（実AWS）
aws s3 ls --profile testcasedb-dev

# 環境変数の確認
echo "AWS_ENDPOINT_URL: $AWS_ENDPOINT_URL"
echo "AWS_S3_BUCKET: $AWS_S3_BUCKET"
echo "AWS_REGION: $AWS_REGION"

# S3クライアント接続テスト
npx tsx scripts/test-s3-connection.ts
```

##### よくあるエラーメッセージと対処法

**エラー: `connect ECONNREFUSED 127.0.0.1:4566`**

LocalStackが起動していません。

```bash
docker-compose up -d localstack
sleep 10  # 起動を待つ
```

**エラー: `The bucket you are attempting to access must be addressed using the specified endpoint`**

`forcePathStyle` が設定されていません。

```bash
# .env.localに追加
S3_FORCE_PATH_STYLE=true
```

**エラー: `Credential should be scoped to a valid region`**

リージョンが正しく設定されていません。

```bash
# .env.localで確認
AWS_REGION=ap-northeast-1
```

**エラー: `The AWS Access Key Id you provided does not exist in our records`**

実AWS使用時にアクセスキーが無効です。

```bash
# 認証情報を再設定
aws configure --profile testcasedb-dev
```

### D.11 本番環境への移行

開発環境での動作確認後、本番環境にデプロイする際は:

1. **環境変数の確認**: 本番用の環境変数を設定（Secrets Manager使用）
2. **データベースマイグレーション**: 本番RDSでマイグレーション実行
3. **Dockerイメージビルド**: 本番用イメージをECRにプッシュ
4. **ECSタスク定義更新**: 本番環境のタスク定義を更新
5. **動作確認**: ヘルスチェックとログ監視

```bash
# 本番デプロイスクリプト実行例
./scripts/deploy-production.sh
```
