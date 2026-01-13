'use client';
import TestTable from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/_components/testTable';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState, SetStateAction } from 'react';
import { TestCaseConduct } from './TestCaseConduct';
import { TestCaseResultRow } from '../../_components/types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';
import { Button } from '@/components/ui/button';
import { RootState } from '@/stores/store';
import { useSelector } from 'react-redux';
import Loading from '@/components/ui/loading';

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
  const [pastTestCases, setPastTestCases] = useState<TestCaseResultRow[][]>([]);
  const [initialTestCaseData, setInitialTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState<boolean[]>([]);
  const [showNewTestCaseConduct, setShowNewTestCaseConduct] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);

  const user = useSelector((state: RootState) => state.auth.user);
  console.log("user:", user)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // テストケース詳細を取得
        clientLogger.info('TestCaseConductContainer', 'getData Request', { groupId, tid });
        const testCaseResponse = await fetch(`/api/test-groups/${groupId}/cases/${tid}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!testCaseResponse.ok) {
          throw new Error('Failed to fetch test case data');
        }

        const testCaseResult = await testCaseResponse.json();

        if (!testCaseResult.success || !testCaseResult.data || testCaseResult.data.length === 0) {
          throw new Error('Test case not found');
        }

        const testCase = testCaseResult.data[0];

        // controlSpec と dataFlow の最初のファイルパスを取得
        const controlSpecPath = testCase.control_spec && testCase.control_spec.length > 0
          ? testCase.control_spec[0].file_path
          : '';
        const dataFlowPath = testCase.data_flow && testCase.data_flow.length > 0
          ? testCase.data_flow[0].file_path
          : '';

        const testCaseData: TestCaseDetailRow = {
          tid: testCase.tid,
          firstLayer: testCase.first_layer || '',
          secondLayer: testCase.second_layer || '',
          thirdLayer: testCase.third_layer || '',
          fourthLayer: testCase.fourth_layer || '',
          purpose: testCase.purpose || '',
          requestId: testCase.request_id || '',
          checkItems: testCase.check_items || '',
          controlSpec: controlSpecPath,
          dataFlow: dataFlowPath,
          testProcedure: testCase.test_procedure || '',
        };

        setData(testCaseData);
        setLabelData(labels);
        clientLogger.info('TestCaseConductContainer', 'データ取得成功', { tid: testCaseData.tid });
      } catch (err) {
        clientLogger.error('TestCaseConductContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('データの取得に失敗しました');
      }
    };

    const fetchTestResults = async () => {
      try {
        // テスト結果を取得
        clientLogger.info('TestCaseConductContainer', 'getTestResults Request', { groupId, tid });
        const resultsResponse = await fetch(`/api/test-groups/${groupId}/cases/${tid}/results`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!resultsResponse.ok) {
          throw new Error('Failed to fetch test results');
        }

        const resultsData = await resultsResponse.json();

        if (!resultsData.success || !resultsData.results) {
          throw new Error('Test results not found');
        }

        const groupedResults = resultsData.results;

        // テストケース番号順にソート
        const sortedTestCaseNos = Object.keys(groupedResults).sort((a, b) => parseInt(a) - parseInt(b));

        // 最新の結果を取得
        const currentResults: TestCaseResultRow[] = sortedTestCaseNos.map((testCaseNo) => {
          const data = groupedResults[testCaseNo];
          const latest = data.latestValidResult;

          return {
            testCase: latest.test_case || '',
            expectedValue: latest.expected_value || '',
            result: latest.result || '',
            judgment: latest.judgment || '未実施',
            softwareVersion: latest.software_version || '',
            hardwareVersion: latest.hardware_version || '',
            comparatorVersion: latest.comparator_version || '',
            executionDate: latest.execution_date ? new Date(latest.execution_date).toLocaleDateString('ja-JP') : '',
            executor: latest.executor || '',
            evidence: latest.evidence || null,
            note: latest.note || '',
          };
        });

        // 履歴をhistory_count別にグループ化
        const historyCountSet = new Set<number>();
        sortedTestCaseNos.forEach((testCaseNo) => {
          const data = groupedResults[testCaseNo];
          if (data.historyCounts && data.historyCounts.length > 0) {
            data.historyCounts.forEach((count: number) => historyCountSet.add(count));
          }
        });

        const sortedHistoryCounts = Array.from(historyCountSet).sort((a, b) => b - a); // 降順（最新が先頭）

        // 各history_countに対する全テストケースの結果を取得
        const historicalResults: TestCaseResultRow[][] = sortedHistoryCounts.map((historyCount) => {
          return sortedTestCaseNos.map((testCaseNo) => {
            const data = groupedResults[testCaseNo];
            const historyEntry = data.allHistory.find((h: Record<string, unknown>) => h.history_count === historyCount);

            if (historyEntry) {
              return {
                testCase: historyEntry.test_case || '',
                expectedValue: historyEntry.expected_value || '',
                result: historyEntry.result || '',
                judgment: historyEntry.judgment || '',
                softwareVersion: historyEntry.software_version || '',
                hardwareVersion: historyEntry.hardware_version || '',
                comparatorVersion: historyEntry.comparator_version || '',
                executionDate: historyEntry.execution_date
                  ? new Date(historyEntry.execution_date as string).toLocaleDateString('ja-JP')
                  : '',
                executor: historyEntry.executor || '',
                evidence: historyEntry.evidence || null,
                note: historyEntry.note || '',
              };
            } else {
              // 履歴にないテストケースは空の状態で表示
              const latest = data.latestValidResult;
              return {
                testCase: latest.test_case || '',
                expectedValue: latest.expected_value || '',
                result: '',
                judgment: '',
                softwareVersion: '',
                hardwareVersion: '',
                comparatorVersion: '',
                executionDate: '',
                executor: '',
                evidence: null,
                note: '',
              };
            }
          });
        });

        // 履歴データを設定（降順なので最新が先頭）
        setPastTestCases(historicalResults);

        // 現在の結果を初期データとして設定
        setInitialTestCaseData(currentResults);

        // アコーディオンの初期状態を設定（最初のものだけ開く）
        setAccordionOpen(historicalResults.map((_, index) => index === 0));

        clientLogger.info('TestCaseConductContainer', 'テスト結果取得成功', {
          currentCount: currentResults.length,
          historyCount: historicalResults.length
        });
      } catch (err) {
        clientLogger.error('TestCaseConductContainer', 'テスト結果取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('テスト結果の取得に失敗しました');
      }
    };

    fetchData();
    fetchTestResults();
  }, [groupId, tid]);

  const handleSubmit = async () => {
    try {
      // TODO: 実装未完了 - evidenceIdsとdeletedEvidencesの実装が必要
      // 現状は判定以外のデータのみ送信
      const testResults = initialTestCaseData.map((row, index) => ({
        testCaseNo: index,
        result: row.result || '',
        judgment: row.judgment || '',
        softwareVersion: row.softwareVersion || '',
        hardwareVersion: row.hardwareVersion || '',
        comparatorVersion: row.comparatorVersion || '',
        executionDate: row.executionDate || '',
        executor: row.executor || '',
        note: row.note || '',
        evidenceIds: [], // TODO: エビデンスIDの追跡が必要
      }));

      clientLogger.info('TestCaseConductContainer', 'saveData Request', { groupId, tid });

      const response = await fetch(`/api/test-groups/${groupId}/cases/${tid}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testResults,
          deletedEvidences: [], // TODO: 削除されたエビデンスの追跡が必要
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save test results');
      }

      const result = await response.json();

      clientLogger.info('TestCaseConductContainer', '保存成功', { message: result.message });
      alert('テスト結果を保存しました');
      history.back();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存中にエラーが発生しました';
      setLoadError(errorMessage);
      clientLogger.error('TestCaseConductContainer', '保存エラー', { error: errorMessage });
    }
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  };

  const toggleAccordion = (index: number) => {
    setAccordionOpen(prevState => {
      const newState = [...prevState];
      newState[index] = !newState[index];
      return newState;
    });
  };

  const handleShowTestTable = () => {
    setShowNewTestCaseConduct(true);
    setButtonDisabled(true);
  };

  return (
    <div className='space-y-4'>
      <h1 className="text-lg font-bold">テスト情報</h1>
      {data ? (
        <>
          <div>
            <div className="w-full">
              <TestCaseConduct labels={labelData} values={data} />
            </div>
          </div><div className="w-full flex items-end justify-end">
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
          {showNewTestCaseConduct && <TestTable data={initialTestCaseData} setData={setInitialTestCaseData} isPast={false} />}
        </div>
        {pastTestCases.map((historyData, index) => (
          <div key={index}>
            <button
              className="w-full text-left p-4 border border-gray-200"
              onClick={() => toggleAccordion(index)}
            >
              {pastTestCases.length - index}回目
            </button>
            {accordionOpen[index] && (
              <div className="p-4 border border-t-0 border-gray-200">
                <TestTable data={historyData} setData={(newData: SetStateAction<TestCaseResultRow[]>) => {
                  const newPastTestCases = [...pastTestCases];
                  newPastTestCases[index] = newData as TestCaseResultRow[];
                  setPastTestCases(newPastTestCases);
                }} isPast={true} />
              </div>
            )}
          </div>
        ))}
      </div>
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
      <div className="flex justify-center space-x-4">
        <Button type="submit" onClick={handleSubmit} >登録</Button>
        <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
      </div>
    </div>
  );
}