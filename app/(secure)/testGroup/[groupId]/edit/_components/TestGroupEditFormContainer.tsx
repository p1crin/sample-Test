'use client';
import { useState, useEffect } from 'react';
import clientLogger from '@/utils/client-logger';
import Loading from '@/components/ui/loading';
import { testGroupEditSchema } from './schemas/testGroup-edit-schema';
import { TestGroupEditForm } from './TestGroupEditForm';
import type { TestGroupEditChangeData } from './TestGroupEditForm';
import { TestGroupFormData } from '@/app/(secure)/_components/types/testGroup-list-row';

type TestGroupEditFormContainerProps = {
  groupId: number;
};

export function TestGroupEditFormContainer({ groupId }: TestGroupEditFormContainerProps) {
  // 診断: クライアント側ログが動作していることを確認
  clientLogger.info('TestGroupEditFormContainer', 'Component mounted - client-side logging diagnostic', {
    groupId,
    env: process.env.NEXT_PUBLIC_ENABLE_CLIENT_LOGGING
  });

  const [toastOpen, setToastOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 初期データ
  const initialForm: TestGroupFormData = {
    oem: '',
    model: '',
    destination: '',
    event: '',
    variation: '',
    ngPlanCount: '',
    specs: '',
    test_startdate: '',
    test_enddate: '',
    designerTag: [],
    executerTag: [],
    viewerTag: [],
    created_at: '',
    updated_at: ''
  };

  const [form, setForm] = useState<TestGroupFormData>(initialForm);

  const handleClear = () => {
    setForm(initialForm);
  };

  const handleChange = (e: TestGroupEditChangeData) => {
    const { name, value, type } = e.target;

    if (type === 'tag') {
      // タグフィールドの場合は配列として処理
      setForm((prev) => ({
        ...prev,
        [name]: Array.isArray(value) ? value : [],
      }));
    } else {
      // その他のフィールド
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);
    try {
      const result = testGroupEditSchema.safeParse(form);
      if (!result.success) {
        // Zodのエラーを各フィールドごとにまとめる
        const fieldErrors: Record<string, string[]> = {};
        result.error.errors.forEach((err) => {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = [];
          fieldErrors[key].push(err.message);
        });
        setErrors(fieldErrors);
        setToastOpen(false);
        return;
      }

      // タグフィールドからtag_names配列を構築
      const tag_names: Array<{ tag_name: string; test_role: number }> = [];

      if (form.designerTag && form.designerTag.length > 0) {
        form.designerTag.forEach((tag) => {
          tag_names.push({ tag_name: tag, test_role: 0 });
        });
      }

      if (form.executerTag && form.executerTag.length > 0) {
        form.executerTag.forEach((tag) => {
          tag_names.push({ tag_name: tag, test_role: 1 });
        });
      }

      if (form.viewerTag && form.viewerTag.length > 0) {
        form.viewerTag.forEach((tag) => {
          tag_names.push({ tag_name: tag, test_role: 2 });
        });
      }

      const response = await fetch(`/api/test-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oem: form.oem,
          model: form.model,
          event: form.event || undefined,
          variation: form.variation || undefined,
          destination: form.destination || undefined,
          specs: form.specs || undefined,
          test_startdate: form.test_startdate || undefined,
          test_enddate: form.test_enddate || undefined,
          ng_plan_count: form.ngPlanCount ? parseInt(form.ngPlanCount) : undefined,
          tag_names: tag_names.length > 0 ? tag_names : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const testGroupData = await response.json();
      if (!testGroupData.success) {
        throw new Error(testGroupData.error || 'テストグループの更新に失敗しました');
      }
      clientLogger.info('TestGroupEditFormContainer', 'データ保存成功', { groupId });
      setToastOpen(true);
    } catch (err) {
      clientLogger.error('TestGroupEditFormContainer', 'データ保存失敗', {
        error: err instanceof Error ? err.message : String(err),
      });
      setLoadError(err instanceof Error ? err.message : '予期せぬエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const getDataFunc = async () => {
      try {
        clientLogger.info('TestGroupEditFormContainer', 'データ取得開始', { groupId });

        const response = await fetch(`/api/test-groups/${groupId}`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        clientLogger.info('TestGroupEditFormContainer', 'API レスポンス', {
          success: result.success,
          data: result.data,
          tags: result.tags,
          error: result.error
        });

        if (!result.success || !result.data) {
          const errorMsg = result.error || 'データの取得に失敗しました';
          throw new Error(errorMsg);
        }

        // APIレスポンスをフォームデータにマッピング
        const designerTag: string[] = [];
        const executerTag: string[] = [];
        const viewerTag: string[] = [];

        if (result.tags && Array.isArray(result.tags)) {
          result.tags.forEach((tag: { id: number; name: string; test_role: number }) => {
            switch (tag.test_role) {
              case 0:
                designerTag.push(tag.name);
                break;
              case 1:
                executerTag.push(tag.name);
                break;
              case 2:
                viewerTag.push(tag.name);
                break;
            }
          });
        }

        // HTML date inputの日付をフォーマット (YYYY-MM-DD)
        const formatDate = (dateValue: unknown): string => {
          if (!dateValue) return '';
          const dateStr = String(dateValue);
          // 既にYYYY-MM-DD形式の場合はそのまま返す
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
          }
          // タイムスタンプ (ISO形式など) が含まれている場合は日付部分を抽出
          if (dateStr.includes('T')) {
            return dateStr.split('T')[0];
          }
          // スペースがある場合は最初の部分 (日付部分) を取得
          if (dateStr.includes(' ')) {
            return dateStr.split(' ')[0];
          }
          return dateStr;
        };

        const formData: TestGroupFormData = {
          oem: result.data.oem,
          model: result.data.model,
          event: result.data.event || '',
          variation: result.data.variation || '',
          destination: result.data.destination || '',
          specs: result.data.specs || '',
          test_startdate: formatDate(result.data.test_startdate),
          test_enddate: formatDate(result.data.test_enddate),
          ngPlanCount: String(result.data.ng_plan_count || ''),
          designerTag,
          executerTag,
          viewerTag,
          created_at: result.data.created_at,
          updated_at: result.data.updated_at
        };

        clientLogger.info('TestGroupEditFormContainer', 'フォームデータ設定', formData);
        setForm(formData);
        setLoadError(null);
        setIsDataLoaded(true);
        clientLogger.info('TestGroupEditFormContainer', 'データ取得完了');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'データの取得に失敗しました';
        clientLogger.error('TestGroupEditFormContainer', 'データ取得失敗', { error: errorMsg });
        setLoadError(errorMsg);
        setIsDataLoaded(true);
      }
    };

    if (groupId > 0) {
      getDataFunc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // ローディング中の表示
  if (!isDataLoaded) {
    return (
      <Loading
        isLoading={true}
        message="データを読み込み中..."
        size="md"
      />
    );
  }

  return (
    <>
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4" role="alert">
          <p className="text-red-800 font-semibold">エラーが発生しました</p>
          <p className="text-red-600 text-sm mt-1">{loadError}</p>
        </div>
      )}
      {!loadError && (
        <TestGroupEditForm
          form={form}
          errors={errors}
          toastOpen={toastOpen}
          onChange={handleChange}
          onClear={handleClear}
          onSubmit={handleSubmit}
          onToastClose={() => setToastOpen(false)}
        />
      )}
    </>
  );
}
