# セットアップガイド

## 前提条件

- Node.js (v18以上)
- PostgreSQL (v12以上)
- Git

## セットアップ手順

### 1. リポジトリをクローン

```bash
git clone <リポジトリURL>
cd testcasedb
```

### 2. 依存パッケージをインストール

```bash
npm install
```

### 3. 環境変数を設定

`.env.local` ファイルを作成：

```env
DATABASE_URL=postgresql://ユーザー名@localhost:5432/testcase_db
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
```

### 4. PostgreSQL データベースを作成

```bash
psql -U postgres
CREATE DATABASE testcase_db;
\q
```

### 5. マイグレーションを実行

```bash
npx prisma migrate deploy
```

### 6. サンプルデータを投入（オプション）

Prisma Studio でデータベースにデータを投入できます：

```bash
npx prisma studio
```

ブラウザが開きます。`mt_users` テーブルから「Add record」をクリックしてユーザーを追加してください。

### 7. 開発サーバーを起動

```bash
npm run dev
```

アプリケーションは `http://localhost:3000` で利用可能です。

## よく使用するコマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | ビルド |
| `npm run lint` | Lintチェック |
| `npx prisma studio` | データベースGUI |
| `npx prisma migrate dev --name <名前>` | マイグレーション作成 |

## トラブルシューティング

### データベース接続エラー

1. PostgreSQL が起動しているか確認
2. `.env.local` の `DATABASE_URL` が正しいか確認
3. データベースが作成されているか確認：
   ```bash
   psql -U postgres -l
   ```

### Prismaエラー

```bash
# Prismaクライアントを再生成
npx prisma generate
```

## 詳細ドキュメント

- [PRISMA_GUIDE.md](./PRISMA_GUIDE.md) - Prisma ORM操作
- [API_DEVELOPMENT_GUIDE.md](./API_DEVELOPMENT_GUIDE.md) - API開発パターン
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - マイグレーション手順
