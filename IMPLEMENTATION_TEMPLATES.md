# テストグループ編集機能：実装テンプレート集
## Implementation Templates for Test Group Edit Feature

このファイルは、テストグループ編集機能の実装に必要なコードテンプレートを提供します。
各セクションをコピー&ペーストして、プロジェクトの構造に合わせて調整してください。

---

## 1. API テンプレート

### ファイル: `/app/api/test-groups/[groupId]/route.ts`

以下のテンプレートを使用して、PUT メソッドを実装してください。

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, canModifyTestGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';
import serverLogger from '@/utils/server-logger';
import { logAPIEndpoint, QueryTimer } from '@/utils/database-logger';

interface RouteParams {
  params: {
    groupId: string;
  };
}

// PUT /api/test-groups/[groupId] - テストグループを編集
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    // ステップ 1: 認証確認
    const user = await requireAuth(req);

    // ステップ 2: グループ ID を取得
    const groupId = parseInt(params.groupId, 10);
    if (isNaN(groupId)) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${params.groupId}`,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Invalid groupId',
      });
      return NextResponse.json(
        { error: 'テストグループIDが不正です' },
        { status: 400 }
      );
    }

    // ステップ 3: 権限確認
    const canModify = await canModifyTestGroup(user, groupId);
    if (!canModify) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}`,
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

    // ステップ 4: リクエストボディを取得
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
      tags,
    } = body;

    // ステップ 5: 基本的なバリデーション
    if (!oem || !model) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}`,
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

    // ステップ 6: 文字列長のバリデーション
    const maxLength = 255;
    if (
      oem.length > maxLength ||
      model.length > maxLength ||
      (event && event.length > maxLength) ||
      (variation && variation.length > maxLength) ||
      (destination && destination.length > maxLength)
    ) {
      statusCode = 400;
      logAPIEndpoint({
        method: 'PUT',
        endpoint: `/api/test-groups/${groupId}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: `Field length exceeds maximum (${maxLength})`,
      });
      return NextResponse.json(
        { success: false, error: { message: `最大${maxLength}文字です` } },
        { status: 400 }
      );
    }

    // ステップ 7: 数値のバリデーション
    if (ng_plan_count !== undefined && ng_plan_count !== null) {
      if (typeof ng_plan_count !== 'number' || ng_plan_count < 0 || ng_plan_count > 9999) {
        statusCode = 400;
        logAPIEndpoint({
          method: 'PUT',
          endpoint: `/api/test-groups/${groupId}`,
          userId: user.id,
          statusCode,
          executionTime: apiTimer.elapsed(),
          error: 'Validation error: ng_plan_count out of range',
        });
        return NextResponse.json(
          { success: false, error: { message: '不具合摘出予定数は 0〜9999 です' } },
          { status: 400 }
        );
      }
    }

    // ステップ 8: 日付のバリデーション
    if (test_startdate && test_enddate) {
      const startDate = new Date(test_startdate);
      const endDate = new Date(test_enddate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        statusCode = 400;
        return NextResponse.json(
          { success: false, error: { message: '日付の形式が不正です' } },
          { status: 400 }
        );
      }
      if (startDate > endDate) {
        statusCode = 400;
        logAPIEndpoint({
          method: 'PUT',
          endpoint: `/api/test-groups/${groupId}`,
          userId: user.id,
          statusCode,
          executionTime: apiTimer.elapsed(),
          error: 'Validation error: startdate must be before enddate',
        });
        return NextResponse.json(
          { success: false, error: { message: '開始日は終了日以前である必要があります' } },
          { status: 400 }
        );
      }
    }

    // ステップ 9: トランザクション内で DB 更新
    const updateTimer = new QueryTimer();
    const updated = await prisma.$transaction(async (tx) => {
      // tt_test_groups を更新
      const result = await tx.tt_test_groups.update({
        where: { id: groupId },
        data: {
          ...(oem !== undefined && { oem }),
          ...(model !== undefined && { model }),
          ...(event !== undefined && { event }),
          ...(variation !== undefined && { variation }),
          ...(destination !== undefined && { destination }),
          ...(specs !== undefined && { specs }),
          ...(test_startdate !== undefined && { test_startdate: test_startdate ? new Date(test_startdate) : null }),
          ...(test_enddate !== undefined && { test_enddate: test_enddate ? new Date(test_enddate) : null }),
          ...(ng_plan_count !== undefined && { ng_plan_count }),
          updated_by: user.id.toString(),
          updated_at: new Date(),
        },
      });

      // タグを更新（既存タグをすべて削除）
      if (tags !== undefined) {
        await tx.tt_test_group_tags.deleteMany({
          where: { test_group_id: groupId },
        });

        // 新しいタグを作成
        if (Array.isArray(tags) && tags.length > 0) {
          await tx.tt_test_group_tags.createMany({
            data: tags.map((tag: any) => ({
              test_group_id: groupId,
              tag_id: tag.tag_id,
              test_role: tag.test_role,
            })),
          });
        }
      }

      return result;
    });

    // ステップ 10: ロギング（成功時は INFO）
    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${groupId}`,
      userId: user.id,
      statusCode: 200,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    // ステップ 11: レスポンス返却
    return NextResponse.json({ success: true, data: updated }, { status: 200 });

  } catch (error) {
    // エラーハンドリング
    if (error instanceof Error && error.message === 'Unauthorized') {
      statusCode = 401;
    } else {
      statusCode = 500;
    }

    logAPIEndpoint({
      method: 'PUT',
      endpoint: `/api/test-groups/${params.groupId}`,
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

    serverLogger.error('PUT /api/test-groups error', error as Error);

    return NextResponse.json(
      { error: 'テストグループの編集に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE /api/test-groups/[groupId] - テストグループをソフトデリート
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const apiTimer = new QueryTimer();
  let statusCode = 200;

  try {
    const user = await requireAuth(req);
    const groupId = parseInt(params.groupId, 10);

    // 権限確認
    const canModify = await canModifyTestGroup(user, groupId);
    if (!canModify) {
      statusCode = 403;
      logAPIEndpoint({
        method: 'DELETE',
        endpoint: `/api/test-groups/${groupId}`,
        userId: user.id,
        statusCode,
        executionTime: apiTimer.elapsed(),
        error: 'Permission denied',
      });
      return NextResponse.json(
        { error: 'テストグループを削除する権限がありません' },
        { status: 403 }
      );
    }

    // ソフトデリート
    const deleted = await prisma.tt_test_groups.update({
      where: { id: groupId },
      data: {
        is_deleted: true,
        updated_by: user.id.toString(),
        updated_at: new Date(),
      },
    });

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/test-groups/${groupId}`,
      userId: user.id,
      statusCode: 200,
      executionTime: apiTimer.elapsed(),
      dataSize: 1,
    });

    return NextResponse.json({ success: true, data: deleted });

  } catch (error) {
    statusCode = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500;

    logAPIEndpoint({
      method: 'DELETE',
      endpoint: `/api/test-groups/${params.groupId}`,
      statusCode,
      executionTime: apiTimer.elapsed(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'テストグループの削除に失敗しました' },
      { status: 500 }
    );
  }
}
```

---

## 2. バリデーションスキーマテンプレート

### ファイル: `/app/(secure)/testGroup/[groupId]/edit/_components/schemas/testGroup-edit-schema.ts`

```typescript
import { z } from 'zod';

