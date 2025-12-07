# テストグループ編集機能の実装ガイド
## Learning Guide for Test Group Edit Feature Implementation

このガイドは、新規参画者がテストグループ編集機能を理解・実装するためのステップバイステップの手引きです。
テストグループ作成機能を参考にしながら、体系的に学習できるように構成されています。

---

## 目次 (Table of Contents)

1. [学習前提知識](#学習前提知識)
2. [システム全体像](#システム全体像)
3. [実装順序と学習フロー](#実装順序と学習フロー)
4. [詳細実装ガイド](#詳細実装ガイド)
5. [実装メモと注意点](#実装メモと注意点)
6. [検証ステップ](#検証ステップ)
7. [トラブルシューティング](#トラブルシューティング)

---

## 学習前提知識

### このガイドで学べること
- ✅ Next.js API Routes での API 実装パターン
- ✅ Prisma ORM を使用したデータベース操作
- ✅ フロントエンド（React）でのフォーム状態管理
- ✅ 認証・認可の実装
- ✅ 適切なログ出力とエラーハンドリング
- ✅ バリデーション実装（Zod スキーマ）

### 前提スキル
- JavaScript/TypeScript の基本知識
- React の hooks（useState, useEffect）の理解
- async/await の理解
- HTTP リクエスト/レスポンスの基礎知識

### 関連ファイルの場所
```
フロントエンド:
  /app/(secure)/testGroup/[groupId]/edit/
    ├── page.tsx                          # ルートコンポーネント
    └── _components/
        ├── TestGroupEditFormContainer.tsx # データ取得・状態管理
        ├── TestGroupEditForm.tsx          # UI レンダリング
        └── schemas/testGroup-edit-schema.ts # バリデーションスキーマ

バックエンド:
  /app/api/test-groups/
    ├── route.ts                          # GET (一覧取得), POST (新規作成)
    └── [groupId]/
        └── route.ts                      # GET (詳細取得), PUT (編集), DELETE (削除)

ユーティリティ:
  /utils/
    ├── database-logger.ts                # ログ出力ユーティリティ
    ├── server-logger.ts                  # サーバーログ
    ├── client-logger.ts                  # クライアントログ
    └── date-formatter.ts                 # 日付フォーマット

認証・認可:
  /app/lib/
    ├── auth.ts                           # 認証・認可関数
    └── prisma.ts                         # Prisma クライアント

型定義:
  /types/
    ├── database/index.ts                 # データベース関連の型
    └── /app/(secure)/_components/types/
        └── testGroup-list-row.ts         # フォームデータ型
```

---

## システム全体像

### テストグループ編集のアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                  クライアント（React）                      │
├─────────────────────────────────────────────────────────┤
│ page.tsx (Server Component)                             │
│  └─ TestGroupEditFormContainer.tsx (Client Component)   │
│      ├─ API から既存データ取得                            │
│      ├─ フォーム状態管理                                  │
│      ├─ バリデーション実行                                │
│      └─ TestGroupEditForm.tsx (Presentation)           │
│          └─ UI レンダリング                              │
└─────────────────────────────────────────────────────────┘
              ↕ HTTP (fetch API)
┌─────────────────────────────────────────────────────────┐
│              サーバー（Next.js API Routes）                │
├─────────────────────────────────────────────────────────┤
│ /api/test-groups/[groupId]/route.ts                    │
│  ├─ GET: 詳細データ取得 + タグ情報取得                    │
│  └─ PUT: 更新処理（バリデーション→DB更新→ログ出力）       │
│                                                         │
│ 処理フロー:                                              │
│  1. 認証確認                                             │
│  2. 権限確認（編集可能か）                                │
│  3. リクエスト body のバリデーション                      │
│  4. Prisma で DB 更新                                    │
│  5. ロギング出力                                         │
│  6. レスポンス返却                                       │
└─────────────────────────────────────────────────────────┘
              ↕ Prisma ORM
┌─────────────────────────────────────────────────────────┐
│              データベース（PostgreSQL）                     │
├─────────────────────────────────────────────────────────┤
│ tt_test_groups (テストグループ)                           │
│ tt_test_group_tags (テストグループ-タグ関連付け)          │
│ mt_tags (タグマスタ)                                     │
└─────────────────────────────────────────────────────────┘
```

### 作成 vs 編集：主な違い

| 項目 | 作成 (POST) | 編集 (PUT) |
|------|-----------|----------|
| HTTP メソッド | POST | PUT |
| エンドポイント | `/api/test-groups` | `/api/test-groups/{id}` |
| 権限要件 | Admin / Test Manager | Creator のみ (管理者除く) |
| 必須フィールド | すべてのフィールド | OEM, model のみ |
| タグフォーマット | `{ tag_name, test_role }` | `{ tag_id, test_role }` ⚠️ |
| UI の違い | 入力フォーム | プリロード + 既存値の表示 |
| 読み込み状態 | タグリスト取得中 | 詳細データ取得中 |

**⚠️ 重要**: タグの形式が異なります！作成では tag_name を送信しますが、編集では tag_id を送信します。

---

## 実装順序と学習フロー

新規参画者が効率的に学習・実装できるように、以下の順序での実装を推奨します。

### フェーズ 1: 基礎理解 (1-2日)

#### ステップ 1.1: 既存コードの読み込み
1. テストグループ作成機能を理解する
   - `/app/(secure)/testGroup/regist/` の全コンポーネントを読む
   - `/app/api/test-groups/route.ts` の POST メソッドを読む
   - フローチャートを描いて理解を深める

2. テストグループ詳細取得 API を理解する
   - `/app/api/test-groups/[groupId]/route.ts` の GET メソッドを読む
   - 既存データ取得時の処理フローを確認

3. 認証・認可の仕組みを理解する
   - `/app/lib/auth.ts` の `canModifyTestGroup()` 関数を読む
   - 権限チェックのロジックを理解

#### ステップ 1.2: 型定義の理解
1. テストグループ関連の型を確認
   - `TestGroup` インターフェース
   - `TestGroupFormData` 型
   - `TestRole` enum

2. Prisma スキーマを確認
   - `tt_test_groups` モデル
   - `tt_test_group_tags` モデル

### フェーズ 2: バックエンド実装 (2-3日)

#### ステップ 2.1: PUT エンドポイントの実装
参照: `/app/api/test-groups/[groupId]/route.ts` (既に実装済みの例)

主な処理:
```typescript
// 1. 認証確認
const user = await requireAuth(req);

// 2. 権限確認
if (!canModifyTestGroup(user, groupId)) {
  return 403 Forbidden;
}

// 3. バリデーション
if (!oem || !model) {
  return 400 Bad Request;
}

// 4. DB 更新（トランザクション）
const updated = await prisma.$transaction(async (tx) => {
  // tt_test_groups を更新
  const result = await tx.tt_test_groups.update({...});

  // タグ関連付けを更新
  await tx.tt_test_group_tags.deleteMany({...});
  await tx.tt_test_group_tags.createMany({...});

  return result;
});

// 5. ロギング
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{id}',
  statusCode: 200,
  ...
});

// 6. レスポンス返却
return NextResponse.json({ success: true, data: updated });
```

#### ステップ 2.2: DELETE エンドポイント（ソフトデリート）
参照: `/app/api/test-groups/[groupId]/route.ts` (既に実装済みの例)

処理:
- `is_deleted` フラグを `true` に設定
- 権限確認は PUT と同じ

### フェーズ 3: フロントエンド実装 (2-3日)

#### ステップ 3.1: フォームコンポーネントの実装

**参照実装**: `/app/(secure)/testGroup/regist/_components/TestGroupRegistrantion.tsx`

実装するコンポーネント:
- `TestGroupEditFormContainer.tsx` - 状態管理・API通信
- `TestGroupEditForm.tsx` - UI レンダリング
- `testGroup-edit-schema.ts` - Zod スキーマ

主なポイント:
1. **データ取得**: useEffect で GET /api/test-groups/{id} を呼び出し
2. **状態管理**: useState でフォーム値を管理
3. **バリデーション**: Zod スキーマでクライアント側バリデーション
4. **サブミット**: PUT /api/test-groups/{id} を呼び出し
5. **エラーハンドリング**: フィールドごとのエラー表示

#### ステップ 3.2: ページコンポーネントの実装

**参照実装**: `/app/(secure)/testGroup/[groupId]/edit/page.tsx`

実装ポイント:
```typescript
// Server Component
export default function TestGroupEditPage({ params }: Props) {
  return (
    <Suspense fallback={<Loading />}>
      <TestGroupEditFormContainer groupId={params.groupId} />
    </Suspense>
  );
}
```

### フェーズ 4: テストと検証 (1日)

#### ステップ 4.1: 単体テスト
- API エンドポイントのテスト（正常系・エラー系）
- フォームバリデーションのテスト
- 認可ロジックのテスト

#### ステップ 4.2: 統合テスト
- 作成→詳細表示→編集→確認
- タグの更新が正しく反映されること
- ログが適切に出力されること

#### ステップ 4.3: 手動テスト
- UI での入力検証
- エラーハンドリング
- 権限がない場合の動作

---

## 詳細実装ガイド

### API 実装：PUT /api/test-groups/[groupId]

#### 基本構造

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canModifyTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import serverLogger from '@/utils/server-logger';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

export async function PUT(req: NextRequest) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    // ステップ 1: 認証確認
    const user = await requireAuth(req);

    // ステップ 2: リクエストパラメータ取得
    const { params } = new URL(req.url);
    const groupId = parseInt(params.get('groupId') || '0', 10);

    // ステップ 3: 権限確認
    const canModify = await canModifyTestGroup(user, groupId);
    if (!canModify) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: '/api/test-groups/{groupId}',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'テストグループを編集する権限がありません' },
        { status: 403 }
      );
    }

    // ステップ 4: リクエストボディのパース
    const body = await req.json();
    const {
      oem,
      model,
      event,
      variation,
      destination,
      specs,
      test_startdate,
      test_enddate,
      ng_plan_count,
      tags,  // [{ tag_id: number, test_role: number }, ...]
    } = body;

    // ステップ 5: バリデーション
    if (!oem || !model) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: '/api/test-groups/{groupId}',
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Validation error: oem and model are required',
      });
      return NextResponse.json(
        { success: false, error: { message: 'OEM と機種は必須です' } },
        { status: 400 }
      );
    }

    // 長さチェック
    const maxLength = 255;
    if (oem.length > maxLength || model.length > maxLength) {
      statusCode = 400;
      return NextResponse.json(
        { success: false, error: { message: `最大${maxLength}文字です` } },
        { status: 400 }
      );
    }

    // ステップ 6: DB 更新（トランザクション）
    const updateTimer = new QueryTimer();
    const updated = await prisma.$transaction(async (tx) => {
      // tt_test_groups を更新
      const result = await tx.tt_test_groups.update({
        where: { id: groupId },
        data: {
          oem: oem || undefined,
          model: model || undefined,
          event: event || undefined,
          variation: variation || undefined,
          destination: destination || undefined,
          specs: specs || undefined,
          test_startdate: test_startdate ? new Date(test_startdate) : null,
          test_enddate: test_enddate ? new Date(test_enddate) : null,
          ng_plan_count: ng_plan_count ?? undefined,
          updated_by: user.id.toString(),
          updated_at: new Date(),
        },
      });

      // タグを更新：既存タグをすべて削除
      await tx.tt_test_group_tags.deleteMany({
        where: { test_group_id: groupId },
      });

      // 新しいタグを作成
      if (tags && Array.isArray(tags) && tags.length > 0) {
        await tx.tt_test_group_tags.createMany({
          data: tags.map(tag => ({
            test_group_id: groupId,
            tag_id: tag.tag_id,
            test_role: tag.test_role,
          })),
        });
      }

      return result;
    });

    // ステップ 7: ロギング
    logAPIEndpoint({
      method: 'PUT',
      endpoint: '/api/test-groups/{groupId}',
      userId: user.id,
      statusCode: 200,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    // ステップ 8: レスポンス返却
    return NextResponse.json({ success: true, data: updated }, { status: 200 });

  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;

    logAPIEndpoint({
      method: 'PUT',
      endpoint: '/api/test-groups/{groupId}',
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
      { error: 'テストグループの編集に失敗しました' },
      { status: 500 }
    );
  }
}
```

#### ログ出力パターン

```typescript
// 成功時（INFO レベル）
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  userId: user.id,
  statusCode: 200,
  executionTime: apiTimer.elapsed(),
  dataSize: 1,  // 編集対象は1件
});

// 権限エラー（WARN レベル）
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  userId: user.id,
  statusCode: 403,
  executionTime: apiTimer.elapsed(),
  error: 'Permission denied',
});

// バリデーションエラー（WARN レベル）
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  userId: user.id,
  statusCode: 400,
  executionTime: apiTimer.elapsed(),
  error: 'Validation error: ...',
});

// サーバーエラー（ERROR レベル）
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  statusCode: 500,
  executionTime: apiTimer.elapsed(),
  error: error.message,
});
```

### フロントエンド実装：EditFormContainer

#### Zod スキーマ定義

参照: `/app/(secure)/testGroup/regist/_components/schemas/testGroup-regist-schema.ts`

```typescript
import { z } from 'zod';

export const testGroupEditSchema = z.object({
  oem: z.string().min(1, 'OEM は必須です').max(255),
  model: z.string().min(1, '機種 は必須です').max(255),
  event: z.string().max(255).optional().default(''),
  variation: z.string().max(255).optional().default(''),
  destination: z.string().max(255).optional().default(''),
  specs: z.string().optional().default(''),
  test_startdate: z.string().optional(),
  test_enddate: z.string().optional(),
  ngPlanCount: z.coerce.number().int().min(0).max(9999).optional(),
  designerTag: z.array(z.string()).optional().default([]),
  executerTag: z.array(z.string()).optional().default([]),
  viewerTag: z.array(z.string()).optional().default([]),
}).refine(
  (data) => {
    if (!data.test_startdate || !data.test_enddate) return true;
    return new Date(data.test_startdate) <= new Date(data.test_enddate);
  },
  {
    message: '開始日は終了日以前である必要があります',
    path: ['test_startdate'],
  }
);

export type TestGroupEditFormData = z.infer<typeof testGroupEditSchema>;
```

#### Container コンポーネント

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clientLogger from '@/utils/client-logger';
import TestGroupEditForm from './TestGroupEditForm';

interface TestGroupEditFormContainerProps {
  groupId: string;
}

export default function TestGroupEditFormContainer({
  groupId,
}: TestGroupEditFormContainerProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({...});
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ステップ 1: マウント時にデータ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        clientLogger.debug(
          'TestGroupEditFormContainer',
          '詳細データを取得中',
          { groupId }
        );

        // 既存データ取得
        const dataResponse = await fetch(`/api/test-groups/${groupId}`);
        if (!dataResponse.ok) {
          throw new Error('データ取得に失敗しました');
        }
        const dataResult = await dataResponse.json();

        // タグリスト取得
        const tagsResponse = await fetch('/api/tags');
        const tagsResult = await tagsResponse.json();

        // フォームに既存値を設定
        setFormData(dataResult.data);
        setTags(tagsResult.data);

        clientLogger.info(
          'TestGroupEditFormContainer',
          '詳細データを取得完了',
          { groupId, recordCount: 1 }
        );
      } catch (error) {
        clientLogger.error(
          'TestGroupEditFormContainer',
          'データ取得エラー',
          { error: error instanceof Error ? error.message : String(error) }
        );
        setErrors({ submit: '詳細情報の取得に失敗しました' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId]);

  // ステップ 2: フォーム値の変更ハンドラー
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // エラーをクリア
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // ステップ 3: サブミットハンドラー
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      clientLogger.info(
        'TestGroupEditFormContainer',
        '更新処理を開始',
        { groupId, fieldsChanged: Object.keys(formData) }
      );

      // バリデーション
      const validationResult = testGroupEditSchema.safeParse(formData);
      if (!validationResult.success) {
        const fieldErrors: Record<string, string> = {};
        validationResult.error.errors.forEach(error => {
          const path = error.path[0] as string;
          fieldErrors[path] = error.message;
        });
        setErrors(fieldErrors);
        return;
      }

      // タグを tag_id 形式に変換（重要！）
      const tagsPayload = [
        ...formData.designerTag.map(tagName => ({
          tag_id: tags.find(t => t.name === tagName)?.id,
          test_role: 0, // Designer
        })),
        ...formData.executerTag.map(tagName => ({
          tag_id: tags.find(t => t.name === tagName)?.id,
          test_role: 1, // Executor
        })),
        ...formData.viewerTag.map(tagName => ({
          tag_id: tags.find(t => t.name === tagName)?.id,
          test_role: 2, // Viewer
        })),
      ].filter(t => t.tag_id !== undefined);

      // API リクエスト
      const response = await fetch(`/api/test-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tags: tagsPayload,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        clientLogger.warn(
          'TestGroupEditFormContainer',
          '更新エラー',
          { statusCode: response.status, error: result.error }
        );
        setErrors({ submit: result.error });
        return;
      }

      clientLogger.info(
        'TestGroupEditFormContainer',
        '更新処理を完了',
        { groupId, updateResult: 'success' }
      );

      // 成功時は一覧に戻る
      router.push('/testGroup');
    } catch (error) {
      clientLogger.error(
        'TestGroupEditFormContainer',
        '更新処理でエラー発生',
        { error: error instanceof Error ? error.message : String(error) }
      );
      setErrors({ submit: '更新に失敗しました' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ステップ 4: UI レンダリング
  if (loading) {
    return <Loading message="詳細情報を取得中..." />;
  }

  return (
    <TestGroupEditForm
      formData={formData}
      tags={tags}
      errors={errors}
      onSubmit={handleSubmit}
      onChange={handleChange}
      isSubmitting={isSubmitting}
    />
  );
}
```

#### フォームコンポーネント（UI）

```typescript
'use client';

import { TestGroupEditFormData } from './schemas/testGroup-edit-schema';
import VerticalForm from '@/components/ui/verticalForm';
import Modal from '@/components/ui/modal';

interface TestGroupEditFormProps {
  formData: TestGroupEditFormData;
  tags: Array<{ id: number; name: string }>;
  errors: Record<string, string>;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (field: string, value: any) => void;
  isSubmitting: boolean;
}

export default function TestGroupEditForm({
  formData,
  tags,
  errors,
  onSubmit,
  onChange,
  isSubmitting,
}: TestGroupEditFormProps) {
  const formFields = [
    {
      label: 'OEM',
      type: 'text',
      name: 'oem',
      value: formData.oem,
      onChange: (e) => onChange('oem', e.target.value),
      required: true,
      error: errors.oem,
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: formData.model,
      onChange: (e) => onChange('model', e.target.value),
      required: true,
      error: errors.model,
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: formData.event,
      onChange: (e) => onChange('event', e.target.value),
      error: errors.event,
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: formData.variation,
      onChange: (e) => onChange('variation', e.target.value),
      error: errors.variation,
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: formData.destination,
      onChange: (e) => onChange('destination', e.target.value),
      error: errors.destination,
    },
    {
      label: '仕様',
      type: 'text',
      name: 'specs',
      value: formData.specs,
      onChange: (e) => onChange('specs', e.target.value),
      error: errors.specs,
    },
    {
      label: '試験開始日',
      type: 'date',
      name: 'test_startdate',
      value: formData.test_startdate,
      onChange: (e) => onChange('test_startdate', e.target.value),
      error: errors.test_startdate,
    },
    {
      label: '試験終了日',
      type: 'date',
      name: 'test_enddate',
      value: formData.test_enddate,
      onChange: (e) => onChange('test_enddate', e.target.value),
      error: errors.test_enddate,
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: formData.ngPlanCount,
      onChange: (e) => onChange('ngPlanCount', e.target.value),
      min: 0,
      max: 9999,
      error: errors.ngPlanCount,
    },
  ];

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-6">
        <VerticalForm fields={formFields} />

        <div className="mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            {isSubmitting ? '更新中...' : '更新'}
          </button>
        </div>
      </form>

      {errors.submit && (
        <Modal
          title="エラー"
          message={errors.submit}
          onClose={() => {}}
          type="error"
        />
      )}
    </>
  );
}
```

---

## 実装メモと注意点

### ⚠️ 重要な違いと落とし穴

#### 1. タグの形式が異なる

**作成時（POST）**:
```typescript
tag_names: [
  { tag_name: "Design", test_role: 0 },
  { tag_name: "Execution", test_role: 1 }
]
```

**編集時（PUT）**:
```typescript
tags: [
  { tag_id: 1, test_role: 0 },
  { tag_id: 2, test_role: 1 }
]
```

**実装のポイント**:
```typescript
// フロントエンドで変換が必要
const tagsPayload = designerTags.map(tagName => ({
  tag_id: tags.find(t => t.name === tagName)?.id,  // ID を探す
  test_role: 0,
}));
```

#### 2. 権限チェックは異なる

**作成時**: Admin / Test Manager

```typescript
if (!isAdmin(user) && !isTestManager(user)) {
  return 403;
}
```

**編集時**: Creator のみ（Admin を除く）

```typescript
const canModify = await canModifyTestGroup(user, groupId);
if (!canModify) {
  return 403;
}
```

#### 3. バリデーションレベルが異なる

**作成時**: すべてのフィールドが必須
```typescript
if (!oem || !model || !event || !variation || !destination ||
    !specs || !test_startdate || !test_enddate) {
  return 400;
}
```

**編集時**: OEM と model のみ必須（他は部分更新可能）
```typescript
if (!oem || !model) {
  return 400;
}
// 他のフィールドは undefined のまま渡すと更新されない
```

#### 4. API レスポンスは同じ

両方の操作で成功時は 200 ステータスコードを返します：
```typescript
return NextResponse.json({ success: true, data: result });
```

### パフォーマンス最適化

#### 1. 不要な再レンダリングを防ぐ

```typescript
// 良い例：正確な状態更新
const handleChange = (field: string, value: any) => {
  setFormData(prev => ({
    ...prev,
    [field]: value,
  }));
};

// 避けるべき：全フィールドの再作成
// setFormData({ ...formData, [field]: value });  // 全オブジェクト再作成
```

#### 2. API 呼び出しの最小化

```typescript
// 良い例：必要なデータのみ送信
const payloadToSend = {
  oem: formData.oem,
  model: formData.model,
  // 変更があったフィールドのみ
};

// 避けるべき：全フィールドを送信
// const payloadToSend = { ...formData };  // 変更なしのフィールドも送信
```

### セキュリティに関する注意

#### 1. XSS 対策

React は自動的に XSS を防ぎますが、`dangerouslySetInnerHTML` は使用しないこと。

```typescript
// 安全
<div>{userInput}</div>

// 危険 - 使用禁止
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

#### 2. CSRF トークン

Next.js は自動的に CSRF 保護を行いますが、カスタムヘッダーを追加する場合は確認が必要です。

```typescript
// Next.js API Routes では不要
const response = await fetch('/api/test-groups/{id}', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

#### 3. 認証トークンの取得

`requireAuth()` 関数で自動的に認証を確認します：

```typescript
const user = await requireAuth(req);  // 認証されていなければ throw
```

### ログ出力の適切な分類

#### INFO レベル
- 成功した API 処理
- ユーザーアクション完了
- 外部 API の入出力

```typescript
// 成功時のロギング
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  userId: user.id,
  statusCode: 200,
  executionTime: apiTimer.elapsed(),
  dataSize: 1,
});
```

#### WARN レベル
- バリデーションエラー
- 権限不足エラー

```typescript
// 権限エラー
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  userId: user.id,
  statusCode: 403,
  executionTime: apiTimer.elapsed(),
  error: 'Permission denied',
});
```

#### ERROR レベル
- 予期しないサーバーエラー
- データベース接続エラー

```typescript
// サーバーエラー
logAPIEndpoint({
  method: 'PUT',
  endpoint: '/api/test-groups/{groupId}',
  statusCode: 500,
  executionTime: apiTimer.elapsed(),
  error: error instanceof Error ? error.message : 'Unknown error',
});
```

#### DEBUG レベル
- 開発者向けの詳細情報（オプション）

```typescript
// 開発環境での詳細なログ
clientLogger.debug(
  'TestGroupEditFormContainer',
  '詳細データを取得中',
  { groupId }
);
```

---

## 検証ステップ

### チェックリスト

#### API エンドポイント（PUT）の確認
- [ ] `/api/test-groups/[groupId]` に PUT メソッドが実装されている
- [ ] 認証チェックが実装されている
- [ ] 権限チェック（creator only）が実装されている
- [ ] リクエストボディのバリデーションが実装されている
- [ ] 日付の比較バリデーションが実装されている
- [ ] Prisma トランザクションが使用されている
- [ ] タグの削除と再作成が実装されている
- [ ] 適切なログ出力がされている
- [ ] エラーハンドリングが実装されている
- [ ] 正しい HTTP ステータスコードを返している

#### フロントエンドコンポーネントの確認
- [ ] `TestGroupEditFormContainer.tsx` が実装されている
- [ ] `TestGroupEditForm.tsx` が実装されている
- [ ] `testGroup-edit-schema.ts` が実装されている
- [ ] useEffect でデータ取得が実装されている
- [ ] フォーム状態管理が実装されている
- [ ] バリデーションスキーマが適用されている
- [ ] タグの形式変換が実装されている
- [ ] エラー表示が実装されている
- [ ] ローディング状態が表示されている

#### ルートコンポーネントの確認
- [ ] `/app/(secure)/testGroup/[groupId]/edit/page.tsx` が実装されている
- [ ] Server Component として実装されている
- [ ] Suspense でローディング状態を管理している

### 手動テストシナリオ

#### シナリオ 1: 正常系（すべてのフィールドを編集）
1. テストグループ一覧からテストグループを選択
2. 編集ページで全フィールドを入力
3. 更新ボタンをクリック
4. ✅ 成功メッセージが表示される
5. ✅ 一覧ページにリダイレクトされる
6. ✅ 更新内容が反映されている
7. ✅ ログに INFO レベルの更新ログが出力されている

#### シナリオ 2: 部分編集
1. テストグループ編集ページを開く
2. OEM のみを編集
3. 更新ボタンをクリック
4. ✅ OEM のみが更新されている
5. ✅ 他のフィールドは変更されていない

#### シナリオ 3: バリデーションエラー
1. OEM を空にする
2. 更新ボタンをクリック
3. ✅ エラーメッセージが表示される
4. ✅ リクエストが送信されない
5. ✅ ログに出力されない

#### シナリオ 4: 権限なしエラー
1. 別のユーザーが作成したテストグループを編集しようとする（管理者でない場合）
2. ✅ 403 エラーが返される
3. ✅ エラーメッセージが表示される
4. ✅ ログに WARN レベルで権限エラーが出力される

#### シナリオ 5: タグ更新
1. 編集ページでタグを追加・削除
2. 更新ボタンをクリック
3. ✅ タグが正しく更新されている
4. ✅ DB の `tt_test_group_tags` テーブルが更新されている

### API テスト（curl）

```bash
# 更新リクエスト
curl -X PUT http://localhost:3000/api/test-groups/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION" \
  -d '{
    "oem": "Updated OEM",
    "model": "Model X",
    "event": "Event A",
    "tags": [
      { "tag_id": 1, "test_role": 0 },
      { "tag_id": 2, "test_role": 1 }
    ]
  }'

# 期待レスポンス（成功時）
{
  "success": true,
  "data": {
    "id": 1,
    "oem": "Updated OEM",
    "model": "Model X",
    ...
  }
}

# 権限エラー
{
  "error": "テストグループを編集する権限がありません"
}
```

---

## トラブルシューティング

### よくあるエラーと対処法

#### エラー 1: "PrismaClientConstructorValidationError"

```
Error: Using engine type "client" requires either "adapter" or "accelerateUrl"
```

**原因**: Prisma が正しく初期化されていない

**対処法**:
```bash
# Prisma クライアントを再生成
npx prisma generate

# キャッシュをクリア
rm -rf .next
npm run build
```

#### エラー 2: "TypeError: Cannot read property 'id' of undefined"

```typescript
// タグのマッピング時に tag が見つからない
const tagId = tags.find(t => t.name === tagName)?.id;  // undefined
```

**原因**: タグ名が正確に一致していない

**対処法**:
```typescript
// タグ名の前後の空白を削除
const trimmedName = tagName.trim();
const tag = tags.find(t => t.name.toLowerCase() === trimmedName.toLowerCase());
```

#### エラー 3: "401 Unauthorized"

```
Error: Authentication required
```

**原因**: 認証情報が不足している

**対処法**:
1. クッキーが正しく送信されているか確認
2. セッションが有効か確認
3. `requireAuth()` の前に認証ロジックを確認

```typescript
const user = await requireAuth(req);  // これが throw している
```

#### エラー 4: "403 Forbidden - Permission denied"

**原因**: ユーザーがテストグループを編集する権限がない

**対処法**:
1. テストグループの creator を確認
2. 現在のユーザーが creator か確認
3. ユーザーが管理者かを確認

```typescript
// 権限チェック
const canModify = await canModifyTestGroup(user, groupId);
// false の場合、403 を返す
```

#### エラー 5: "400 Bad Request - Validation error"

**原因**: 必須フィールドが不足している

**対処法**:
```typescript
// 必須フィールドを確認
if (!oem || !model) {
  return 400;
}

// または Zod スキーマで検証
const result = testGroupEditSchema.safeParse(formData);
if (!result.success) {
  console.log(result.error.errors);  // エラー詳細
}
```

#### エラー 6: "タグが更新されない"

**原因**: タグの形式が間違っている、または tag_id が見つからない

**対処法**:
```typescript
// タグの形式を確認
const tagsPayload = [
  { tag_id: 1, test_role: 0 },  // 正しい形式
  // { tag_name: "Design", test_role: 0 },  // これは編集時には間違い
];

// API に送信する前にログで確認
console.log('Tags to send:', tagsPayload);
```

#### エラー 7: "500 Internal Server Error"

**原因**: サーバー側でハンドルされないエラーが発生

**対処法**:
1. サーバーログを確認
   ```bash
   npm run dev  # コンソールログを確認
   ```

2. Prisma クエリのエラーを確認
   ```typescript
   try {
     const result = await prisma.tt_test_groups.update({...});
   } catch (error) {
     console.error('Prisma error:', error);  // 詳細なエラーを出力
     serverLogger.error('Update failed', error);
   }
   ```

### デバッグテクニック

#### ログの活用

```typescript
// 実装時のデバッグ
serverLogger.debug('PUT request received', { groupId, body });
serverLogger.debug('User permission check', { userId, canModify });
serverLogger.debug('Validation result', { errors });
serverLogger.debug('Database update result', { updatedId });
```

#### Network タブでのデバッグ

1. ブラウザの開発者ツールを開く
2. Network タブに切り替え
3. 更新ボタンをクリック
4. PUT リクエストを確認
   - Request headers
   - Request body
   - Response status
   - Response body

#### データベース確認

```bash
# Prisma Studio で DB を確認
npx prisma studio

# または SQL クライアントで直接確認
psql -U user -d database -c "SELECT * FROM tt_test_groups WHERE id = 1;"
```

---

## 次のステップ

このガイドを完了した後、以下の点について学習・実装することをお勧めします：

1. **テスト実装**
   - Jest でユニットテスト
   - React Testing Library でコンポーネントテスト
   - E2E テスト（Playwright/Cypress）

2. **パフォーマンス最適化**
   - コンポーネント分割
   - メモ化の活用
   - 不要な再レンダリング削減

3. **ユーザー体験の改善**
   - 楽観的 UI 更新
   - リアルタイム検証
   - プログレスインジケーター

4. **監視・運用**
   - エラートラッキング（Sentry など）
   - パフォーマンス監視
   - ユーザーフィードバック収集

---

## 参考リソース

### 公式ドキュメント
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma ORM](https://www.prisma.io/docs/)
- [React Hooks](https://react.dev/reference/react)
- [Zod バリデーション](https://zod.dev/)

### このプロジェクト内のドキュメント
- テストグループ作成機能の実装コード
- 既存の認証・認可実装
- ログ出力ガイド

### 質問やサポートが必要な場合

実装中に不明な点がある場合は、以下を確認してください：

1. このガイドの該当セクションを再度読む
2. 既存の実装コード（特にテストグループ作成機能）を参照
3. チームメンバーに相談
4. コンソールログやエラーメッセージを確認

---

**このガイドの更新日**: 2025-12-07
**対象バージョン**: Next.js 15.3.3, Prisma 5.x

---

## 補足：学習用チェックリスト

実装完了後、以下の理解ができているか確認してください：

### 概念の理解
- [ ] REST API の CRUD 操作（GET, POST, PUT, DELETE）の違いを理解している
- [ ] HTTP ステータスコード（200, 201, 400, 403, 404, 500）の意味を理解している
- [ ] トランザクション処理の重要性を理解している
- [ ] 権限管理の仕組みを理解している
- [ ] ログレベル（DEBUG, INFO, WARN, ERROR）の使い分けを理解している

### 実装スキル
- [ ] Next.js API Routes で複数の HTTP メソッドを実装できる
- [ ] Prisma で複雑なクエリを書ける
- [ ] React で複合的なフォーム管理ができる
- [ ] Zod でカスタムバリデーションスキーマを定義できる
- [ ] API エラーを適切にハンドルできる

### ベストプラクティス
- [ ] 不要な API リクエストを最小化できる
- [ ] エラーメッセージをユーザー分かりやすく表示できる
- [ ] セキュリティを考慮した実装ができる
- [ ] 適切なログ出力ができる
- [ ] テストしやすいコード構造を作成できる

これらの項目がすべてチェックできれば、テストグループ編集機能の実装とその背後にある原則を十分に理解できています！

---

**Happy Learning! 🚀**
