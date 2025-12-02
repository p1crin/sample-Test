# API 開発ガイド

## 概要

本ドキュメントは、本システムの API エンドポイント開発時に従うべき実装パターンと規約をまとめたものです。

---

## API エンドポイントの基本構造

### ファイルの場所

すべての API エンドポイントは以下のディレクトリに配置されます。

```
app/api/[リソース名]/route.ts
```

例：
- `app/api/users/route.ts` - ユーザー一覧取得・作成
- `app/api/users/[userId]/route.ts` - ユーザー詳細取得・更新・削除
- `app/api/test-groups/route.ts` - テストグループ一覧取得・作成

### ファイルの基本テンプレート

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';
import type { Prisma } from '@/generated/prisma/client';

// GET /api/[resource] - リソース一覧取得
export async function GET(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    // 認証確認
    const user = await requireAuth(req);

    // クエリパラメータの取得
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // where 条件の構築
    const whereConditions: Prisma.[モデル名]WhereInput = {
      is_deleted: false,
    };

    // データベースクエリ
    const data = await prisma.[テーブル名].findMany({
      where: whereConditions,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    statusCode = 200;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/[resource]',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: data.length,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;
    logAPIEndpoint({
      method: 'GET',
      endpoint: '/api/[resource]',
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'リソースの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST /api/[resource] - リソース作成
export async function POST(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 201;

  try {
    const user = await requireAuth(req);
    const body = await req.json();

    // バリデーション
    if (!body.requiredField) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'POST',
        endpoint: '/api/[resource]',
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error',
      });
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    // トランザクション内でデータ作成
    const newResource = await prisma.$transaction(async (tx) => {
      const resource = await tx.[テーブル名].create({
        data: {
          ...body,
          created_by: user.id,
          updated_by: user.id,
        },
      });
      return resource;
    });

    statusCode = 201;
    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/[resource]',
      userId: user.id,
      statusCode,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({ success: true, data: newResource }, { status: 201 });
  } catch (error) {
    statusCode = 500;
    logAPIEndpoint({
      method: 'POST',
      endpoint: '/api/[resource]',
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'リソースの作成に失敗しました' },
      { status: 500 }
    );
  }
}
```

---

## 認証パターン

### ユーザー認証

ユーザーの認証が必要な場合は、`requireAuth` を使用してください。

```typescript
import { requireAuth } from '@/app/lib/auth';

const user = await requireAuth(req);
// user.id : ユーザーID
// user.user_role : ユーザーロール（1:管理者、2:一般ユーザー等）
```

### 管理者認証

管理者権限が必要な場合は、`requireAdmin` を使用してください。

```typescript
import { requireAdmin } from '@/app/lib/auth';

const admin = await requireAdmin(req);
// 管理者でない場合は例外が発生
```

### エラーハンドリング

認証失敗時は、自動的に適切なエラーが投げられます。

```typescript
try {
  const user = await requireAuth(req);
  // 処理続行
} catch (error) {
  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message === 'Forbidden') {
    return NextResponse.json(
      { error: '権限がありません' },
      { status: 403 }
    );
  }
}
```

---

## データベースクエリのパターン

### 単純な取得クエリ

```typescript
// 単一レコード取得
const user = await prisma.mt_users.findUnique({
  where: { id: userId },
});

// 複数レコード取得
const users = await prisma.mt_users.findMany({
  where: { is_deleted: false },
  orderBy: { created_at: 'desc' },
});
```

### フィルター条件付きクエリ

```typescript
const whereConditions: Prisma.tt_test_groupsWhereInput = {
  id: { in: accessibleIds },
  is_deleted: false,
};

// 動的条件の追加
if (searchQuery) {
  whereConditions.name = {
    contains: searchQuery,
    mode: 'insensitive',
  };
}

const results = await prisma.tt_test_groups.findMany({
  where: whereConditions,
});
```

### ページネーション付きクエリ

```typescript
const page = parseInt(searchParams.get('page') || '1', 10);
const limit = parseInt(searchParams.get('limit') || '10', 10);
const offset = (page - 1) * limit;

// 総件数取得
const totalCount = await prisma.[テーブル名].count({
  where: whereConditions,
});

// ページング対象データ取得
const data = await prisma.[テーブル名].findMany({
  where: whereConditions,
  skip: offset,
  take: limit,
  orderBy: { created_at: 'desc' },
});

return NextResponse.json({
  success: true,
  data,
  pagination: {
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  },
});
```

### リレーションデータの取得

```typescript
// include を使用して関連データを取得
const userWithTags = await prisma.mt_users.findUnique({
  where: { id: userId },
  include: {
    mt_user_tags: {
      include: { mt_tags: true },
    },
  },
});

// select を使用して特定の項目のみ取得
const userWithSelected = await prisma.mt_users.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
  },
});
```

---

## トランザクション処理のパターン

### 複数操作を一度に実行

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 操作1: ユーザー作成
  const user = await tx.mt_users.create({
    data: {
      email: body.email,
      password: hashedPassword,
    },
  });

  // 操作2: タグ関連付け
  if (body.tagIds && body.tagIds.length > 0) {
    for (const tagId of body.tagIds) {
      await tx.mt_user_tags.create({
        data: {
          user_id: user.id,
          tag_id: tagId,
        },
      });
    }
  }

  return user;
});
```

