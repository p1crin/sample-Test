# CloudShellからRDSに接続する手順

## 概要

RDSはプライベートサブネットに配置されているため、直接アクセスできません。
AWS CloudShellをVPC内で起動することで、プライベートサブネットのRDSに接続できます。

---

## 事前準備：CloudShell用セキュリティグループの作成

初回のみ実施します。

### 1. CloudShell用SGを作成

AWSマネジメントコンソールの通常のCloudShell、またはローカルから実行します。

```bash
export VPC_ID=<YOUR_VPC_ID>       # 例: vpc-xxxxxxxxxxxxxxxxx
export RDS_SG_ID=<YOUR_RDS_SG_ID> # dev-rds-sg のSG ID
export REGION=ap-northeast-1

# CloudShell用SGを作成
aws ec2 create-security-group \
  --group-name dev-cloudshell-sg \
  --description "Security group for CloudShell VPC access" \
  --vpc-id ${VPC_ID} \
  --region ${REGION}

# 作成したSGのIDを取得
CLOUDSHELL_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=dev-cloudshell-sg" "Name=vpc-id,Values=${VPC_ID}" \
  --query 'SecurityGroups[0].GroupId' \
  --output text \
  --region ${REGION})

echo "CloudShell SG ID: ${CLOUDSHELL_SG_ID}"
```

### 2. RDSセキュリティグループにインバウンドルールを追加

```bash
aws ec2 authorize-security-group-ingress \
  --group-id ${RDS_SG_ID} \
  --protocol tcp \
  --port 5432 \
  --source-group ${CLOUDSHELL_SG_ID} \
  --region ${REGION}
```

AWSコンソールから行う場合：

1. **VPC** → **セキュリティグループ** → `dev-rds-sg` を選択
2. **インバウンドルールを編集** → **ルールを追加**

| タイプ | ポート | ソース | 説明 |
|--------|--------|--------|------|
| PostgreSQL | 5432 | `dev-cloudshell-sg` | CloudShellからのアクセス |

3. **ルールを保存** をクリック

---

## 接続手順

### Step 1: VPC対応のCloudShellを起動

1. AWSマネジメントコンソール右上の **CloudShell** アイコンをクリック
2. **アクション** → **VPCに作成** をクリック
3. 以下を設定して **作成** をクリック

| 項目 | 設定値 |
|------|--------|
| VPC | `dev-vpc` |
| サブネット | プライベートサブネット（例: `dev-subnet-private1`） |
| セキュリティグループ | `dev-cloudshell-sg` |

> VPC CloudShellは通常のCloudShellとは別ウィンドウで起動します

### Step 2: psqlをインストール

VPC CloudShellで実行します。

```bash
sudo dnf install -y postgresql15
```

### Step 3: RDSに接続

```bash
psql \
  -h <RDS_ENDPOINT> \
  -U postgres \
  -d <YOUR_DB_NAME>
```

| 項目 | 確認場所 |
|------|---------|
| `<RDS_ENDPOINT>` | RDS → データベース → 対象DB → **エンドポイント** |
| `<YOUR_DB_NAME>` | 例: `prooflink_dev` |

接続に成功すると以下のように表示されます：

```
psql (15.x)
Type "help" for help.

prooflink_dev=#
```

---

## テーブルの作成（Prismaマイグレーション）

手動でSQLを書くよりもPrismaマイグレーションを使う方が確実です。

### Step 1: 必要なツールをインストール

VPC CloudShellで実行します。

```bash
# Node.jsのバージョン確認（インストール済みの場合）
node -v

# 未インストールの場合
sudo dnf install -y nodejs npm
```

### Step 2: 作業ディレクトリを作成

```bash
mkdir ~/prisma-migration && cd ~/prisma-migration
npm init -y
npm install prisma
```

### Step 3: prisma/schema.prismaをコピー

```bash
mkdir prisma
```

リポジトリの `prisma/schema.prisma` の内容をCloudShellに貼り付けます。

```bash
cat > prisma/schema.prisma << 'EOF'
# ここにprisma/schema.prismaの内容を貼り付け
EOF
```

### Step 4: DATABASE_URLを設定

```bash
export DATABASE_URL="postgresql://postgres:<PASSWORD>@<RDS_ENDPOINT>:5432/<YOUR_DB_NAME>"
```

### Step 5: テーブルを作成

**方法A: スキーマを直接適用（マイグレーション管理なし）**

```bash
npx prisma db push
```

**方法B: マイグレーションファイルを作成して適用（履歴管理あり）**

```bash
npx prisma migrate dev --name init
```

成功すると以下のように表示されます：

```
Your database is now in sync with your schema.
```

---

## psqlで直接SQL実行する場合

Prismaを使わず、直接SQLでテーブル操作をしたい場合の基本コマンドです。

```sql
-- テーブル一覧を確認
\dt

-- テーブルの定義を確認
\d mt_users

-- データを確認
SELECT * FROM mt_users LIMIT 10;

-- 接続を切断
\q
```

---

## トラブルシューティング

### 接続タイムアウトする場合

```
psql: error: connection to server failed: Connection timed out
```

**確認ポイント:**

1. CloudShellの起動時に正しいVPC・サブネット・SGを選択したか
2. RDSのセキュリティグループに `dev-cloudshell-sg` からのポート5432が許可されているか
3. CloudShellとRDSが同じVPC内にあるか

### 認証エラーが出る場合

```
psql: error: connection to server failed: FATAL: password authentication failed
```

**確認ポイント:**

- パスワードが正しいか（Secrets Managerで確認）

```bash
aws secretsmanager get-secret-value \
  --secret-id <YOUR_SECRET_NAME> \
  --region ap-northeast-1 \
  --query 'SecretString' \
  --output text
```

---

## 作業後のクリーンアップ

VPC CloudShellは使用後に削除してコストを節約します。

1. CloudShellウィンドウ右上の **アクション** → **削除** をクリック

> セキュリティグループ `dev-cloudshell-sg` は次回も使うため残しておいて問題ありません

---

**作成日**: 2026-02-10
**対象環境**: 開発環境（dev）
