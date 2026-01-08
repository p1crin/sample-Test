# AWS デプロイメント手順書（社内システム版）

## 目次

1. [前提条件](#1-前提条件)
2. [全体構成概要](#2-全体構成概要)
3. [VPC の作成](#3-vpc-の作成)
4. [VPN 接続の設定](#4-vpn-接続の設定)
5. [セキュリティグループの作成](#5-セキュリティグループの作成)
6. [RDS PostgreSQL の作成](#6-rds-postgresql-の作成)
7. [S3 バケットの作成](#7-s3-バケットの作成)
8. [Secrets Manager の設定](#8-secrets-manager-の設定)
9. [IAM ロールの作成](#9-iam-ロールの作成)
10. [ECR リポジトリの作成](#10-ecr-リポジトリの作成)
11. [ECS クラスターの作成](#11-ecs-クラスターの作成)
12. [ACM Private CA の設定](#12-acm-private-ca-の設定)
13. [Internal ALB の作成](#13-internal-alb-の作成)
14. [IP 制限の設定](#14-ip-制限の設定)
15. [WAF の設定（任意）](#15-waf-の設定任意)
16. [AWS Batch の設定](#16-aws-batch-の設定)
17. [CloudWatch の設定](#17-cloudwatch-の設定)
18. [アプリケーションのデプロイ](#18-アプリケーションのデプロイ)
19. [動作確認](#19-動作確認)
20. [セキュリティチェックリスト](#20-セキュリティチェックリスト)
21. [注意事項・トラブルシューティング](#21-注意事項トラブルシューティング)

---

## 1. 前提条件

### 1.1 必要なもの

- AWS アカウント（Admin 権限あり）
- AWS CLI がインストールされていること
- Docker がインストールされていること
- 客先オンプレミス環境のネットワーク情報
  - 社内ネットワーク CIDR（例: 10.0.0.0/8, 172.16.0.0/12）
  - VPN 接続用のグローバル IP アドレス
  - 許可する IP アドレス範囲のリスト

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
| 社内ネットワーク CIDR | 10.100.0.0/16 | VPC ピアリング、IP 制限 |
| VPN 用グローバル IP | 203.0.113.1 | Customer Gateway |
| 許可 IP レンジ | 10.100.10.0/24, 10.100.20.0/24 | ALB アクセス制限 |
| DNS サーバー IP | 10.100.1.10 | Route 53 Resolver |
| 内部ドメイン名 | testcasedb.internal.example.co.jp | 証明書、DNS |

---

## 2. 全体構成概要

### 2.1 社内システム向けアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────┐
│                      客先オンプレミス環境                             │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  社内ネットワーク (10.100.0.0/16)                               │  │
│  │                                                                 │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐ │  │
│  │  │ 管理者PC  │  │ 一般PC   │  │ 認証基盤 (AD/LDAP等)         │ │  │
│  │  │10.100.10.x│  │10.100.20.x│  │ 10.100.1.x                  │ │  │
│  │  └─────┬────┘  └─────┬────┘  └──────────────────────────────┘ │  │
│  │        │             │                                         │  │
│  │        └──────┬──────┘                                         │  │
│  │               │                                                 │  │
│  │        ┌──────┴──────┐                                         │  │
│  │        │ VPN 装置     │ ← Customer Gateway (203.0.113.1)       │  │
│  │        └──────┬──────┘                                         │  │
│  └───────────────┼─────────────────────────────────────────────────┘  │
│                  │                                                    │
│                  │ IPsec VPN トンネル (暗号化)                        │
│                  │                                                    │
└──────────────────┼────────────────────────────────────────────────────┘
                   │
┌──────────────────┼────────────────────────────────────────────────────┐
│                  │            AWS Cloud                               │
│                  ▼                                                    │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  Virtual Private Gateway (VGW)                                   │ │
│  └──────────────────────────┬──────────────────────────────────────┘ │
│                             │                                         │
│  ┌──────────────────────────┼──────────────────────────────────────┐ │
│  │                          │       VPC (10.0.0.0/16)               │ │
│  │                          │                                       │ │
│  │  ┌───────────────────────┴─────────────────────────────────────┐│ │
│  │  │                    Private Subnet                            ││ │
│  │  │                                                              ││ │
│  │  │  ┌─────────────────┐      ┌───────────────────────────────┐ ││ │
│  │  │  │  Internal ALB   │      │      ECS Fargate              │ ││ │
│  │  │  │  + IP制限       │─────▶│  ┌─────────────────────────┐  │ ││ │
│  │  │  │  (10.100.x.x許可)│      │  │ テストケースDBアプリ     │  │ ││ │
│  │  │  └─────────────────┘      │  │ + Prisma Client         │  │ ││ │
│  │  │                           │  └─────────────────────────┘  │ ││ │
│  │  │                           └───────────────┬───────────────┘ ││ │
│  │  │                                           │                  ││ │
│  │  │                                           ▼                  ││ │
│  │  │                           ┌───────────────────────────────┐ ││ │
│  │  │                           │    RDS PostgreSQL Multi-AZ    │ ││ │
│  │  │                           └───────────────────────────────┘ ││ │
│  │  │                                                              ││ │
│  │  │  ┌─────────────────┐                                        ││ │
│  │  │  │   AWS Batch     │ ← ファイルインポート処理               ││ │
│  │  │  └─────────────────┘                                        ││ │
│  │  └──────────────────────────────────────────────────────────────┘│ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────┐ ┌────────────────┐ ┌───────────┐ ┌────────────────────┐ │
│  │    S3    │ │Secrets Manager │ │CloudWatch │ │ ACM Private CA     │ │
│  └──────────┘ └────────────────┘ └───────────┘ └────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 インターネット公開版との主な違い

| 項目 | インターネット公開 | 社内システム（本手順） |
|------|------------------|----------------------|
| ALB タイプ | Internet-facing | **Internal** |
| ALB 配置 | Public Subnet | **Private Subnet** |
| アクセス経路 | インターネット | **VPN / Direct Connect** |
| IP 制限 | WAF で実装 | **SG + WAF（多層防御）** |
| SSL 証明書 | ACM パブリック | **ACM Private CA** |
| WAF | 必須 | **任意（推奨）** |
| NAT Gateway | 必須 | 必須（外部 API 用） |

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

> **注意**: 社内システムでもパブリックサブネットは必要です。NAT Gateway を配置して、ECS タスクから外部 API（npm レジストリ等）へのアクセスを可能にします。

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

### 3.4 CIDR 設計の注意点

> **重要**: VPC の CIDR は社内ネットワークと重複しないようにしてください。

```
✗ 避けるべき例:
  社内: 10.0.0.0/8    → AWS: 10.0.0.0/16  (重複)
  社内: 172.16.0.0/12 → AWS: 172.16.0.0/16 (重複)

✓ 推奨例:
  社内: 10.100.0.0/16 → AWS: 10.0.0.0/16  (重複なし)
  社内: 172.16.0.0/16 → AWS: 172.31.0.0/16 (重複なし)
```

---

## 4. VPN 接続の設定

### 4.1 Customer Gateway の作成

1. **VPC** → **カスタマーゲートウェイ** → **カスタマーゲートウェイを作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-cgw` |
| BGP ASN | 65000（オンプレ側で指定がある場合はその値） |
| IP アドレス | 客先 VPN 装置のグローバル IP（例: 203.0.113.1） |
| デバイス | 空欄（任意） |

### 4.2 Virtual Private Gateway の作成

1. **VPC** → **仮想プライベートゲートウェイ** → **仮想プライベートゲートウェイを作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-vgw` |
| ASN | Amazon デフォルト ASN |

2. 作成後、**アクション** → **VPC にアタッチ** → `testcasedb-vpc` を選択

### 4.3 Site-to-Site VPN 接続の作成

1. **VPC** → **Site-to-Site VPN 接続** → **VPN 接続を作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-vpn` |
| ターゲットゲートウェイタイプ | 仮想プライベートゲートウェイ |
| 仮想プライベートゲートウェイ | `testcasedb-vgw` |
| カスタマーゲートウェイ | `testcasedb-cgw` |
| ルーティングオプション | 静的 |
| 静的 IP プレフィックス | 客先ネットワーク CIDR（例: 10.100.0.0/16） |

### 4.4 VPN 設定のダウンロード

1. 作成した VPN 接続を選択
2. **設定をダウンロード** をクリック
3. 客先の VPN 装置に合わせたベンダーを選択
4. ダウンロードした設定ファイルを **客先ネットワーク担当者に共有**

> **重要**: VPN 設定には Pre-Shared Key（事前共有キー）が含まれます。セキュアな方法で共有してください。

### 4.5 ルートテーブルの更新

1. **VPC** → **ルートテーブル** → プライベートサブネット用のルートテーブルを選択
2. **ルート** タブ → **ルートを編集** → **ルートを追加**

| 送信先 | ターゲット |
|--------|-----------|
| 10.100.0.0/16（客先 CIDR） | `testcasedb-vgw` |

### 4.6 VPN 接続の確認

VPN が確立されると、以下のように表示されます：

- **トンネル 1**: UP
- **トンネル 2**: UP

> **注意**: 両方のトンネルが UP になるまで、客先側の設定が完了するのを待ってください。

### 4.7 Direct Connect を使用する場合（オプション）

高帯域・低レイテンシが必要な場合は Direct Connect を検討してください。

| 項目 | Site-to-Site VPN | Direct Connect |
|------|-----------------|----------------|
| 帯域幅 | 最大 1.25 Gbps | 1 Gbps / 10 Gbps / 100 Gbps |
| レイテンシ | インターネット経由 | 専用線（低レイテンシ） |
| 月額コスト | ~$36 + データ転送 | $200〜 + ポート料 |
| 導入期間 | 即日 | 数週間〜数ヶ月 |

---

## 5. セキュリティグループの作成

### 5.1 ALB 用セキュリティグループ（IP 制限付き）

1. **VPC** → **セキュリティグループ** → **セキュリティグループを作成**

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `testcasedb-alb-sg` |
| 説明 | Security group for Internal ALB with IP restriction |
| VPC | `testcasedb-vpc` |

**インバウンドルール（IP 制限）:**

| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| HTTPS | 443 | 10.100.10.0/24 | 管理者セグメント |
| HTTPS | 443 | 10.100.20.0/24 | 一般ユーザーセグメント |
| HTTPS | 443 | 10.100.30.0/24 | 開発者セグメント |

> **重要**: 許可する IP レンジは必要最小限に設定してください。

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 5.2 ECS 用セキュリティグループ

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

### 5.3 RDS 用セキュリティグループ

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

> **注意**: RDS への直接アクセスは ECS と Batch からのみに制限します。管理用アクセスが必要な場合は、踏み台サーバー（Bastion）を検討してください。

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 5.4 Batch 用セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ名 | `testcasedb-batch-sg` |
| 説明 | Security group for AWS Batch |
| VPC | `testcasedb-vpc` |

**アウトバウンドルール:**

| タイプ | ポート | 送信先 | 説明 |
|--------|--------|--------|------|
| すべてのトラフィック | すべて | 0.0.0.0/0 | Allow all outbound |

### 5.5 セキュリティグループ設計のポイント

```
┌─────────────────────────────────────────────────────────────┐
│                    アクセスフロー                            │
│                                                             │
│   社内PC (10.100.x.x)                                       │
│       │                                                     │
│       │ HTTPS:443 (IP制限)                                  │
│       ▼                                                     │
│   ┌─────────────────────┐                                   │
│   │ ALB (testcasedb-alb-sg)                                │
│   │ ・10.100.10.0/24 許可                                   │
│   │ ・10.100.20.0/24 許可                                   │
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

## 6. RDS PostgreSQL の作成

### 6.1 サブネットグループの作成

1. **RDS** → **サブネットグループ** → **DB サブネットグループを作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-db-subnet-group` |
| 説明 | Subnet group for testcasedb |
| VPC | `testcasedb-vpc` |
| アベイラビリティゾーン | ap-northeast-1a, ap-northeast-1c |
| サブネット | プライベートサブネット2つを選択 |

### 6.2 RDS インスタンスの作成

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

> **重要**: 社内システムでは、暗号化と削除保護を必ず有効にしてください。

---

## 7. S3 バケットの作成

### 7.1 メインバケットの作成

1. **S3** → **バケットを作成**

| 項目 | 値 |
|------|-----|
| バケット名 | `testcasedb-files-{アカウントID}` |
| AWS リージョン | ap-northeast-1 |
| オブジェクト所有者 | ACL 無効 |
| ブロックパブリックアクセス | **すべてブロック（必須）** |
| バケットのバージョニング | 有効 |
| デフォルトの暗号化 | SSE-S3 または SSE-KMS |

### 7.2 フォルダ構造の作成

```
testcasedb-files-{アカウントID}/
├── control-specs/        # 制御仕様書
├── dataflows/            # データフロー
├── evidences/            # エビデンス
├── imports/              # インポートファイル
└── capl-files/           # CAPLファイル
```

### 7.3 VPC エンドポイント経由のアクセス（推奨）

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

## 8. Secrets Manager の設定

### 8.1 JWT シークレットの作成

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

### 8.2 VPC エンドポイント経由のアクセス（推奨）

Secrets Manager へのアクセスもプライベートに：

1. **VPC** → **エンドポイント** → **エンドポイントを作成**

| 項目 | 値 |
|------|-----|
| 名前 | `testcasedb-secretsmanager-endpoint` |
| サービス | com.amazonaws.ap-northeast-1.secretsmanager |
| VPC | testcasedb-vpc |
| サブネット | プライベートサブネット |
| セキュリティグループ | 新規作成（HTTPS:443 を ECS-SG から許可） |

---

## 9. IAM ロールの作成

### 9.1 ECS タスク実行ロール

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

### 9.2 ECS タスクロール

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

### 9.3 AWS Batch 用ロール

（前述の手順と同様）

---

## 10. ECR リポジトリの作成

### 10.1 アプリケーション用リポジトリ

1. **ECR** → **リポジトリを作成**

| 項目 | 値 |
|------|-----|
| リポジトリタイプ | プライベート |
| リポジトリ名 | `testcasedb/app` |
| イメージタグの変更可能性 | Immutable（推奨） |
| 暗号化設定 | AES-256 |
| イメージスキャン | プッシュ時にスキャン |

### 10.2 VPC エンドポイント経由のアクセス（推奨）

ECR へのアクセスもプライベートに：

```bash
# 以下の2つのエンドポイントが必要
# 1. ECR API エンドポイント
com.amazonaws.ap-northeast-1.ecr.api

# 2. ECR Docker エンドポイント
com.amazonaws.ap-northeast-1.ecr.dkr
```

---

## 11. ECS クラスターの作成

### 11.1 クラスターの作成

1. **ECS** → **クラスター** → **クラスターの作成**

| 項目 | 値 |
|------|-----|
| クラスター名 | `testcasedb-cluster` |
| インフラストラクチャ | AWS Fargate |
| Container Insights | オン |

### 11.2 タスク定義の作成

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
| NEXTAUTH_URL | Value | https://testcasedb.internal.example.co.jp |
| DATABASE_URL | ValueFrom | (Secrets Manager ARN) |
| JWT_SECRET | ValueFrom | (Secrets Manager ARN) |
| AWS_S3_BUCKET | Value | testcasedb-files-{アカウントID} |

---

## 12. ACM Private CA の設定

### 12.1 Private CA の作成

社内システム用のプライベート証明書を発行するため、ACM Private CA を使用します。

1. **Certificate Manager** → **プライベート CA** → **プライベート CA を作成**

| 項目 | 値 |
|------|-----|
| CA タイプ | ルート |
| キーアルゴリズム | RSA 2048 |
| サブジェクト名 | |
| - 組織 (O) | Example Company |
| - 組織単位 (OU) | IT Department |
| - 国 (C) | JP |
| - 都道府県 (ST) | Tokyo |
| - 市区町村 (L) | Chiyoda-ku |
| - 共通名 (CN) | Example Internal CA |
| CA 名 | `testcasedb-private-ca` |

2. 作成後、**アクション** → **CA 証明書をインストール**

### 12.2 プライベート証明書の発行

1. **Certificate Manager** → **証明書をリクエスト**

| 項目 | 値 |
|------|-----|
| 証明書タイプ | プライベート証明書をリクエスト |
| 認証機関 | testcasedb-private-ca |
| ドメイン名 | testcasedb.internal.example.co.jp |

### 12.3 クライアント PC への CA 証明書配布

> **重要**: プライベート CA で発行した証明書を使用するには、クライアント PC にルート CA 証明書をインストールする必要があります。

**配布方法:**

1. **Active Directory グループポリシー**（推奨）
   - グループポリシーで全社 PC に自動配布

2. **手動インストール**
   - ルート CA 証明書をダウンロード
   - 各 PC の「信頼されたルート証明機関」にインストール

**ルート CA 証明書のエクスポート:**

```bash
aws acm-pca get-certificate-authority-certificate \
  --certificate-authority-arn arn:aws:acm-pca:ap-northeast-1:{アカウントID}:certificate-authority/{CA-ID} \
  --output text > root-ca.pem
```

---

## 13. Internal ALB の作成

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

### 13.2 Internal ALB の作成

1. **EC2** → **ロードバランサー** → **ロードバランサーの作成** → **Application Load Balancer**

| 項目 | 値 |
|------|-----|
| ロードバランサー名 | `testcasedb-alb` |
| スキーム | **内部（Internal）** ← 重要 |
| IP アドレスタイプ | IPv4 |

#### ネットワークマッピング

| 項目 | 値 |
|------|-----|
| VPC | testcasedb-vpc |
| マッピング | **プライベートサブネット**（2つ選択） ← 重要 |

#### セキュリティグループ

| 項目 | 値 |
|------|-----|
| セキュリティグループ | testcasedb-alb-sg |

#### リスナーとルーティング

**HTTPS リスナー (443):**

| 項目 | 値 |
|------|-----|
| プロトコル | HTTPS |
| ポート | 443 |
| デフォルトアクション | 転送先 → testcasedb-tg |
| セキュリティポリシー | ELBSecurityPolicy-TLS13-1-2-2021-06 |
| SSL/TLS 証明書 | ACM Private CA で発行した証明書 |

### 13.3 Route 53 または社内 DNS への登録

ALB の DNS 名を社内 DNS に登録します：

```
testcasedb.internal.example.co.jp → internal-testcasedb-alb-xxxxx.ap-northeast-1.elb.amazonaws.com
```

**Route 53 Private Hosted Zone を使用する場合:**

1. **Route 53** → **ホストゾーン** → **ホストゾーンを作成**

| 項目 | 値 |
|------|-----|
| ドメイン名 | internal.example.co.jp |
| タイプ | プライベートホストゾーン |
| VPC | testcasedb-vpc |

2. レコードを作成（A レコード、エイリアス → ALB）

---

## 14. IP 制限の設定

### 14.1 セキュリティグループでの IP 制限（第1層）

ALB のセキュリティグループで IP 制限を設定します（セクション 5.1 参照）。

**設定例:**

```
インバウンドルール:
┌─────────┬──────┬──────────────────┬─────────────────┐
│ タイプ   │ ポート│ ソース            │ 説明             │
├─────────┼──────┼──────────────────┼─────────────────┤
│ HTTPS   │ 443  │ 10.100.10.0/24   │ 管理者セグメント   │
│ HTTPS   │ 443  │ 10.100.20.0/24   │ 一般ユーザー       │
│ HTTPS   │ 443  │ 10.100.30.0/24   │ 開発チーム        │
│ HTTPS   │ 443  │ 10.100.100.5/32  │ 特定の管理サーバー │
└─────────┴──────┴──────────────────┴─────────────────┘
```

### 14.2 WAF での IP 制限（第2層・推奨）

多層防御として、WAF でも IP 制限を設定することを推奨します。

#### IP セットの作成

1. **WAF & Shield** → **IP sets** → **Create IP set**

| 項目 | 値 |
|------|-----|
| IP set name | `testcasedb-allowed-ips` |
| Region | Asia Pacific (Tokyo) |
| IP version | IPv4 |
| IP addresses | |

```
10.100.10.0/24
10.100.20.0/24
10.100.30.0/24
10.100.100.5/32
```

#### Web ACL の作成

1. **WAF & Shield** → **Web ACLs** → **Create web ACL**

| 項目 | 値 |
|------|-----|
| Name | `testcasedb-waf` |
| Resource type | Regional resources |
| Region | Asia Pacific (Tokyo) |
| Associated resources | testcasedb-alb |

**ルール 1: IP 許可ルール**

| 項目 | 値 |
|------|-----|
| Rule type | IP set |
| Name | `allow-internal-ips` |
| IP set | testcasedb-allowed-ips |
| IP address to use | Source IP address |
| Action | Allow |

**ルール 2: デフォルトアクション**

| 項目 | 値 |
|------|-----|
| Default action | **Block** |

> **重要**: デフォルトアクションを Block に設定することで、許可リスト以外の IP からのアクセスをすべてブロックします。

### 14.3 IP 制限の設計パターン

```
┌─────────────────────────────────────────────────────────────┐
│                    多層 IP 制限                              │
│                                                             │
│   社内PC (10.100.10.5)                                      │
│       │                                                     │
│       │ ① VPN 経由でアクセス                                │
│       ▼                                                     │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ AWS VPC                                              │   │
│   │                                                      │   │
│   │   ┌─────────────────────────────────────────────┐   │   │
│   │   │ WAF (第2層)                                  │   │   │
│   │   │ ② IP セット (10.100.10.0/24) で許可チェック  │   │   │
│   │   │    → 許可されていない場合: Block            │   │   │
│   │   └──────────────────────┬──────────────────────┘   │   │
│   │                          │                          │   │
│   │   ┌──────────────────────▼──────────────────────┐   │   │
│   │   │ ALB Security Group (第1層)                  │   │   │
│   │   │ ③ ソース IP (10.100.10.0/24) で許可チェック │   │   │
│   │   │    → 許可されていない場合: Drop             │   │   │
│   │   └──────────────────────┬──────────────────────┘   │   │
│   │                          │                          │   │
│   │                          ▼                          │   │
│   │   ┌─────────────────────────────────────────────┐   │   │
│   │   │ Internal ALB                                │   │   │
│   │   │ ④ アプリケーションにリクエスト転送          │   │   │
│   │   └─────────────────────────────────────────────┘   │   │
│   └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 14.4 IP 制限の運用上の注意点

> **注意事項:**

1. **IP 範囲の変更時は事前に更新**
   - 新しい拠点や部署が追加される場合、事前に IP を追加してください
   - 変更後、ユーザーに影響が出ないか確認

2. **緊急時のアクセス手段を確保**
   - 管理者用の緊急アクセス IP を1つ以上確保
   - VPN 障害時の代替アクセス手段を検討

3. **ログの監視**
   - WAF でブロックされたリクエストを CloudWatch で監視
   - 正当なユーザーがブロックされていないか定期確認

4. **定期的な見直し**
   - 不要になった IP レンジは削除
   - 最小権限の原則に従って管理

---

## 15. WAF の設定（任意）

### 15.1 社内システムでの WAF の必要性

| 観点 | 評価 |
|------|------|
| 外部攻撃 | VPN 経由のみなので低リスク |
| 内部脅威 | 従業員による不正アクセスの可能性あり |
| コンプライアンス | セキュリティポリシーで要求される場合あり |
| **推奨** | **内部脅威対策として設定を推奨** |

### 15.2 推奨ルール

| ルール | 目的 | 優先度 |
|--------|------|--------|
| IP 許可ルール | アクセス元制限 | 必須 |
| レート制限 | DoS 対策 | 推奨 |
| SQL インジェクション | DB 保護 | 推奨 |
| XSS 対策 | ブラウザ保護 | 任意 |

---

## 16. AWS Batch の設定

（前述の手順と同様）

---

## 17. CloudWatch の設定

### 17.1 ロググループの作成

| ロググループ名 | 保持期間 | 暗号化 |
|---------------|---------|--------|
| /ecs/testcasedb | 90 日 | 有効（推奨） |
| /aws/batch/testcasedb | 90 日 | 有効 |

### 17.2 重要なアラーム

| アラーム | メトリクス | しきい値 | 通知先 |
|---------|-----------|---------|--------|
| ECS CPU 高負荷 | CPUUtilization | > 80% | SNS |
| RDS CPU 高負荷 | CPUUtilization | > 80% | SNS |
| RDS 接続数上限 | DatabaseConnections | > 80% of max | SNS |
| ALB 5xx エラー | HTTPCode_ELB_5XX_Count | > 10/5min | SNS |
| WAF ブロック急増 | BlockedRequests | > 100/5min | SNS |

---

## 18. アプリケーションのデプロイ

### 18.1 Dockerfile

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

### 18.2 ヘルスチェックエンドポイント

`app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'healthy' }, { status: 200 });
}
```

### 18.3 デプロイスクリプト

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

## 19. 動作確認

### 19.1 VPN 接続確認

```bash
# 客先 PC から AWS VPC 内のリソースに ping
ping 10.0.128.x  # プライベートサブネット内の IP
```

### 19.2 アプリケーション確認

```bash
# 社内 PC から
curl -k https://testcasedb.internal.example.co.jp/api/health
# 期待結果: {"status":"healthy"}
```

> **注意**: `-k` オプションは証明書検証をスキップします。本番運用前に CA 証明書を PC にインストールしてください。

### 19.3 IP 制限確認

```bash
# 許可されていない IP からアクセスを試みる
# → 403 Forbidden または接続拒否になることを確認
```

---

## 20. セキュリティチェックリスト

### 20.1 ネットワーク

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| VPN | IPsec VPN が確立されているか | ☐ |
| ALB | Internal（内部）タイプになっているか | ☐ |
| ALB | プライベートサブネットに配置されているか | ☐ |
| SG | ALB に IP 制限が設定されているか | ☐ |
| SG | RDS への直接アクセスが制限されているか | ☐ |

### 20.2 データ保護

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| RDS | 暗号化が有効になっているか | ☐ |
| RDS | パブリックアクセスが無効になっているか | ☐ |
| S3 | パブリックアクセスがブロックされているか | ☐ |
| S3 | 暗号化が有効になっているか | ☐ |
| Secrets | シークレットが Secrets Manager に保存されているか | ☐ |

### 20.3 アクセス制御

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| IP 制限 | 許可 IP が必要最小限か | ☐ |
| IAM | 最小権限の原則に従っているか | ☐ |
| WAF | IP 許可ルールが設定されているか | ☐ |
| 証明書 | Private CA 証明書が使用されているか | ☐ |

### 20.4 監視・ログ

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| CloudWatch | ログが出力されているか | ☐ |
| CloudWatch | 重要なアラームが設定されているか | ☐ |
| WAF | ブロックログが記録されているか | ☐ |

### 20.5 運用

| 項目 | 確認内容 | 状態 |
|------|---------|------|
| バックアップ | RDS の自動バックアップが有効か | ☐ |
| 削除保護 | RDS の削除保護が有効か | ☐ |
| バージョニング | S3 のバージョニングが有効か | ☐ |

---

## 21. 注意事項・トラブルシューティング

### 21.1 よくある問題と対処法

#### VPN が接続できない

| 確認項目 | 対処法 |
|---------|--------|
| Customer Gateway IP | 客先 VPN 装置の正しいグローバル IP か確認 |
| Pre-Shared Key | 設定ファイルの PSK が一致しているか確認 |
| ルートテーブル | VGW へのルートが設定されているか確認 |
| セキュリティグループ | 必要なポート（UDP 500, 4500）が開いているか |

#### ALB にアクセスできない

| 確認項目 | 対処法 |
|---------|--------|
| VPN 接続 | VPN トンネルが UP か確認 |
| セキュリティグループ | 接続元 IP が許可されているか確認 |
| WAF | IP がブロックされていないか CloudWatch ログを確認 |
| DNS | 名前解決ができているか確認 |

#### 証明書エラーが出る

| 確認項目 | 対処法 |
|---------|--------|
| CA 証明書 | クライアント PC にルート CA がインストールされているか |
| ドメイン名 | 証明書のドメインとアクセス先が一致しているか |
| 有効期限 | 証明書が期限切れになっていないか |

### 21.2 運用上の重要な注意事項

> **セキュリティ関連:**

1. **IP レンジの変更は慎重に**
   - 新規追加時は事前テスト
   - 削除時は影響範囲を確認

2. **VPN の冗長化を検討**
   - 単一障害点にならないよう、2 本目の VPN 接続を検討
   - Direct Connect との併用も選択肢

3. **定期的なセキュリティレビュー**
   - 四半期ごとに IP 許可リストを見直し
   - 不要になったアクセス権限は削除

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

### 21.3 障害時の連絡先

| 障害種別 | 連絡先 | 対応時間 |
|---------|--------|---------|
| AWS 障害 | AWS サポート | 24/365 |
| VPN 障害（客先側）| 客先ネットワーク担当 | 平日 9:00-18:00 |
| アプリケーション障害 | 開発チーム | 平日 9:00-18:00 |

---

## 付録

### A. コスト見積もり（月額概算）

| サービス | 構成 | 概算月額 (USD) |
|---------|------|---------------|
| ECS Fargate | 1 vCPU, 2GB × 2 タスク | ~$60 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ | ~$150 |
| Internal ALB | 1 ALB | ~$25 |
| NAT Gateway | 1 NAT + データ転送 | ~$45 |
| Site-to-Site VPN | 1 接続 | ~$36 |
| S3 | 100GB | ~$5 |
| ACM Private CA | 1 CA | ~$400 |
| WAF | 1 Web ACL + ルール | ~$10 |
| CloudWatch | ログ + メトリクス | ~$10 |
| **合計** | | **~$740** |

> **注意**: ACM Private CA は月額 $400 と高額です。自己署名証明書や社内 CA を使用する場合は不要です。

### B. 代替構成（コスト削減版）

| 変更点 | 削減額 |
|--------|--------|
| ACM Private CA → 自己署名証明書 | -$400 |
| Multi-AZ → Single-AZ（開発環境） | -$75 |
| **削減後合計** | **~$265** |

### C. 参考リンク

- [AWS Site-to-Site VPN ガイド](https://docs.aws.amazon.com/vpn/latest/s2svpn/)
- [AWS Private CA ガイド](https://docs.aws.amazon.com/privateca/)
- [WAF の使用開始](https://docs.aws.amazon.com/waf/)
- [ECS Fargate ベストプラクティス](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