// テストグループ編集用のバリデーションスキーマ
export const testGroupEditSchema = z.object({
  oem: z
    .string()
    .min(1, 'OEM は必須です')
    .max(255, 'OEM は 255 文字以内です'),

  model: z
    .string()
    .min(1, '機種は必須です')
    .max(255, '機種は 255 文字以内です'),

  event: z
    .string()
    .max(255, 'イベントは 255 文字以内です')
    .optional()
    .default(''),

  variation: z
    .string()
    .max(255, 'バリエーションは 255 文字以内です')
    .optional()
    .default(''),

  destination: z
    .string()
    .max(255, '仕向は 255 文字以内です')
    .optional()
    .default(''),

  specs: z
    .string()
    .optional()
    .default(''),

  test_startdate: z
    .string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      '開始日の形式が不正です'
    ),

  test_enddate: z
    .string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      '終了日の形式が不正です'
    ),

  ngPlanCount: z
    .coerce
    .number()
    .int('整数である必要があります')
    .min(0, '0 以上である必要があります')
    .max(9999, '9999 以下である必要があります')
    .optional(),

  designerTag: z
    .array(z.string())
    .optional()
    .default([]),

  executerTag: z
    .array(z.string())
    .optional()
    .default([]),

  viewerTag: z
    .array(z.string())
    .optional()
    .default([]),
}).refine(
  (data) => {
    if (!data.test_startdate || !data.test_enddate) return true;
    const startDate = new Date(data.test_startdate);
    const endDate = new Date(data.test_enddate);
    return startDate <= endDate;
  },
  {
    message: '開始日は終了日以前である必要があります',
    path: ['test_startdate'],
  }
);

