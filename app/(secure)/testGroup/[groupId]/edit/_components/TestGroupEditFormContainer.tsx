'use client';
import { useState, useEffect } from 'react';
import clientLogger from '@/utils/client-logger';
import { testGroupEditSchema } from './schemas/testGroup-edit-schema';
import { TestGroupEditForm } from './TestGroupEditForm';
import type { TestGroupEditChangeData, TestGroupEditFormState } from './TestGroupEditForm';
import { getData, saveData } from '../action';

type TestGroupEditFormContainerProps = {
  groupId: number;
};

export function TestGroupEditFormContainer({ groupId }: TestGroupEditFormContainerProps) {
  const [toastOpen, setToastOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 初期データ
  const initialForm: TestGroupEditFormState = {
    oem: '',
    model: '',
    destination: '',
    event: '',
    variation: '',
    ngPlanCount: '',
    specs: '',
    testDatespan: '',
    created_at: '',
    updated_at: ''
  };

  const [form, setForm] = useState<TestGroupEditFormState>(initialForm);

  const handleClear = () => {
    setForm(initialForm);
  };

  const handleChange = (e: TestGroupEditChangeData) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? value === 'true' : value,
    }));
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
        const testGroupData = await getData({ groupId: groupId });
        if (!testGroupData.success || !testGroupData.data) {
          throw new Error(testGroupData.error || 'データの取得に失敗しました');
        }
        setForm(testGroupData.data);
        clientLogger.info('TestGroupEditFormContainer', 'データ取得成功');
      } catch (err) {
        clientLogger.error('TestGroupEditFormContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError(err instanceof Error ? err.message : 'データの取得に失敗しました');
      }
    };
    if (groupId > 0) {
      getDataFunc();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  return (
    <>
      <TestGroupEditForm
        form={form}
        errors={errors}
        toastOpen={toastOpen}
        onChange={handleChange}
        onClear={handleClear}
        onSubmit={handleSubmit}
        onToastClose={() => setToastOpen(false)}
      />
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
    </>
  );
}