### エラー時の自動ロールバック

```typescript
try {
  await prisma.$transaction(async (tx) => {
    // 操作1
    // 操作2
    // 操作3のいずれかでエラーが発生すると
    // すべての変更が自動的に取り消されます
  });
} catch (error) {
  // トランザクション失敗時の処理
  console.error('トランザクション失敗:', error);
  return NextResponse.json(
    { error: '処理に失敗しました' },
    { status: 500 }
  );
}
```

---

## レスポンス形式の統一

### 成功レスポンス

#### GET（一覧取得）

```typescript
return NextResponse.json({
  success: true,
  data: [...],
  pagination: {
    totalCount: 100,
    page: 1,
    limit: 10,
    totalPages: 10,
  },
});
```

#### GET（単一取得）

```typescript
return NextResponse.json({
  success: true,
  data: {...},
});
```

#### POST（作成）

```typescript
return NextResponse.json(
  { success: true, data: {...} },
  { status: 201 }
);
```

#### PUT（更新）

```typescript
return NextResponse.json({
  success: true,
  message: 'リソースを更新しました',
});
```

#### DELETE（削除）

```typescript
return NextResponse.json({
  success: true,
  message: 'リソースを削除しました',
});
```

### エラーレスポンス

```typescript
// 認証エラー
return NextResponse.json(
  { error: '認証が必要です' },
  { status: 401 }
);

// 権限エラー
return NextResponse.json(
  { error: '権限がありません' },
  { status: 403 }
);

// バリデーションエラー
return NextResponse.json(
  {
    error: 'バリデーションエラーが発生しました',
    details: {
      email: 'メールアドレスは必須です',
      password: 'パスワードは8文字以上必要です',
    },
  },
  { status: 400 }
);

// サーバーエラー
return NextResponse.json(
  { error: 'リソースの取得に失敗しました' },
  { status: 500 }
);
```

---

## ログの記録

### ログ記録の実装

すべての API エンドポイントでは、リクエスト処理の開始時にタイマーを開始し、終了時にログを記録してください。

```typescript
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

const apiTimer = new QueryTimer();
let statusCode = 200;

try {
  // 処理
  statusCode = 200;
} catch (error) {
  statusCode = 500;
} finally {
  logAPIEndpoint({
    method: 'GET',
    endpoint: '/api/users',
    userId: user.id, // オプション
    statusCode,
    executionTime: apiTimer.elapsed(),
    dataSize: data.length, // オプション
    error: error ? error.message : undefined, // エラーの場合のみ
  });
}
```

### ログフィールドの説明

- `method`: HTTP メソッド（GET、POST、PUT、DELETE）
- `endpoint`: API エンドポイントのパス
- `userId`: リクエストしたユーザーID（オプション）
- `statusCode`: HTTP ステータスコード
- `executionTime`: 実行時間（ミリ秒）
- `dataSize`: レスポンスデータの件数（オプション）
- `error`: エラーメッセージ（エラーの場合のみ）

---

## バリデーションパターン

### リクエストボディのバリデーション

```typescript
const body = await req.json();
const { email, password, name } = body;

// 必須フィールドの確認
if (!email || !password) {
  return NextResponse.json(
    { error: 'メールアドレスとパスワードは必須です' },
    { status: 400 }
  );
}

// 形式チェック
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  return NextResponse.json(
    { error: '有効なメールアドレスを入力してください' },
    { status: 400 }
  );
}

// 文字数チェック
if (password.length < 8) {
  return NextResponse.json(
    { error: 'パスワードは8文字以上である必要があります' },
    { status: 400 }
  );
}
```

### URL パラメータのバリデーション

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: userIdParam } = await params;

  // 数値変換
  const userId = parseInt(userIdParam, 10);

  // 有効性チェック
  if (isNaN(userId) || userId <= 0) {
    return NextResponse.json(
      { error: '有効なユーザーIDを指定してください' },
      { status: 400 }
    );
  }

  // 以下処理続行
}
```

---

## 実装チェックリスト

新しい API エンドポイントを実装する際は、以下のチェックリストを確認してください。

- [ ] ファイルが正しいディレクトリ構造に配置されている
- [ ] 認証処理が実装されている（必要に応じて）
- [ ] リクエストのバリデーションが実装されている
- [ ] TypeScript の型安全性が確保されている（`any` 型を避けている）
- [ ] エラーハンドリングが適切に実装されている
- [ ] すべての処理パスでログが記録されている
- [ ] レスポンス形式が統一されている
- [ ] トランザクションが必要な処理では使用されている
- [ ] N+1 問題が発生していない（`include` を活用）
- [ ] 本番環境を想定した実装になっている

---

## 参考資料

- [Prisma ガイド](./PRISMA_GUIDE.md)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs/)

---

**最終更新日**: 2025年12月2日
**バージョン**: 1.0
