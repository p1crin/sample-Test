# PROD環境構築・公開手順

## 概要

本番環境（PROD）の構築からお客様へのURL共有、および独自ドメイン取得後のHTTPS化までの手順を説明します。

### フェーズ構成

```
フェーズ1（今すぐ実施）
  PROD環境を構築
  └─ ALBのDNS名をお客様に渡す（HTTP）

フェーズ2（独自ドメイン取得後）
  ACM証明書を発行
  └─ ALBにHTTPSリスナーを追加
  └─ Route 53でDNS設定
  └─ HTTPSにリダイレクト
```

---

## フェーズ1: PROD環境の構築

### DEV環境との主な違い

| 項目 | DEV | PROD |
|------|-----|------|
| リソース名プレフィックス | `dev-` | `prod-` |
| RDSインスタンスクラス | db.t4g.micro | db.t4g.medium |
| RDS Multi-AZ | なし | あり |
| ECSタスク数 | 1 | 2 |
| ECS CPU/メモリ | 0.5vCPU / 1GB | 1vCPU / 2GB |
| AZ数 | 1 | 2 |
| NAT Gateway | 1台 | 2台（AZごとに1台） |

### 構築手順

基本的な構築手順は [AWS環境構築ガイド](./AWS_SETUP_GUIDE.md) と同じです。
リソース名を `dev-` → `prod-` に読み替えて実施してください。

チェックリスト（実施順）：

- [ ] VPCとネットワーク（AZ数: 2、NAT Gateway: 2台）
- [ ] VPCエンドポイント（ECR API、ECR DKR、S3、CloudWatch Logs、Secrets Manager）
- [ ] セキュリティグループ（ALB用、ECS用、RDS用、VPCエンドポイント用）
- [ ] Secrets Manager（RDS認証情報）
- [ ] RDS PostgreSQL（Multi-AZ、db.t4g.medium）
- [ ] S3バケット
- [ ] IAMロール（タスク実行ロール、タスクロール）
- [ ] ECRリポジトリ（`prod-app`）
- [ ] ECSクラスター（`prod-cluster`）
- [ ] CloudWatch Logsグループ
- [ ] タスク定義（1vCPU、2GB）
- [ ] ターゲットグループ（`prod-tg`、ヘルスチェック: `/api/health`）
- [ ] ALB（`prod-alb`）
- [ ] ECSサービス（タスク数: 2）

### ALBのリスナー設定（フェーズ1）

フェーズ1ではHTTPのみ設定します。

| プロトコル | ポート | アクション |
|-----------|--------|-----------|
| HTTP | 80 | `prod-tg` に転送 |

### タスク定義の環境変数

| キー | 値 |
|------|-----|
| `NODE_ENV` | `production` |
| `NEXTAUTH_URL` | `http://<ALB_DNS_NAME>` ※フェーズ1はHTTP |
| `AWS_REGION` | `ap-northeast-1` |
| `AWS_S3_BUCKET_NAME` | `prod-files-xxxxx` |

> **`<ALB_DNS_NAME>`の確認方法**: EC2 → ロードバランサー → `prod-alb` → **DNS名** をコピー
>
> 例: `prod-alb-123456789.ap-northeast-1.elb.amazonaws.com`

### PROD環境へのデプロイ

```bash
export ENV=prod
export AWS_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPOSITORY=prod-app
export ECS_CLUSTER=prod-cluster
export ECS_SERVICE=prod-service
export ECR_URI=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}
export IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

# ECRにログイン
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# ビルド・プッシュ
docker build --platform linux/amd64 -t ${ECR_REPOSITORY}:${IMAGE_TAG} .
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:latest
docker push ${ECR_URI}:${IMAGE_TAG}
docker push ${ECR_URI}:latest

# ECSサービスを更新
aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --force-new-deployment \
  --region ${AWS_REGION}
```

### お客様への共有URL（フェーズ1）

ALBのDNS名を確認して共有します。

```bash
aws elbv2 describe-load-balancers \
  --names prod-alb \
  --region ap-northeast-1 \
  --query 'LoadBalancers[0].DNSName' \
  --output text
```

共有するURL：

```
http://<ALB_DNS_NAME>
例: http://prod-alb-123456789.ap-northeast-1.elb.amazonaws.com
```

> **注意**: フェーズ1ではHTTPのため、ブラウザに「安全でない接続」と表示される場合があります。フェーズ2でHTTPS化することをお客様に説明してください。

---

## フェーズ2: 独自ドメイン + HTTPS化

お客様から独自ドメインが提供されたら実施します。

### 前提条件

- お客様から独自ドメインを共有してもらう（例: `your-app.example.com`）
- ドメインのDNS管理権限（または設定をお客様に依頼）

### Step 1: ACMでSSL証明書を取得

> **重要**: 証明書は必ず **東京リージョン（ap-northeast-1）** で作成してください

1. **Certificate Manager** → **証明書をリクエスト**
2. **パブリック証明書をリクエスト** → **次へ**

