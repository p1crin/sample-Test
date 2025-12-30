'use client';
import { useState, useEffect } from 'react';
import clientLogger from '@/utils/client-logger';
import { testGroupCopySchema } from './schemas/testGroup-copy-schema';
import { TestGroupCopyForm } from './TestGroupCopyForm';
import type { TestGroupCopyChangeData, TestGroupCopyFormState } from './TestGroupCopyForm';
import { getData, saveData } from '../action';

type TestGroupCopyFormContainerProps = {
  testGroupId: number;
};

export function TestGroupCopyFormContainer({ testGroupId }: TestGroupCopyFormContainerProps) {
  const [toastOpen, setToastOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // 初期データ
  const initialForm: TestGroupCopyFormState = {
    testGroupId: 1,
    oem: '',
    model: '',
    destination: '',
    event: '',
    variation: '',
    specs: '',
    testDatespan: '',
    ngPlanCount: ''
  };

  const [form, setForm] = useState<TestGroupCopyFormState>(initialForm);

  const handleClear = () => {
    setForm(initialForm);
  };

  const handleChange = (e: TestGroupCopyChangeData) => {
    const target = e.target as unknown as HTMLInputElement;
    const { name, value, type } = target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    try {
      const result = testGroupCopySchema.safeParse(form);
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

      const saveDataFunc = async () => {
        try {
          const testGroupData = await saveData(form);
          if (!testGroupData.success || !testGroupData.data) {
            throw new Error('データの取得に失敗しました' + ` (error: ${testGroupData.error})`);
          }
          clientLogger.info('TestGroupCopyFormContainer', 'データ保存成功');
        } catch (err) {
          clientLogger.error('TestGroupCopyFormContainer', 'データ保存失敗', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };
      saveDataFunc();

      setToastOpen(true);
    } catch {
      setLoadError('送信時に予期せぬエラーが発生しました');
    }
  };

  useEffect(() => {
    const getDataFunc = async () => {
      try {
        const testGroupData = await getData({ testGroupId: testGroupId });
        if (!testGroupData.success || !testGroupData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testGroupData.error})`);
        }
        setForm(testGroupData.data);
        clientLogger.info('TestGroupCopyFormContainer', 'データ取得成功', { data: testGroupData.data.testGroupId });
      } catch (err) {
        clientLogger.error('TestGroupCopyFormContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    getDataFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      <TestGroupCopyForm
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
