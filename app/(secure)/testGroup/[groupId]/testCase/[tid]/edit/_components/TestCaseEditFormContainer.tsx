'use client';
import { useState, useEffect } from 'react';
import clientLogger from '@/utils/client-logger';
import { testCaseEditSchema } from './schemas/testCase-edit-schema';
import { TestCaseEditForm } from './TestCaseEditForm';
import type { TestCaseEditChangeData, TestCaseEditFormState } from './TestCaseEditForm';
import { getData, saveData } from '../action';

type TestCaseEditFormContainerProps = {
  id: number;
};

export function TestCaseEditFormContainer({ id }: TestCaseEditFormContainerProps) {
  const [toastOpen, setToastOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  // 初期データ
  const initialForm: TestCaseEditFormState = {
    tid: '',
    firstLayer: '',
    secondLayer: '',
    thirdLayer: '',
    fourthLayer: '',
    purpose: '',
    checkItems: '',
    createdAt: '',
    updatedAt: '',
    requestId: '',
    chartData: {
      okCount: 0,
      ngCount: 0,
      notStartCount: 0,
      excludedCount: 0
    },
  };

  const [form, setForm] = useState<TestCaseEditFormState>(initialForm);

  const handleClear = () => {
    setForm(initialForm);
  };

  const handleChange = (e: TestCaseEditChangeData) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    try {
      const result = testCaseEditSchema.safeParse(form);
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
          const testCaseData = await saveData(form);
          if (!testCaseData.success || !testCaseData.data) {
            throw new Error('データの取得に失敗しました' + ` (error: ${testCaseData.error})`);
          }
          clientLogger.info('TestCaseEditFormContainer', 'データ保存成功');
        } catch (err) {
          clientLogger.error('TestCaseEditFormContainer', 'データ保存失敗', {
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
        const testCaseData = await getData({ id: id });
        if (!testCaseData.success || !testCaseData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testCaseData.error})`);
        }
        setForm(testCaseData.data);
        clientLogger.info('TestCaseEditFormContainer', 'データ取得成功', { data: testCaseData.data.tid });
      } catch (err) {
        clientLogger.error('TestCaseEditFormContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    getDataFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      <TestCaseEditForm
        id={id}
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
