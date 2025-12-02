# Prisma ORM 運用ガイド

## 目次
1. [概要](#概要)
2. [セットアップ](#セットアップ)
3. [基本的な使用方法](#基本的な使用方法)
4. [スキーマ管理](#スキーマ管理)
5. [データベース操作](#データベース操作)
6. [マイグレーション](#マイグレーション)
7. [トランザクション](#トランザクション)
8. [トラブルシューティング](#トラブルシューティング)
9. [ベストプラクティス](#ベストプラクティス)

---

## 概要

### Prismaとは

Prisma は、Node.js および TypeScript 向けの次世代型 ORM（Object Relational Mapping）です。本システムでは、PostgreSQL データベースとの連携に Prisma を採用しており、型安全で直感的なデータベース操作を実現しています。

### 本システムでの採用

- **バージョン**: 6.19.0
- **データベース**: PostgreSQL
- **言語**: TypeScript
- **利用範囲**: 全 API エンドポイント

---

## セットアップ

### 環境変数の設定

Prisma を動作させるには、`.env.local` ファイルに以下の環境変数を設定してください。

```env
# データベース接続URL
DATABASE_URL=postgresql://[ユーザー名]@[ホスト名]:[ポート]/[データベース名]

# 例
DATABASE_URL=postgresql://matsuishi_t@localhost:5432/testcase_db
```

**設定項目の説明:**
- `ユーザー名`: PostgreSQL のログインユーザー名
- `ホスト名`: データベースサーバーのホスト名（ローカルの場合は `localhost`）
- `ポート`: PostgreSQL のポート番号（デフォルト: 5432）
- `データベース名`: 接続対象のデータベース名

### 依存パッケージのインストール

既に npm install が実行済みの場合は、この手順をスキップしてください。

```bash
npm install
```

必要なパッケージが自動的にインストールされます。

---

## 基本的な使用方法

### Prisma Client のインポート

API ルートやサービスレイヤーで Prisma を使用する場合は、以下のようにインポートしてください。

```typescript
import { prisma } from '@/app/lib/prisma';
```

### データベース接続の確認

開発環境で Prisma クライアントが正常に動作しているかを確認します。

```bash
npm run dev
```

開発サーバーが起動し、エラーなくコンパイルされることを確認してください。

---

## スキーマ管理

### スキーマファイルの場所

Prisma スキーマは以下の場所に保存されています。

```
prisma/schema.prisma
```

### スキーマの構造

スキーマは以下の3つの主要部分で構成されています。

#### 1. Generator（Prisma Client の生成設定）

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}
```

#### 2. Datasource（データベース接続設定）

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 3. Models（データベーステーブルの定義）

```prisma
model mt_users {
  id           Int            @id @default(autoincrement())
  email        String         @unique @db.VarChar(255)
  user_role    Int            @default(2)
  department   String?        @db.VarChar(255)
  company      String?        @db.VarChar(255)
  password     String         @db.VarChar(255)
  created_at   DateTime       @default(now()) @db.Timestamp(6)
  updated_at   DateTime       @default(now()) @db.Timestamp(6)
  is_deleted   Boolean        @default(false)
  mt_user_tags mt_user_tags[]
}
```

### 型定義の再生成

スキーマを変更した場合、Prisma の型定義を再生成する必要があります。

```bash
npx prisma generate
```

このコマンドにより、`generated/prisma` ディレクトリに型定義ファイルが生成されます。

---

## データベース操作

### 基本的な CRUD 操作

#### Create（データの作成）

```typescript
const newUser = await prisma.mt_users.create({
  data: {
    email: 'user@example.com',
    password: hashedPassword,
    user_role: 2,
    department: 'Engineering',
    company: 'Example Inc.',
  },
});
```

#### Read（データの読み取り）

```typescript
// 単一レコードの取得
const user = await prisma.mt_users.findUnique({
  where: { id: 1 },
});

// 複数レコードの取得
const users = await prisma.mt_users.findMany({
  where: { is_deleted: false },
  orderBy: { created_at: 'desc' },
  take: 10,
  skip: 0,
});
```

#### Update（データの更新）

```typescript
const updatedUser = await prisma.mt_users.update({
  where: { id: 1 },
  data: {
    email: 'newemail@example.com',
    updated_at: new Date(),
  },
});
```

#### Delete（データの削除）

本システムではソフトデリート（論理削除）を採用しています。

```typescript
// ソフトデリート
const deletedUser = await prisma.mt_users.update({
  where: { id: 1 },
  data: { is_deleted: true },
});
```

### フィルター条件の指定

```typescript
// 等値条件
where: { is_deleted: false }

// 部分一致（大文字小文字を区別しない）
where: {
  email: {
    contains: 'example',
    mode: 'insensitive',
  },
}

// IN 条件
where: {
  id: { in: [1, 2, 3] },
}

// 範囲条件
where: {
  created_at: {
    gte: new Date('2025-01-01'),
    lte: new Date('2025-12-31'),
  },
}
```

### リレーションの取得

```typescript
// リレーション情報を含める
const userWithTags = await prisma.mt_users.findUnique({
  where: { id: 1 },
  include: {
    mt_user_tags: {
      include: { mt_tags: true },
    },
  },
});

// 特定の項目のみを取得
const userWithSelected = await prisma.mt_users.findUnique({
  where: { id: 1 },
  select: {
    id: true,
    email: true,
    mt_user_tags: true,
  },
});
```

---

## マイグレーション

### マイグレーションについて

Prisma のマイグレーションは、スキーマの変更をデータベースに反映させるための機構です。

### スキーマ変更時の手順

#### 1. スキーマファイルを編集

`prisma/schema.prisma` を編集して、変更内容を記述します。

#### 2. マイグレーションファイルを生成

```bash
npx prisma migrate dev --name <マイグレーション名>
```

例：
```bash
npx prisma migrate dev --name add_user_department
```

#### 3. 型定義を再生成

マイグレーション実行後、自動的に型定義が再生成されます。

#### 4. 変更内容を確認

マイグレーションファイルが `prisma/migrations/` ディレクトリに作成されているか確認してください。

### マイグレーション履歴の確認

```bash
npx prisma migrate status
```

このコマンドで、実行済みおよび未実行のマイグレーション一覧を確認できます。

### 本番環境でのマイグレーション実行

開発環境以外の環境でスキーマを更新する場合は、以下のコマンドを実行してください。

```bash
npx prisma migrate deploy
```

**注意**: このコマンドはマイグレーションファイルに基づいてスキーマを更新するため、必ず事前に開発環境で動作確認を行ってください。

---

## トランザクション

### トランザクションとは

トランザクションは、複数のデータベース操作を一つの単位として実行し、すべてが成功するか、すべてが失敗するかのいずれかを保証する機構です。

### トランザクションの使用例

```typescript
// 複数の操作をトランザクション内で実行
await prisma.$transaction(async (tx) => {
  // ユーザーを更新
  await tx.mt_users.update({
    where: { id: userId },
    data: { email: newEmail },
  });

  // タグを追加
  await tx.mt_user_tags.create({
    data: {
      user_id: userId,
      tag_id: tagId,
    },
  });

  // 全ての操作が成功した場合のみコミット
});
```

### エラーハンドリング

トランザクション内でエラーが発生した場合、自動的にロールバック（すべての変更を取り消す）されます。

```typescript
try {
  await prisma.$transaction(async (tx) => {
    // 操作1
    // 操作2
    // 操作3のいずれかが失敗すると、すべての変更が取り消される
  });
} catch (error) {
  console.error('トランザクション実行エラー:', error);
  // エラーハンドリング
}
```

---

## トラブルシューティング

### よくあるエラーと対処方法

#### エラー: `PrismaClientConstructorValidationError`

**原因**: Prisma クライアントの初期化時に環境変数が設定されていない場合に発生します。

**対処方法**:
1. `.env.local` ファイルに `DATABASE_URL` が設定されているか確認してください。
2. 開発サーバーを再起動してください。

```bash
npm run dev
```

#### エラー: `Error: connect ECONNREFUSED`

**原因**: PostgreSQL データベースに接続できない場合に発生します。

**対処方法**:
1. PostgreSQL がローカルマシンで起動しているか確認してください。
2. `DATABASE_URL` の接続情報（ホスト名、ポート、ユーザー名、パスワード）が正確であるか確認してください。

#### エラー: `Unique constraint failed`

**原因**: ユニーク制約が設定された項目で重複したデータを挿入しようとした場合に発生します。

**対処方法**:
```typescript
// 既存データをチェック
const existingUser = await prisma.mt_users.findFirst({
  where: { email },
});

if (existingUser) {
  throw new Error('このメールアドレスは既に使用されています');
}

// データ作成
const newUser = await prisma.mt_users.create({
  data: { email, /* その他のデータ */ },
});
```

### デバッグのための便利なコマンド

#### Prisma Studio（GUI でのデータ確認）

```bash
npx prisma studio
```

このコマンドでブラウザベースの GUI ツールが起動し、データベースの内容を確認・編集できます。

#### Prisma Client のログ出力

`.env.local` に以下を追加すると、Prisma のクエリがログに出力されます。

```env
DATABASE_URL=postgresql://...
DEBUG=prisma:*
```

---

## ベストプラクティス

### 1. 型安全性の確保

常に TypeScript の型推論を活用し、`any` 型を避けてください。

```typescript
// ✅ 良い例：Prisma の型定義を使用
const whereConditions: Prisma.mt_usersWhereInput = {
  is_deleted: false,
};

// ❌ 避けるべき：any 型の使用
const whereConditions: any = {
  is_deleted: false,
};
```

### 2. エラーハンドリング

すべてのデータベース操作は try-catch で囲み、適切にエラーハンドリングしてください。

```typescript
try {
  const user = await prisma.mt_users.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'ユーザーが見つかりません' },
      { status: 404 }
    );
  }
} catch (error) {
  console.error('ユーザー取得エラー:', error);
  return NextResponse.json(
    { error: 'ユーザーの取得に失敗しました' },
    { status: 500 }
  );
}
```

### 3. パフォーマンス最適化

#### N+1 問題を避ける

関連データが必要な場合は、`include` で一度に取得してください。

```typescript
// ✅ 良い例：include で関連データを一度に取得
const users = await prisma.mt_users.findMany({
  include: { mt_user_tags: true },
});

// ❌ 避けるべき：ループ内でクエリを実行
const users = await prisma.mt_users.findMany();
for (const user of users) {
  user.tags = await prisma.mt_user_tags.findMany({
    where: { user_id: user.id },
  });
}
```

#### ページネーション

大量のデータ取得時は、必ずページネーションを使用してください。

```typescript
const limit = 10;
const page = 1;
const offset = (page - 1) * limit;

const users = await prisma.mt_users.findMany({
  where: { is_deleted: false },
  orderBy: { created_at: 'desc' },
  take: limit,
  skip: offset,
});

const totalCount = await prisma.mt_users.count({
  where: { is_deleted: false },
});
```

### 4. ソフトデリートの活用

ユーザデータのみ物理的に削除するのではなく、`is_deleted` フラグで論理削除してください。

```typescript
// ✅ 推奨：ソフトデリート
await prisma.mt_users.update({
  where: { id: userId },
  data: { is_deleted: true },
});

// クエリ時は常に is_deleted を確認
const users = await prisma.mt_users.findMany({
  where: { is_deleted: false },
});
```

### 5. ログの記録

重要なデータベース操作はログに記録してください。

```typescript
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

const apiTimer = new QueryTimer();
let statusCode = 200;

try {
  const user = await prisma.mt_users.findUnique({
    where: { id: 1 },
  });

  statusCode = 200;
} catch (error) {
  statusCode = 500;
} finally {
  logAPIEndpoint({
    method: 'GET',
    endpoint: '/api/users/1',
    statusCode,
    executionTime: apiTimer.elapsed(),
  });
}
```

---

## 参考資料

- [Prisma 公式ドキュメント](https://www.prisma.io/docs/)
- [PostgreSQL 公式ドキュメント](https://www.postgresql.org/docs/)
