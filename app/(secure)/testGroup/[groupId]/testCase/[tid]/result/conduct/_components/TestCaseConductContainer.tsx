'use client';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import { STATUS_CODES } from '@/constants/statusCodes';
import { apiGet, apiPost } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TestCaseDetailRow } from '../../_components/types/testCase-detail-list-row';
import { TestCaseResultRow, TestResultsData } from '../../_components/types/testCase-result-list-row';
import { TestCaseConduct } from './TestCaseConduct';
import TestTable from './testTable';
import { Modal } from '@/components/ui/modal';

// 判定のバリデーションを行うための型ガード
const isValidJudgment = (value: unknown): value is JudgmentOption => {
  return typeof value === 'string' && Object.values(JUDGMENT_OPTIONS).includes(value as JudgmentOption);
};

const labels = {
  tid: { name: "TID", type: "text" as 'text' },
  firstLayer: { name: "第1層", type: "text" as 'text' },
  secondLayer: { name: "第2層", type: "text" as 'text' },
  thirdLayer: { name: "第3層", type: "text" as 'text' },
  fourthLayer: { name: "第4層", type: "text" as 'text' },
  purpose: { name: "目的", type: "text" as 'text' },
  checkItems: { name: "確認観点", type: "text" as 'text' },
  requestId: { name: "要求ID", type: "text" as 'text' },
  controlSpec: { name: "制御仕様", type: "img" as 'img' },
  dataFlow: { name: "データフロー", type: "img" as 'img' },
  testProcedure: { name: "テスト手順", type: "text" as 'text' }
};