export type TestGroupEditFormData = z.infer<typeof testGroupEditSchema>;
```

---

## 3. Container コンポーネントテンプレート

### ファイル: `/app/(secure)/testGroup/[groupId]/edit/_components/TestGroupEditFormContainer.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clientLogger from '@/utils/client-logger';
import { testGroupEditSchema, type TestGroupEditFormData } from './schemas/testGroup-edit-schema';
import TestGroupEditForm from './TestGroupEditForm';
import Loading from '@/components/ui/loading';
import Modal from '@/components/ui/modal';

interface TestGroupEditFormContainerProps {
  groupId: string;
}

interface TagOption {
  id: number;
  name: string;
}

interface TestGroupData {
  id: number;
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  test_startdate?: string | null;
  test_enddate?: string | null;
  ng_plan_count: number;
  created_at?: string;
  updated_at?: string;
}

interface TestGroupResponse {
  success: boolean;
  data: TestGroupData;
  tags?: Array<{ id: number; name: string; test_role: number }>;
}

export default function TestGroupEditFormContainer({
  groupId,
}: TestGroupEditFormContainerProps) {
  const router = useRouter();

  // フォーム状態
  const [formData, setFormData] = useState<TestGroupEditFormData>({
    oem: '',
    model: '',
    event: '',
    variation: '',
    destination: '',
    specs: '',
    test_startdate: '',
    test_enddate: '',
    ngPlanCount: undefined,
    designerTag: [],
    executerTag: [],
    viewerTag: [],
  });

  // UI 状態
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });

  // ステップ 1: マウント時にデータ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        clientLogger.debug(
          'TestGroupEditFormContainer',
          '詳細データを取得中',
          { groupId }
        );

        // 詳細データを取得
        const dataResponse = await fetch(`/api/test-groups/${groupId}`);
        if (!dataResponse.ok) {
          throw new Error(`データ取得に失敗しました (${dataResponse.status})`);
        }
        const dataResult: TestGroupResponse = await dataResponse.json();

        // タグリストを取得
        const tagsResponse = await fetch('/api/tags');
        if (!tagsResponse.ok) {
          throw new Error('タグ情報の取得に失敗しました');
        }
        const tagsResult = await tagsResponse.json();

        // フォームに既存値を設定
        const testGroup = dataResult.data;
        const existingTags = dataResult.tags || [];

        setFormData({
          oem: testGroup.oem || '',
          model: testGroup.model || '',
          event: testGroup.event || '',
          variation: testGroup.variation || '',
          destination: testGroup.destination || '',
          specs: testGroup.specs || '',
          test_startdate: testGroup.test_startdate
            ? new Date(testGroup.test_startdate).toISOString().split('T')[0]
            : '',
          test_enddate: testGroup.test_enddate
            ? new Date(testGroup.test_enddate).toISOString().split('T')[0]
            : '',
          ngPlanCount: testGroup.ng_plan_count,
          designerTag: existingTags
            .filter(t => t.test_role === 0)
            .map(t => t.name),
          executerTag: existingTags
            .filter(t => t.test_role === 1)
            .map(t => t.name),
          viewerTag: existingTags
            .filter(t => t.test_role === 2)
            .map(t => t.name),
        });

        setTags(tagsResult.data || []);

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

        setModalState({
          isOpen: true,
          title: 'エラー',
          message: error instanceof Error ? error.message : '詳細情報の取得に失敗しました',
          type: 'error',
        });
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
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);
      setErrors({});

      clientLogger.info(
        'TestGroupEditFormContainer',
        '更新処理を開始',
        {
          groupId,
          fieldsChanged: Object.keys(formData),
        }
      );

      // バリデーション
      const validationResult = testGroupEditSchema.safeParse(formData);
      if (!validationResult.success) {
        const fieldErrors: Record<string, string> = {};
        validationResult.error.errors.forEach(error => {
          const path = error.path[0];
          if (path) {
            fieldErrors[String(path)] = error.message;
          }
        });
        setErrors(fieldErrors);

        clientLogger.warn(
          'TestGroupEditFormContainer',
          'バリデーションエラー',
          { errors: fieldErrors }
        );

        return;
      }

      // タグを tag_id 形式に変換
      const tagsPayload = [
        ...formData.designerTag
          .map(tagName => {
            const tag = tags.find(t => t.name === tagName);
            return tag ? { tag_id: tag.id, test_role: 0 } : null;
          })
          .filter(Boolean) as Array<{ tag_id: number; test_role: number }>,

        ...formData.executerTag
          .map(tagName => {
            const tag = tags.find(t => t.name === tagName);
            return tag ? { tag_id: tag.id, test_role: 1 } : null;
          })
          .filter(Boolean) as Array<{ tag_id: number; test_role: number }>,

        ...formData.viewerTag
          .map(tagName => {
            const tag = tags.find(t => t.name === tagName);
            return tag ? { tag_id: tag.id, test_role: 2 } : null;
          })
          .filter(Boolean) as Array<{ tag_id: number; test_role: number }>,
      ];

      // API リクエスト
      const response = await fetch(`/api/test-groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          tags: tagsPayload,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        clientLogger.warn(
          'TestGroupEditFormContainer',
          '更新エラーが返されました',
          {
            statusCode: response.status,
            error: result.error,
          }
        );

        setModalState({
          isOpen: true,
          title: 'エラー',
          message: result.error || '更新に失敗しました',
          type: 'error',
        });
        return;
      }

      clientLogger.info(
        'TestGroupEditFormContainer',
        '更新処理を完了',
        {
          groupId,
          updateResult: 'success',
        }
      );

      setModalState({
        isOpen: true,
        title: '成功',
        message: 'テストグループを更新しました',
        type: 'success',
      });

      // 2秒後に一覧に戻る
      setTimeout(() => {
        router.push('/testGroup');
      }, 2000);

    } catch (error) {
      clientLogger.error(
        'TestGroupEditFormContainer',
        '更新処理でエラー発生',
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );

      setModalState({
        isOpen: true,
        title: 'エラー',
        message: error instanceof Error ? error.message : '更新に失敗しました',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // UI レンダリング
  if (loading) {
    return <Loading message="詳細情報を取得中..." />;
  }

  return (
    <>
      <TestGroupEditForm
        formData={formData}
        tags={tags}
        errors={errors}
        onSubmit={handleSubmit}
        onChange={handleChange}
        isSubmitting={isSubmitting}
      />

      {modalState.isOpen && (
        <Modal
          title={modalState.title}
          message={modalState.message}
          type={modalState.type}
          onClose={() => {
            setModalState({ ...modalState, isOpen: false });
          }}
        />
      )}
    </>
  );
}
```

---

## 4. フォームコンポーネントテンプレート

### ファイル: `/app/(secure)/testGroup/[groupId]/edit/_components/TestGroupEditForm.tsx`

```typescript
'use client';

import { TestGroupEditFormData } from './schemas/testGroup-edit-schema';
import FormField from '@/components/ui/formField';
import ButtonGroup from '@/components/ui/buttonGroup';

interface TagOption {
  id: number;
  name: string;
}

interface TestGroupEditFormProps {
  formData: TestGroupEditFormData;
  tags: TagOption[];
  errors: Record<string, string>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
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
  const tagOptions = tags.map(tag => ({
    value: tag.name,
    label: tag.name,
  }));

  const formFields = [
    {
      label: 'OEM',
      type: 'text' as const,
      name: 'oem',
      value: formData.oem,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('oem', e.target.value),
      required: true,
      error: errors.oem,
      placeholder: '例：OEM A',
    },
    {
      label: '機種',
      type: 'text' as const,
      name: 'model',
      value: formData.model,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('model', e.target.value),
      required: true,
      error: errors.model,
      placeholder: '例：Model X',
    },
    {
      label: 'イベント',
      type: 'text' as const,
      name: 'event',
      value: formData.event,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('event', e.target.value),
      error: errors.event,
      placeholder: '例：Event A',
    },
    {
      label: 'バリエーション',
      type: 'text' as const,
      name: 'variation',
      value: formData.variation,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('variation', e.target.value),
      error: errors.variation,
      placeholder: '例：Variation 1',
    },
    {
      label: '仕向',
      type: 'text' as const,
      name: 'destination',
      value: formData.destination,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('destination', e.target.value),
      error: errors.destination,
      placeholder: '例：JP, US',
    },
    {
      label: '仕様',
      type: 'text' as const,
      name: 'specs',
      value: formData.specs,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('specs', e.target.value),
      error: errors.specs,
      placeholder: 'テストグループの仕様説明',
    },
    {
      label: '試験開始日',
      type: 'date' as const,
      name: 'test_startdate',
      value: formData.test_startdate,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('test_startdate', e.target.value),
      error: errors.test_startdate,
    },
    {
      label: '試験終了日',
      type: 'date' as const,
      name: 'test_enddate',
      value: formData.test_enddate,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('test_enddate', e.target.value),
      error: errors.test_enddate,
    },
    {
      label: '不具合摘出予定数',
      type: 'number' as const,
      name: 'ngPlanCount',
      value: String(formData.ngPlanCount || ''),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange('ngPlanCount', e.target.value === '' ? undefined : parseInt(e.target.value, 10)),
      error: errors.ngPlanCount,
      min: 0,
      max: 9999,
      placeholder: '0',
    },
    {
      label: '設計者タグ',
      type: 'tag' as const,
      name: 'designerTag',
      value: formData.designerTag,
      onChange: (selectedTags: string[]) =>
        onChange('designerTag', selectedTags),
      error: errors.designerTag,
      options: tagOptions,
    },
    {
      label: '実行者タグ',
      type: 'tag' as const,
      name: 'executerTag',
      value: formData.executerTag,
      onChange: (selectedTags: string[]) =>
        onChange('executerTag', selectedTags),
      error: errors.executerTag,
      options: tagOptions,
    },
    {
      label: '閲覧者タグ',
      type: 'tag' as const,
      name: 'viewerTag',
      value: formData.viewerTag,
      onChange: (selectedTags: string[]) =>
        onChange('viewerTag', selectedTags),
      error: errors.viewerTag,
      options: tagOptions,
    },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-xl font-bold">テストグループを編集</h2>
        <p className="text-sm text-gray-600">必須フィールドは * で表示されています</p>
      </div>

      <div className="space-y-4">
        {formFields.map((field) => (
          <FormField key={field.name} {...field} />
        ))}
      </div>

      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-300 rounded text-red-700">
          {errors.submit}
        </div>
      )}

      <ButtonGroup
        primaryLabel={isSubmitting ? '更新中...' : '更新'}
        secondaryLabel="キャンセル"
        onPrimaryClick={() => {}}
        onSecondaryClick={() => window.history.back()}
        primaryDisabled={isSubmitting}
      />
    </form>
  );
}
```

---

## 5. ページコンポーネントテンプレート

### ファイル: `/app/(secure)/testGroup/[groupId]/edit/page.tsx`

```typescript
import { Suspense } from 'react';
import TestGroupEditFormContainer from './_components/TestGroupEditFormContainer';
import Loading from '@/components/ui/loading';

interface PageParams {
  params: {
    groupId: string;
  };
}

export const metadata = {
  title: 'テストグループ編集',
};

export default function TestGroupEditPage({ params }: PageParams) {
  return (
    <div className="container mx-auto p-6">
      <Suspense fallback={<Loading message="読み込み中..." />}>
        <TestGroupEditFormContainer groupId={params.groupId} />
      </Suspense>
    </div>
  );
}
```

---

## 6. よくあるカスタマイズ例

### 例 1: 特定フィールドのみ編集可能にする

```typescript
// Container コンポーネント内
const handleChange = (field: string, value: any) => {
  // created_by フィールドは変更不可
  if (field === 'created_by') {
    return;
  }

  setFormData(prev => ({
    ...prev,
    [field]: value,
  }));
};
```

### 例 2: 確認ダイアログの追加

```typescript
const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  // 確認ダイアログを表示
  const confirmed = window.confirm(
    'テストグループを更新してよろしいですか？'
  );
  if (!confirmed) {
    return;
  }

  // ... 以下は通常の処理
};
```

### 例 3: 自動保存機能

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    // formData が変更されてから 3 秒後に自動保存
    saveToLocalStorage(formData);
  }, 3000);

  return () => clearTimeout(timer);
}, [formData]);
```

### 例 4: 履歴トラッキング

```typescript
const [changeHistory, setChangeHistory] = useState<Array<{
  timestamp: string;
  field: string;
  oldValue: any;
  newValue: any;
}>>([]);

const handleChange = (field: string, value: any) => {
  const oldValue = formData[field as keyof TestGroupEditFormData];

  setChangeHistory(prev => [...prev, {
    timestamp: new Date().toISOString(),
    field,
    oldValue,
    newValue: value,
  }]);

  setFormData(prev => ({
    ...prev,
    [field]: value,
  }));
};
```

---

## 使用方法

1. **上記のテンプレートをコピー**: 各ファイルのテンプレートをコピー
2. **プロジェクト構造に合わせて調整**: ファイルパスやクラス名を修正
3. **既存コードと比較**: テストグループ作成機能の実装と比較
4. **段階的に実装**: 1つのコンポーネントずつ実装・テスト

---

**このテンプレート集は、LEARNING_GUIDE_TEST_GROUP_EDIT.md と併せて使用してください。**

詳細な説明や学習内容については、メインのガイドドキュメントを参照してください。
