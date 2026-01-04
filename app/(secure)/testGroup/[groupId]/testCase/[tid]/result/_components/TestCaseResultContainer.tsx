'use client';
import clientLogger from '@/utils/client-logger';
import { apiGet } from '@/utils/apiClient';
import { useEffect, useState } from 'react';
import { TestCaseResult } from './TestCaseResult';
import { TestCaseResultRow } from './types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';
import { Button } from '@/components/ui/button';
import { RootState } from '@/stores/store';
import { useSelector } from 'react-redux';
import Loading from '@/app/loading';
import { usePathname, useRouter } from 'next/navigation';
import { Column, DataGrid } from '@/components/datagrid/DataGrid';
import { READMINE_URL } from '@/constants/constants';

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

interface HistoryData {
  historyCount: number;
  results: TestCaseResultRow[];
}

export function TestCaseResultContainer({ groupId, tid }: { groupId: number; tid: string }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [latestTestCaseData, setLatestTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [historiesData, setHistoriesData] = useState<HistoryData[]>([]);
  const [accordionOpen, setAccordionOpen] = useState<{ [key: number]: boolean }>({});
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  const user = useSelector((state: RootState) => state.auth.user);
  console.log("user:", user)

  // note 備考欄のカスタムレンダラー
  const renderNoteCell = (value: unknown, _row: TestCaseResultRow): React.ReactNode => {
    const noteText = String(value || '');
    if (!noteText) return <span></span>;

    // #数字 パターンをリンク化
    const parts = noteText.split(/(#\d+)/);
    return (
      <span>
        {parts.map((part, index) => {
          const match = part.match(/^#(\d+)$/);
          if (match) {
            const ticketId = match[1];
            return (
              <a
                key={index}
                href={`${READMINE_URL}${ticketId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'blue', textDecoration: 'underline' }}
              >
                {part}
              </a>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  const columns: Column<TestCaseResultRow>[] = [
    { key: 'testCase', header: 'テストケース' },
    { key: 'expectedValue', header: '期待値' },
    { key: 'result', header: '結果' },
    { key: 'judgment', header: '判定' },
    { key: 'softwareVersion', header: 'ソフトVer.' },
    { key: 'hardwareVersion', header: 'ハードVer.' },
    { key: 'comparatorVersion', header: 'コンパラVer.' },
    { key: 'executionDate', header: '実施日' },
    { key: 'executor', header: '実施者' },
    { key: 'evidence', header: 'エビデンス', isImg: true },
    { key: 'note', header: '備考欄', render: renderNoteCell },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // テストケース詳細情報を取得
        const detailData = await apiGet<{ success: boolean; data: unknown }>(
          `/api/test-groups/${groupId}/cases/${tid}/detail`
        );

        if (detailData.success && detailData.data) {
          const testCaseData: TestCaseDetailRow = {
            tid: (detailData.data as { tid: string }).tid,
            firstLayer: (detailData.data as { firstLayer: string }).firstLayer,
            secondLayer: (detailData.data as { secondLayer: string }).secondLayer,
            thirdLayer: (detailData.data as { thirdLayer: string }).thirdLayer,
            fourthLayer: (detailData.data as { fourthLayer: string }).fourthLayer,
            purpose: (detailData.data as { purpose: string }).purpose,
            requestId: (detailData.data as { requestId: string }).requestId,
            checkItems: (detailData.data as { checkItems: string }).checkItems,
            controlSpec: (detailData.data as { controlSpec: { id: string }[] }).controlSpec[0]?.id || '',
            dataFlow: (detailData.data as { dataFlow: { id: string }[] }).dataFlow[0]?.id || '',
            testProcedure: (detailData.data as { testProcedure: string }).testProcedure,
          };
          setData(testCaseData);
          setLabelData(labels);
          clientLogger.info('TestCaseResultContainer', 'テスト情報取得成功', { groupId, tid });
        } else {
          throw new Error('テスト情報の取得に失敗しました');
        }
      } catch (err) {
        clientLogger.error('TestCaseResultContainer', 'テスト情報取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('テスト情報の取得に失敗しました');
      }
    };

    const fetchTestResults = async () => {
      try {
        // テスト結果を取得
        const resultsData = await apiGet<{ success: boolean; data: unknown }>(
          `/api/test-groups/${groupId}/cases/${tid}/results`
        );

        if (resultsData.success && resultsData.data) {
          // 最新結果
          setLatestTestCaseData(
            (resultsData.data as { latestResult?: { results: TestCaseResultRow[] } }).latestResult?.results || []
          );
          // 過去の履歴
          setHistoriesData(
            (resultsData.data as { histories: { historyCount: number; results: TestCaseResultRow[] }[] }).histories || []
          );
          clientLogger.info('TestCaseResultContainer', 'テスト結果取得成功', { groupId, tid });
        } else {
          throw new Error('テスト結果の取得に失敗しました');
        }
      } catch (err) {
        clientLogger.error('TestCaseResultContainer', 'テスト結果取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('テスト結果の取得に失敗しました');
      }
    };

    fetchData();
    fetchTestResults();
  }, [groupId, tid]);

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  };

  const handleShowTestTable = () => {
    router.push(`${pathname}/conduct`);
  };

  const toggleAccordion = (historyCount: number) => {
    setAccordionOpen(prevState => ({
      ...prevState,
      [historyCount]: !prevState[historyCount],
    }));
  };

  return (
    <div className='space-y-4'>
      <h1 className="text-lg font-bold">テスト情報</h1>
      {data ? (
        <>
          <div>
            <div className="w-full">
              <TestCaseResult labels={labelData} values={data} />
            </div>
          </div>
          <div className="w-full flex items-end justify-end">
            <Button type="submit" onClick={handleShowTestTable} className="w-24">
              結果登録
            </Button>
          </div>
        </>
      ) : (
        Loading()
      )}
      <div className="space-y-2">
        <h1 className="text-lg font-bold">テスト結果</h1>
        <h1 className="font-bold">最終テスト結果</h1>
        <div>
          <DataGrid items={latestTestCaseData} columns={columns}></DataGrid>
        </div>

        {/* 過去の履歴をアコーディオンで表示 */}
        {historiesData.map((history) => (
          <div key={history.historyCount}>
            <button
              className="w-full text-left p-4 border border-gray-200"
              onClick={() => toggleAccordion(history.historyCount)}
            >
              {history.historyCount}回目
            </button>
            {accordionOpen[history.historyCount] && (
              <div className="p-4 border border-t-0 border-gray-200">
                <DataGrid items={history.results} columns={columns}></DataGrid>
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
        <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
      </div>
    </div>
  );
}