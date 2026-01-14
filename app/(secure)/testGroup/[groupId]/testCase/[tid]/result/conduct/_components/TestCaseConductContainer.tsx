'use client';
import TestTable from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/_components/testTable';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState, SetStateAction } from 'react';
import { TestCaseConduct } from './TestCaseConduct';
import { TestCaseResultRow } from '../../_components/types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import Loading from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import { useRouter } from 'next/navigation';

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
  const [newTestCaseData, setNewTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState<boolean[]>([]);
  const [showNewTestCaseConduct, setShowNewTestCaseConduct] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [deletedEvidences, setDeletedEvidences] = useState<Array<{ testCaseNo: number; historyCount: number; evidenceNo: number }>>([]);
  const [executorsList, setExecutorsList] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const router = useRouter();

  const { data: session } = useSession();
  const user = session?.user;

  const handleEvidenceDeleted = (deletedEvidence: { testCaseNo: number; historyCount: number; evidenceNo: number }) => {
    setDeletedEvidences(prev => [...prev, deletedEvidence]);
  };

  useEffect(() => {
    const fetchExecutors = async () => {
      // userがnullの場合は何もしない
      if (!user) {
        return;
      }

      try {
        // ユーザーロールに応じてAPIエンドポイントを選択
        const userRole = user.user_role === 0 ? 'システム管理者' :
                        user.user_role === 1 ? 'テスト管理者' :
                        '一般';

        let url = '';
        if (userRole === 'システム管理者') {
          // 管理者: 全ユーザーを取得
          url = '/api/users?limit=1000';
        } else if (userRole === 'テスト管理者') {
          // テスト管理者: テストグループに許可されたユーザーを取得
          url = `/api/test-groups/${groupId}/permitted-users`;
        } else {
          // 一般ユーザー: 自分自身のみ
          const selfList = [{
            id: user.id,
            name: user.name,
            email: user.email || '',
          }];
          setExecutorsList(selfList);
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch executors');
        }

        const result = await response.json();
        const fetchedExecutors = result.data?.map((u: { id: number; name: string; email: string }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })) || [];

        setExecutorsList(fetchedExecutors);
        clientLogger.info('TestCaseConductContainer', 'Executors fetched', { count: fetchedExecutors.length });
      } catch (err) {
        clientLogger.error('TestCaseConductContainer', 'Failed to fetch executors', {
          error: err instanceof Error ? err.message : String(err),
        });
        // エラーの場合、少なくとも自分自身は選択できるようにする
        if (user) {
          const fallbackList = [{
            id: user.id,
            name: user.name,
            email: user.email || '',
          }];
          setExecutorsList(fallbackList);
        }
      }
    };

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

          // エビデンスデータを適切な形式に変換
          let evidence = null;
          if (latest.evidence && typeof latest.evidence === 'string') {
            // エビデンスパスがある場合
            evidence = [{
              id: `evidence_${testCaseNo}`,
              name: latest.evidence.split('/').pop() || 'evidence',
              evidencePath: latest.evidence,
            }];
          }

          return {
            testCaseNo: parseInt(testCaseNo.toString(), 10),
            testCase: latest.test_case || '',
            expectedValue: latest.expected_value || '',
            result: latest.result || '',
            judgment: latest.judgment || '未実施',
            softwareVersion: latest.software_version || '',
            hardwareVersion: latest.hardware_version || '',
            comparatorVersion: latest.comparator_version || '',
            executionDate: latest.execution_date ? new Date(latest.execution_date).toLocaleDateString('ja-JP') : '',
            executor: latest.executor || '',
            evidence: evidence,
            note: latest.note || '',
            isTarget: latest.is_target !== false, // is_targetがfalseの場合のみfalse、それ以外はtrue
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
              // エビデンスデータを適切な形式に変換
              let evidence = null;
              if (historyEntry.evidence && typeof historyEntry.evidence === 'string') {
                evidence = [{
                  id: `evidence_${testCaseNo}_${historyCount}`,
                  name: (historyEntry.evidence as string).split('/').pop() || 'evidence',
                  evidencePath: historyEntry.evidence as string,
                  testCaseNo: parseInt(testCaseNo.toString(), 10),
                  historyCount: historyCount,
                }];
              }

              return {
                testCaseNo: parseInt(testCaseNo.toString(), 10),
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
                evidence: evidence,
                note: historyEntry.note || '',
                historyCount: historyCount,
                isTarget: historyEntry.is_target !== false, // is_targetがfalseの場合のみfalse、それ以外はtrue
              };
            } else {
              // 履歴にないテストケースは空の状態で表示
              const latest = data.latestValidResult;
              return {
                testCaseNo: parseInt(testCaseNo.toString(), 10),
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
                isTarget: latest.is_target !== false, // is_targetがfalseの場合のみfalse、それ以外はtrue
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

    fetchExecutors();
    fetchData();
    fetchTestResults();
  }, [groupId, tid, user]);

  const handleSubmit = async () => {
    try {
      // バリデーション：エビデンスと備考以外は必須
      const validationErrors: string[] = [];
      newTestCaseData.forEach((row) => {
        // is_target=falseの場合はバリデーションスキップ
        if (row.isTarget === false) return;

        const errors: string[] = [];
        if (!row.result || row.result.trim() === '') errors.push('結果');
        if (!row.judgment || row.judgment.trim() === '') errors.push('判定');
        if (!row.softwareVersion || row.softwareVersion.trim() === '') errors.push('ソフトウェアバージョン');
        if (!row.hardwareVersion || row.hardwareVersion.trim() === '') errors.push('ハードウェアバージョン');
        if (!row.comparatorVersion || row.comparatorVersion.trim() === '') errors.push('比較器バージョン');
        if (!row.executionDate || row.executionDate.trim() === '') errors.push('実施日');
        if (!row.executor || row.executor.trim() === '') errors.push('実施者');

        if (errors.length > 0) {
          validationErrors.push(`テストケース番号 ${row.testCaseNo}: ${errors.join('、')}が未入力です`);
        }
      });

      if (validationErrors.length > 0) {
        setModalMessage('入力エラー:\n' + validationErrors.join('\n'));
        setIsModalOpen(true);
        return;
      }

      // エビデンスIDを含むテスト結果データを作成（is_target=falseの行は除外）
      const testResults = newTestCaseData
        .filter(row => row.isTarget !== false)
        .map((row) => {
          // アップロード済みのエビデンスID（データベースに既に存在）を抽出
          const evidenceIds = row.evidence
            ?.filter(e => e.evidenceId !== undefined)
            .map(e => e.evidenceId as number) || [];

          // 新規アップロード済みエビデンス（データベース未登録、historyCount=0でアップロードされたファイル）を抽出
          const pendingEvidences = row.evidence
            ?.filter(e => e.evidenceId === undefined && e.evidencePath)
            .map(e => ({
              evidenceNo: e.evidenceNo || 0,
              evidenceName: e.name,
              evidencePath: e.evidencePath as string,
            })) || [];

          return {
            testCaseNo: row.testCaseNo,
            result: row.result || '',
            judgment: row.judgment || '',
            softwareVersion: row.softwareVersion || '',
            hardwareVersion: row.hardwareVersion || '',
            comparatorVersion: row.comparatorVersion || '',
            executionDate: row.executionDate || '',
            executor: row.executor || '',
            note: row.note || '',
            evidenceIds: evidenceIds,
            pendingEvidences: pendingEvidences,
          };
        });

      clientLogger.info('TestCaseConductContainer', 'saveData Request', { groupId, tid, deletedEvidencesCount: deletedEvidences.length });

      const response = await fetch(`/api/test-groups/${groupId}/cases/${tid}/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testResults,
          deletedEvidences: deletedEvidences,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save test results');
      }

      const result = await response.json();

      clientLogger.info('TestCaseConductContainer', '保存成功', { message: result.message });
      setModalMessage('テスト結果を保存しました');
      setIsModalOpen(true);
      setTimeout(() => {
        router.back();
      }, 1500); // 1.5秒後に前の画面に戻る
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '保存中にエラーが発生しました';
      setModalMessage(errorMessage);
      setIsModalOpen(true);
      clientLogger.error('TestCaseConductContainer', '保存エラー', { error: errorMessage });
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const toggleAccordion = (index: number) => {
    setAccordionOpen(prevState => {
      const newState = [...prevState];
      newState[index] = !newState[index];
      return newState;
    });
  };

  const handleShowTestTable = () => {
    // まっさらな状態のデータを作成（テストケース番号、テストケース、期待値、is_targetのみ保持）
    const emptyData: TestCaseResultRow[] = initialTestCaseData.map((row) => ({
      testCaseNo: row.testCaseNo,
      testCase: row.testCase,
      expectedValue: row.expectedValue,
      isTarget: row.isTarget,
      result: '',
      judgment: '',
      softwareVersion: '',
      hardwareVersion: '',
      comparatorVersion: '',
      executionDate: '',
      executor: '',
      evidence: null,
      note: '',
      historyCount: 0,
    }));
    setNewTestCaseData(emptyData);
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
          {showNewTestCaseConduct && (
            <TestTable
              data={newTestCaseData}
              setData={setNewTestCaseData}
              isPast={false}
              groupId={groupId}
              tid={tid}
              onEvidenceDeleted={handleEvidenceDeleted}
              userRole={
                user?.user_role === 0 ? 'システム管理者' :
                user?.user_role === 1 ? 'テスト管理者' :
                '一般'
              }
              userId={user?.id || 0}
              userName={user?.name || ''}
              executorsList={executorsList}
            />
          )}
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
                <TestTable
                  data={historyData}
                  setData={(newData: SetStateAction<TestCaseResultRow[]>) => {
                    const newPastTestCases = [...pastTestCases];
                    newPastTestCases[index] = newData as TestCaseResultRow[];
                    setPastTestCases(newPastTestCases);
                  }}
                  isPast={true}
                  groupId={groupId}
                  tid={tid}
                  onEvidenceDeleted={handleEvidenceDeleted}
                  userRole={
                    user?.user_role === 0 ? 'システム管理者' :
                    user?.user_role === 1 ? 'テスト管理者' :
                    '一般'
                  }
                  userId={user?.id || 0}
                  userName={user?.name || ''}
                  executorsList={executorsList}
                />
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

      {/* 結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8 whitespace-pre-wrap">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}