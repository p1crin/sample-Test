'use client';
import { useState, useEffect } from 'react';
import clientLogger from '@/utils/client-logger';
import Loading from '@/components/ui/loading';
import { testGroupEditSchema } from './schemas/testGroup-edit-schema';
import { TestGroupEditForm } from './TestGroupEditForm';
import type { TestGroupEditChangeData } from './TestGroupEditForm';
import { TestGroupFormData } from '@/app/(secure)/_components/types/testGroup-list-row';
import { getData, saveData } from '../action';

type TestGroupEditFormContainerProps = {
  groupId: number;
};

export function TestGroupEditFormContainer({ groupId }: TestGroupEditFormContainerProps) {
  // Diagnostic: Verify client-side logging is working
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

      const testGroupData = await saveData(groupId, form);
      if (!testGroupData.success || !testGroupData.data) {
        throw new Error(testGroupData.error || 'テストグループの更新に失敗しました');
      }
      clientLogger.info('TestGroupEditFormContainer', 'データ保存成功', { groupId: testGroupData.data });
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
        const testGroupData = await getData({ groupId: groupId });

        clientLogger.info('TestGroupEditFormContainer', 'API レスポンス', {
          success: testGroupData.success,
          data: testGroupData.data,
          error: testGroupData.error
        });

        if (!testGroupData.success || !testGroupData.data) {
          const errorMsg = testGroupData.error || 'データの取得に失敗しました';
          throw new Error(errorMsg);
        }

        clientLogger.info('TestGroupEditFormContainer', 'フォームデータ設定', testGroupData.data);
        setForm(testGroupData.data);
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