export function TestCaseConductContainer({ groupId, tid }: { groupId: number; tid: string }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [initialTestCaseData, setInitialTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [pastTestCaseData, setPastTestCaseData] = useState<TestCaseResultRow[][]>([]);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNewTestCaseConduct, setShowNewTestCaseConduct] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [apiError, setApiError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resultsWithHistory, setResultsWithHistory] = useState<TestResultsData>({});
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [executorsList, setExecutorsList] = useState<Array<{ id: number; name: string; }>>([]);

  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  if (apiError) throw apiError;
  if (!user) {
    return;
  }
  useEffect(() => {
    const fetchExecutors = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>(`/api/test-groups/${groupId}/permitted-users`);
        const fetchedExecutors = result.data?.map((u: { id: number; name: string; }) => ({
          id: u.id,
          name: u.name,
        })) || [];

        setExecutorsList(fetchedExecutors);
        clientLogger.info('テスト結果登録画面', '実施者取得成功', { count: fetchedExecutors.length });
      } catch (err) {
        clientLogger.error('テスト結果登録画面', '実施者取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        // エラーの場合、少なくとも自分自身は選択できるようにする
        if (user) {
          const fallbackList = [{
            id: user.id,
            name: user.name,
          }];
          setExecutorsList(fallbackList);
        }
      }
    };

    const fetchTestCaseDetail = async () => {
      try {
        clientLogger.info('テストケース結果確認画面', 'テストケース詳細取得開始', { groupId, tid });

        const result = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}`);
        if (!result || !result.success || !result.data || result.data.length === 0) {
          throw new Error('テストケース詳細の取得に失敗しました');
        }

        const testCase = result.data[0] as TestCaseDetailRow;
        setData(testCase);
        setLabelData(labels);

        clientLogger.info('テストケース結果確認画面', 'テストケース詳細取得成功', { tid });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('テストケース結果確認画面', 'テストケース詳細取得失敗', { error: errorMessage });
        setLoadError('テストケース詳細の取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    const fetchTestResults = async () => {
      try {
        clientLogger.info('テストケース結果確認画面', 'テスト結果取得開始', { groupId, tid });

        const data = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}/results`);

        if (!data.success) {
          throw new Error(data.error || 'テスト結果の取得に失敗しました');
        }
        // resultsが無いときAPIエラー
        if (Object.keys(data.results).length === 0 || !data.results) {
          throw new Error(`${STATUS_CODES.NOT_FOUND}:テスト結果がありません`);
        }

        // 履歴付きの結果を保存
        const resultsData = data.results as TestResultsData;
        setResultsWithHistory(resultsData);
        // 初期のテストケースデータを設定
        const initialData = Object.values(resultsData).map((result) => ({
          ...result.latestValidResult,
          result: '',
          softwareVersion: '',
          hardwareVersion: '',
          comparatorVersion: '',
          executionDate: '',
          executor: '',
          evidence: null,
          note: '',
          judgment: "未着手"
        })) as TestCaseResultRow[];
        const hisitoryData = Object.values(resultsData).flatMap((result) =>
          result.allHistory.map((histItem) => ({
            historyCount: histItem.history_count,
            test_case_no: histItem.test_case_no,
            test_case: histItem.test_case,
            expected_value: histItem.expected_value,
            result: histItem.result || '',
            judgment: isValidJudgment(histItem.judgment) ? histItem.judgment : JUDGMENT_OPTIONS.EMPTY,
            softwareVersion: histItem.software_version || '',
            hardwareVersion: histItem.hardware_version || '',
            comparatorVersion: histItem.comparator_version || '',
            executionDate: histItem.execution_date || '',
            executor: histItem.executor || '',
            evidence: histItem.evidence ? [histItem.evidence] : null,
            note: histItem.note || '',
          }))
        ) as TestCaseResultRow[];
        // historyCount毎にグルーピング
        const groupedHistoryData = hisitoryData.reduce((acc, item) => {
          const historyCount = item.historyCount ?? 0; // historyCountがundefinedの場合は0を使用
          if (!acc[historyCount]) {
            acc[historyCount] = [];
          }
          acc[historyCount].push(item);
          return acc;
        }, [] as TestCaseResultRow[][]).filter(group => group.length > 0);
        setPastTestCaseData(groupedHistoryData)
        // 履歴がないかチェック
        const allHistoryCountsZero = Object.values(resultsData).every(result => result.historyCounts.length === 0);
        setShowNewTestCaseConduct(allHistoryCountsZero);
        setButtonDisabled(allHistoryCountsZero);
        setInitialTestCaseData(initialData);

        // 追加: 実行者リストに結果の実行者を含める
        const resultExecutors = Object.values(resultsData).flatMap(result =>
          result.allHistory.map(histItem => ({
            id: histItem.executor_id ?? Math.random(), // 0以上1未満の小数を振る
            name: histItem.executor ?? ''
          }))
        ).filter((executor, index, self) =>
          executor.id && self.findIndex(e => e.id === executor.id) === index
        ).map(executor => ({
          id: typeof executor.id === 'number' ? executor.id : Math.random(),
          name: typeof executor.name === 'string' ? executor.name : ''
        }));
        // 重複を削除
        const uniqueExecutorsList = resultExecutors.filter((executor, index, self) =>
          index === self.findIndex((e) => e.name === executor.name)
        ).filter((e) => e.name !== '');
        setExecutorsList(prev => [...prev, ...uniqueExecutorsList]);

        clientLogger.info('テストケース結果確認画面', 'テスト結果取得成功', { tid, count: Object.keys(resultsData).length });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('テストケース結果確認画面', 'テスト結果取得失敗', { error: errorMessage });
        setLoadError('テスト結果の取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };
    fetchExecutors();
    fetchTestCaseDetail();
    fetchTestResults();
  }, [groupId, tid, user]);

  const handleShowTestTable = () => {
    setShowNewTestCaseConduct(true);
    setButtonDisabled(true);
  };

  const toggleSection = (historyCount: number) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(historyCount)) {
        newSet.delete(historyCount);
      } else {
        newSet.add(historyCount);
      }
      return newSet;
    });
  };
  const handleSubmit = async () => {
    clientLogger.info('テスト結果登録画面', '登録ボタン押下');
    setErrors({});
    setIsLoading(true);
    // API呼び出し
    try {
      // 再実施入力欄追加時のみ新規入力の結果を整形
      let newTestResultData;
      if (showNewTestCaseConduct) {
        newTestResultData = {
          historyCount: pastTestCaseData.length + 1,
          testResult: initialTestCaseData.map(item => ({
            test_case_no: item.test_case_no,
            test_case: item.test_case,
            expected_value: item.expected_value,
            result: item.result || '',
            judgment: item.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
            softwareVersion: item.softwareVersion || '',
            hardwareVersion: item.hardwareVersion || '',
            comparatorVersion: item.comparatorVersion || '',
            executionDate: item.executionDate || '',
            executor: item.executor || '',
            evidence: item.evidence || [],
            note: item.note || '',
          }))
        };
      }
      // 履歴の結果を整形
      const historyDataList = pastTestCaseData.map((historyData, index) => ({
        historyCount: index + 1,
        testResult: historyData.map(item => ({
          test_case_no: item.test_case_no,
          test_case: item.test_case,
          expected_value: item.expected_value,
          result: item.result || '',
          judgment: item.judgment || JUDGMENT_OPTIONS.UNTOUCHED,
          softwareVersion: item.softwareVersion || '',
          hardwareVersion: item.hardwareVersion || '',
          comparatorVersion: item.comparatorVersion || '',
          executionDate: item.executionDate || '',
          executor: item.executor || '',
          evidence: item.evidence || [],
          note: item.note || '',
        }))
      }));
      // 整形した新規入力の結果と履歴の結果からAPIリクエストを作成。
      const combinedFormData = {
        newTestResultData,
        historyDataList
      }

      clientLogger.info('テスト結果登録画面', 'テスト結果登録開始', { combinedFormData });
      // ここでAPI呼び出しを行う
      const response = await apiPost<any>(`/api/test-groups/${groupId}/cases/${tid}/results`, combinedFormData);

      if (response.success) {
        clientLogger.info('テスト結果登録画面', 'テスト結果登録成功', { tid: tid });
        setModalMessage('テスト結果を登録しました');
        setIsModalOpen(true);
        setTimeout(() => {
          router.push(`/testGroup/${groupId}/testCase/${tid}/result`);
        }, 1500);
      } else {
        clientLogger.error('テストケース結果登録画面', 'テストケース結果登録失敗', { error: response.error });
        setModalMessage('テストケース結果登録に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('テストケース結果登録画面', 'テストケース結果登録エラー', { error });
      setModalMessage('テストケース結果登録に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  const handleCancel = () => {
    router.back();
  };

  return (
    <div className='space-y-4'>
      <h1 className="text-lg font-bold">テスト情報</h1>
      {data ? (
        <>
          <div>
            <div className="w-full">
              <TestCaseConduct labels={labelData} values={{
                tid: data.tid,
                firstLayer: data.first_layer,
                secondLayer: data.second_layer,
                thirdLayer: data.third_layer,
                fourthLayer: data.fourth_layer,
                purpose: data.purpose,
                checkItems: data.check_items,
                requestId: data.request_id,
                controlSpec: data.control_spec,
                dataFlow: data.data_flow,
                testProcedure: data.test_procedure
              }} />
            </div>
          </div>
          <div className="w-full flex items-end justify-end">
            <Button type="submit" onClick={handleShowTestTable} className="w-36" disabled={buttonDisabled}>
              再実施入力欄追加
            </Button>
          </div>
        </>
      ) : (
        <Loading
          isLoading={true}
          message={"データ読み込み中..."}
          size="md"
        />
      )}
      <div className="space-y-2">
        <h1 className="text-lg font-bold">テスト結果</h1>
        <div className="space-y-4">
          {isLoading ? (
            <Loading isLoading={isLoading} message="データ読み込み中..." size="md" />
          ) : (
            <>
              <>
                {showNewTestCaseConduct &&
                  <TestTable
                    groupId={groupId}
                    tid={tid}
                    data={initialTestCaseData}
                    setData={setInitialTestCaseData}
                    userName={user?.name || ''}
                    executorsList={[{ id: user.id, name: user.name }]}
                  />}
                {Object.entries(pastTestCaseData).length > 0 &&
                  (() => {

                    // セクションをレンダリング
                    return pastTestCaseData.slice().reverse().map((_row, index) => {
                      const historyCount = pastTestCaseData.length - index;
                      const sectionLabel = historyCount === 0 ? '最新' : `${historyCount}回目`;
                      const isExpanded = expandedSections.has(historyCount);
                      return (
                        <div key={index}>
                          <div className="border rounded-lg p-4 bg-gray-50">
                            <button
                              onClick={() => historyCount !== 0 && toggleSection(historyCount)}
                              className={`w-full text-left flex items-center justify-between ${historyCount !== 0 ? 'hover:bg-gray-100' : ''} rounded px-2 py-1 transition-colors`}
                              disabled={historyCount === 0}
                            >
                              <h2 className="text-md font-semibold text-gray-700">{sectionLabel}</h2>
                              {historyCount !== 0 && (
                                <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="overflow-x-auto mt-4">
                                <TestTable
                                  groupId={groupId}
                                  tid={tid}
                                  data={pastTestCaseData[pastTestCaseData.length - 1 - index]} // 二次元配列を一次元配列に変換して渡す
                                  setData={(newData) => setPastTestCaseData(prevState => {
                                    const newState = [...prevState];
                                    if (typeof newData === 'function') {
                                      newState[pastTestCaseData.length - 1 - index] = newData(newState[pastTestCaseData.length - 1 - index]);
                                    } else {
                                      newState[pastTestCaseData.length - 1 - index] = newData;
                                    }
                                    return newState;
                                  })} // 新しいデータを二次元配列として設定
                                  userName={user?.name || ''}
                                  executorsList={executorsList} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()
                }
              </>
              <div className="flex justify-center space-x-4">
                <Button type="submit" onClick={handleSubmit}>登録</Button>
                <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
              </div>
            </>
          )}
        </div>
      </div>
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
      {/* 登録結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div >
  );
}