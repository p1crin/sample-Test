'use client';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RootState } from '@/stores/store';
import { useSelector } from 'react-redux';
import Loading from '@/app/loading';
import { useRouter } from 'next/navigation';
import { TestCaseConduct } from './TestCaseConduct';
import TestTable from '@/components/ui/testTable';
import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';

interface HistoryGroup {
  historyCount: number;
  isLatest: boolean;
  items: TestCaseResultRow[];
}

interface ConductData {
  success: boolean;
  testCase: Record<string, unknown>;
  historyGroups: HistoryGroup[];
  error?: string;
}

type FormDataByGroup = Record<number, TestCaseResultRow[]>;

export function TestCaseConductContainer({
  groupId,
  tid,
}: {
  groupId: number;
  tid: string;
}) {
  const [conductData, setConductData] = useState<ConductData | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(
    new Set()
  );
  const [formData, setFormData] = useState<FormDataByGroup>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<Error | null>(null);

  if (apiError) throw apiError;

  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);

  useEffect(() => {
    const fetchConductData = async () => {
      try {
        clientLogger.info('TestCaseConductContainer', 'conduct-data取得開始', {
          groupId,
          tid,
        });

        const response = await fetch(
          `/api/test-groups/${groupId}/cases/${tid}/conduct-data`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = (await response.json()) as ConductData;

        if (!data.success || !data.historyGroups) {
          throw new Error(data.error || 'conduct-data取得に失敗しました');
        }

        setConductData(data);

        // Initialize expanded groups: only the first group (most recent execution)
        if (data.historyGroups.length > 0) {
          setExpandedGroups(new Set([data.historyGroups[0].historyCount]));
        }

        // Initialize form data from all history groups
        const initialFormData: FormDataByGroup = {};
        for (const group of data.historyGroups) {
          initialFormData[group.historyCount] = group.items.map((item) => ({
            ...item,
            // Ensure all fields are properly initialized
            result: item.result || '',
            judgment: item.judgment || '',
            softwareVersion: item.softwareVersion || '',
            hardwareVersion: item.hardwareVersion || '',
            comparatorVersion: item.comparatorVersion || '',
            executionDate: item.executionDate || '',
            executor: item.executor || user?.name || '',
            note: item.note || '',
            evidence: null,
          }));
        }
        setFormData(initialFormData);

        clientLogger.info('TestCaseConductContainer', 'conduct-data取得成功', {
          tid,
          groupCount: data.historyGroups.length,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        clientLogger.error('TestCaseConductContainer', 'conduct-data取得失敗', {
          error: errorMessage,
        });
        setLoadError('conduct-data取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    fetchConductData();
  }, [groupId, tid, user?.name]);

  const toggleGroup = (historyCount: number) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(historyCount)) {
        newSet.delete(historyCount);
      } else {
        newSet.add(historyCount);
      }
      return newSet;
    });
  };

  const handleGroupDataChange = (
    historyCount: number,
    newData: TestCaseResultRow[]
  ) => {
    setFormData((prev) => ({
      ...prev,
      [historyCount]: newData,
    }));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // Flatten form data from all groups and prepare submission
      const results: Array<TestCaseResultRow & { action: string }> = [];
      for (const group of conductData!.historyGroups) {
        const groupData = formData[group.historyCount];
        if (groupData) {
          for (const item of groupData) {
            results.push({
              ...item,
              action: 'update',
            });
          }
        }
      }

      clientLogger.info('TestCaseConductContainer', 'テスト結果登録開始', {
        groupId,
        tid,
        count: results.length,
      });

      const response = await fetch(
        `/api/test-groups/${groupId}/cases/${tid}/conduct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ results }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'テスト結果登録に失敗しました');
      }

      clientLogger.info(
        'TestCaseConductContainer',
        'テスト結果登録成功',
        { tid }
      );

      // Redirect back to result page
      router.back();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      clientLogger.error('TestCaseConductContainer', 'テスト結果登録失敗', {
        error: errorMessage,
      });
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (!conductData) {
    return <Loading />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">テスト情報</h1>
      <div className="w-full">
        <TestCaseConduct values={conductData.testCase} />
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-bold">テスト結果</h1>
        <div className="space-y-4">
          {conductData.historyGroups.map((group) => (
              <div key={group.historyCount} className="border rounded-lg p-4 bg-gray-50">
                <button
                  onClick={() => toggleGroup(group.historyCount)}
                  className="w-full text-left flex items-center justify-between px-2 py-1 rounded transition-colors hover:bg-gray-100"
                >
                  <h2 className="text-md font-semibold text-gray-700">
                    {group.historyCount}回目
                  </h2>
                  <span className="text-xl">
                    {expandedGroups.has(group.historyCount) ? '▼' : '▶'}
                  </span>
                </button>

                {expandedGroups.has(group.historyCount) && formData[group.historyCount] && (
                  <div className="mt-4">
                    <TestTable
                      data={formData[group.historyCount]}
                      setData={(newDataOrUpdater) => {
                        if (typeof newDataOrUpdater === 'function') {
                          handleGroupDataChange(
                            group.historyCount,
                            newDataOrUpdater(formData[group.historyCount] || [])
                          );
                        } else {
                          handleGroupDataChange(group.historyCount, newDataOrUpdater);
                        }
                      }}
                      isPast={true}
                    />
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}

      {submitError && (
        <div className="text-red-500 mt-4" role="alert">
          {submitError}
        </div>
      )}

      <div className="flex justify-center space-x-4">
        <Button type="submit" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? '登録中...' : '登録'}
        </Button>
        <Button
          type="button"
          onClick={handleCancel}
          className="bg-gray-500 hover:bg-gray-400"
          disabled={isSubmitting}
        >
          戻る
        </Button>
      </div>
    </div>
  );
}