| 項目 | 値 |
|------|-----|
| ドメイン名 | `your-app.example.com`（お客様のドメイン） |
| 検証方法 | **DNS検証**（推奨） |

3. **リクエスト** をクリック
4. 作成された証明書をクリックして **CNAMEレコードの情報** を確認

```
名前: _xxxxxxxxxxxx.your-app.example.com
値:   _xxxxxxxxxxxx.acm-validations.aws
```

5. このCNAMEレコードをお客様のDNSに登録してもらう（またはRoute 53で設定）
6. ステータスが「**発行済み**」になるまで待つ（5〜30分）

### Step 2: ALBにHTTPSリスナーを追加

1. **EC2** → **ロードバランサー** → `prod-alb` を選択
2. **リスナーとルール** タブ → **リスナーを追加**

| 項目 | 値 |
|------|-----|
| プロトコル | **HTTPS** |
| ポート | **443** |
| デフォルトアクション | **転送** → `prod-tg` |
| SSL証明書 | Step 1で作成した証明書を選択 |
| セキュリティポリシー | `ELBSecurityPolicy-TLS13-1-2-2021-06`（推奨） |

3. **保存** をクリック

### Step 3: HTTPをHTTPSにリダイレクト設定

1. **リスナーとルール** タブ → **HTTP:80** リスナーを選択
2. **ルールを管理** → デフォルトルールを編集
3. アクションを **URLにリダイレクト** に変更

| 項目 | 値 |
|------|-----|
| プロトコル | HTTPS |
| ポート | 443 |
| ステータスコード | **301 - 恒久的なリダイレクト** |

4. **変更を保存** をクリック

### Step 4: Route 53でDNSを設定

#### お客様がRoute 53を使っている場合

1. **Route 53** → **ホストゾーン** → お客様のドメインを選択
2. **レコードを作成**

| 項目 | 値 |
|------|-----|
| レコード名 | `your-app`（サブドメイン部分） |
| レコードタイプ | **A** |
| エイリアス | **オン** |
| トラフィックのルーティング先 | **Application Load Balancerへのエイリアス** |
| リージョン | アジアパシフィック（東京） |
| ロードバランサー | `prod-alb` を選択 |

3. **レコードを作成** をクリック

#### お客様が他のDNSサービスを使っている場合

お客様のDNS管理画面でCNAMEレコードを追加してもらいます：

```
タイプ: CNAME
名前:   your-app.example.com
値:     prod-alb-123456789.ap-northeast-1.elb.amazonaws.com
```

### Step 5: タスク定義のNEXTAUTH_URLを更新

URLがHTTPSに変わるため、タスク定義を更新します。

1. **ECS** → **タスク定義** → タスク定義を選択
2. **新しいリビジョンの作成**
3. 環境変数を更新：

| キー | 変更前 | 変更後 |
|------|--------|--------|
| `NEXTAUTH_URL` | `http://<ALB_DNS_NAME>` | `https://your-app.example.com` |

4. **作成** をクリック

5. ECSサービスを更新：

```bash
aws ecs update-service \
  --cluster prod-cluster \
  --service prod-service \
  --force-new-deployment \
  --region ap-northeast-1
```

### Step 6: HTTPS接続の確認

```bash
# HTTPS接続確認
curl https://your-app.example.com/api/health

# HTTPがHTTPSにリダイレクトされるか確認
curl -I http://your-app.example.com
# Location: https://your-app.example.com が返ってくればOK
```

---

## フェーズ2完了後のチェックリスト

- [ ] ACM証明書のステータスが「発行済み」
- [ ] ALBにHTTPS:443リスナーが追加されている
- [ ] HTTP:80がHTTPSにリダイレクトされる
- [ ] Route 53またはお客様のDNSにAレコード/CNAMEが設定されている
- [ ] `https://your-app.example.com` でアクセスできる
- [ ] ブラウザで鍵マークが表示される
- [ ] `NEXTAUTH_URL` がHTTPSのURLに更新されている
- [ ] ログイン・各画面が正常に動作する

---

## 参考: フェーズ移行時にお客様に伝える内容

### フェーズ1完了時

```
本番環境の準備が整いました。
以下のURLにてアクセスいただけます。

URL: http://prod-alb-123456789.ap-northeast-1.elb.amazonaws.com

※現時点ではHTTP接続のため「安全でない接続」と表示される場合があります。
  独自ドメインのご用意が完了次第、HTTPS化いたします。
```

### フェーズ2移行に必要な情報（お客様への依頼事項）

```
HTTPS化のために以下をご提供ください。

1. 使用するドメイン名（例: your-app.example.com）
2. DNSの管理方法（Route 53 / お客様管理）

Route 53でない場合、DNS管理画面で以下のレコードを設定いただく必要があります。
  タイプ: CNAME
  名前:   （ドメイン名）
  値:     （ALBのDNS名）

また、SSL証明書発行のためにCNAMEレコードを1件追加いただく必要があります。
詳細はドメイン確定後にご連絡いたします。
```

---

**作成日**: 2026-02-10
**対象環境**: 本番環境（prod）
