'use client';
import { Column, DataGrid } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { JUDGMENT_OPTIONS, JudgmentOption, READMINE_URL } from '@/constants/constants';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { TestCaseResult } from './TestCaseResult';
import { ResultWithHistory, TestCaseResultRow, TestResultsData } from './types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';
import { formatDateJST } from '@/utils/date-formatter';

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



export function TestCaseResultContainer({ groupId, tid }: { groupId: number; tid: string }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [resultsWithHistory, setResultsWithHistory] = useState<TestResultsData>({});
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  if (apiError) throw apiError;

  const router = useRouter();

  const columns: Column<TestCaseResultRow>[] = [
    { key: 'test_case_no', header: 'No' },
    { key: 'test_case', header: 'テストケース' },
    { key: 'expected_value', header: '期待値' },
    { key: 'result', header: '結果' },
    { key: 'judgment', header: '判定' },
    { key: 'softwareVersion', header: 'ソフトVer.' },
    { key: 'hardwareVersion', header: 'ハードVer.' },
    { key: 'comparatorVersion', header: 'コンパラVer.' },
    { key: 'executionDate', header: '実施日' },
    { key: 'executor', header: '実施者' },
    { key: 'evidence', header: 'エビデンス', isImg: true },
    { key: 'note', header: '備考欄', isLink: true, isExlink: true, linkPrefix: READMINE_URL, linkPattern: /#\d+/g },
  ];

  useEffect(() => {
    const fetchTestCaseDetail = async () => {
      try {
        clientLogger.info('テストケース結果確認画面', 'テストケース詳細取得開始', { groupId, tid });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}`);

        if (!result || !result.success || !result.data) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}/results`);

        if (!data.success || !data.results) {
          throw new Error(data.error || 'テスト結果の取得に失敗しました');
        }

        // 履歴付きの結果を保存
        const resultsData = data.results as TestResultsData;
        setResultsWithHistory(resultsData);

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

    fetchTestCaseDetail();
    fetchTestResults();
  }, [groupId, tid]);

  const handleCancel = () => {
    router.back();
  };

  const handleShowTestTable = () => {
    router.push(`/testGroup/${groupId}/testCase/${tid}/result/conduct`);
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

  // 結果からスネークケースをキャメルケースに変換して値を取得するヘルパー関数
  const getResultValue = (result: Record<string, unknown>, key: string): unknown => {
    // まずキャメルケースのキーを試す
    if (key in result) {
      return result[key];
    }
    // キャメルケースをスネークケースに変換して再度試す
    const snakeCase = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    return result[snakeCase];
  };

  // レンダリングのために整理されたデータ構造を構築
  const getOrganizedResultsByHistoryCount = useMemo(() => {
    const historyCountsSet = new Set<number>();
    const resultsByHistoryCount: Record<number, Map<string, Record<string, unknown>>> = {};

    // すべての履歴カウントを収集し、データを整理
    Object.entries(resultsWithHistory).forEach(([testCaseNo, data]) => {
      const rwh = data as ResultWithHistory;

      // 最新の有効な結果を追加
      historyCountsSet.add(0);
      if (!resultsByHistoryCount[0]) {
        resultsByHistoryCount[0] = new Map();
      }
      resultsByHistoryCount[0].set(testCaseNo, rwh.latestValidResult);

      // すべての履歴エントリを追加
      rwh.allHistory.forEach((histItem) => {
        const hc = (histItem as Record<string, unknown>).history_count as number;
        historyCountsSet.add(hc);
        if (!resultsByHistoryCount[hc]) {
          resultsByHistoryCount[hc] = new Map();
        }
        resultsByHistoryCount[hc].set(testCaseNo, histItem);
      });
    });

    // 履歴カウントをソート: 0（最新）を最初に、その後降順
    const sortedHistoryCounts = Array.from(historyCountsSet).sort((a, b) => {
      if (a === 0) return -1;
      if (b === 0) return 1;
      return b - a;
    });

    return { sortedHistoryCounts, resultsByHistoryCount };
  }, [resultsWithHistory]);

  return (
    <div className='space-y-4'>
      <h1 className="text-lg font-bold">テスト情報</h1>
      {isLoading ? (
        <Loading isLoading={isLoading} message="データ読み込み中..." size="md" />
      ) : data ? (
        <>
          <div>
            <div className="w-full">
              <TestCaseResult labels={labelData} values={{
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
                testProcedure: data.test_procedure,
              }} />
            </div>
          </div>
          <div className="w-full flex items-end justify-end">
            <Button type="submit" onClick={handleShowTestTable} className="w-24" disabled={Object.entries(resultsWithHistory).length <= 0} >
              結果登録
            </Button>
          </div>
        </>
      ) : (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
      <div className="space-y-2">
        <h1 className="text-lg font-bold">テスト結果</h1>
        <div className="space-y-6">
          {isLoading ? (
            <Loading isLoading={isLoading} message="データ読み込み中..." size="md" />
          ) : Object.entries(resultsWithHistory).length > 0 ? (
            (() => {
              const { sortedHistoryCounts, resultsByHistoryCount } = getOrganizedResultsByHistoryCount;

              // セクションをレンダリング
              return sortedHistoryCounts.map((historyCount) => {
                const sectionLabel = historyCount === 0 ? '最新' : `${historyCount}回目`;
                const testCasesData = resultsByHistoryCount[historyCount];
                const sortedTestCaseNos = Array.from(testCasesData.keys()).sort(
                  (a, b) => parseInt(a, 10) - parseInt(b, 10)
                );
                const isExpanded = expandedSections.has(historyCount);

                // DataGridのアイテムを構築
                const sectionItems: TestCaseResultRow[] = sortedTestCaseNos.map((testCaseNo) => {
                  const result = testCasesData.get(testCaseNo) as Record<string, unknown>;
                  const judgmentValue = getResultValue(result, 'judgment');
                  const isTargetValue = getResultValue(result, 'is_target');
                  const judgment = !isTargetValue
                    ? JUDGMENT_OPTIONS.EXCLUDED
                    : isValidJudgment(judgmentValue)
                      ? judgmentValue
                      : JUDGMENT_OPTIONS.UNTOUCHED;
                  const evidenceValue = getResultValue(result, 'evidence');
                  // evidenceは配列またはnullとして扱う
                  const evidence = Array.isArray(evidenceValue)
                    ? evidenceValue
                    : evidenceValue
                      ? [evidenceValue as string]
                      : null;

                  return {
                    historyCount: historyCount,
                    test_case_no: parseInt(testCaseNo, 10),
                    test_case: (getResultValue(result, 'testCase') as string) || '',
                    expected_value: (getResultValue(result, 'expectedValue') as string) || '',
                    result: (getResultValue(result, 'result') as string) || '',
                    judgment: judgment,
                    softwareVersion: (getResultValue(result, 'softwareVersion') as string) || '',
                    hardwareVersion: (getResultValue(result, 'hardwareVersion') as string) || '',
                    comparatorVersion: (getResultValue(result, 'comparatorVersion') as string) || '',
                    executionDate: formatDateJST((getResultValue(result, 'executionDate')) as string) || '',
                    executor: (getResultValue(result, 'executor') as string) || '',
                    evidence: evidence,
                    note: (getResultValue(result, 'note') as string) || '',
                  };
                });

                return (
                  <div key={historyCount} className="border rounded-lg p-4 bg-gray-50">
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
                        <DataGrid<TestCaseResultRow>
                          items={sectionItems}
                          columns={columns}
                        />
                      </div>
                    )}
                  </div>
                );
              });
            })()
          ) : (
            <div className="text-gray-500 text-center py-8">テスト内容を登録してください</div>
          )}
        </div>
      </div>
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
      <div className="flex justify-center space-x-4">
        <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
      </div>
    </div>
  );
}