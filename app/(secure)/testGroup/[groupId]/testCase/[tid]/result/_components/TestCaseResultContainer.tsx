'use client';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState } from 'react';
import { getData, getSampleTestCases } from '../action';
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

export function TestCaseResultContainer({ tid: tid }: { tid: number }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [testCaseData, setTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [firstTestCaseData, setFirstTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [secondTestCaseData, setSecondTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState([false, false]);
  const [apiError, setApiError] = useState<Error | null>(null);

  if (apiError) throw apiError;

  const router = useRouter();
  const pathname = usePathname();

  const user = useSelector((state: RootState) => state.auth.user);
  console.log("user:", user)

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
    { key: 'note', header: '備考欄', isLink: true, isExlink: true, linkPrefix: READMINE_URL },
  ];

  useEffect(() => {
    const getDataFunc = async () => {
      try {
        const testCaseData = await getData({ id: tid });
        if (!testCaseData.success || !testCaseData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testCaseData.error})`);
        }
        setData(testCaseData.data);
        setLabelData(labels);
        clientLogger.info('TestCaseResultContainer', 'データ取得成功', { data: testCaseData.data.tid });
      } catch (err) {
        clientLogger.error('TestCaseResultContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('データの取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const getSampleTestCasesFunc = async () => {
      try {
        const sampleTestCasesResult = await getSampleTestCases();
        if (!sampleTestCasesResult.success || !sampleTestCasesResult.data) {
          throw new Error('サンプルテストケースの取得に失敗しました' + ` (error: ${sampleTestCasesResult.error})`);
        }

        // 1回目、2回目、最新のテストケースに異なる初期値を設定
        const firstTestCases = sampleTestCasesResult.data.slice(0, 7);
        const secondTestCases = sampleTestCasesResult.data.slice(7, 14);
        const latestTestCases = sampleTestCasesResult.data.slice(14, 21);

        setTestCaseData(latestTestCases);
        setFirstTestCaseData(firstTestCases);
        setSecondTestCaseData(secondTestCases);
        clientLogger.info('TestCaseResultContainer', 'サンプルテストケース取得成功');
      } catch (err) {
        clientLogger.error('TestCaseResultContainer', 'サンプルテストケース取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('サンプルテストケースの取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    getDataFunc();
    getSampleTestCasesFunc();
  }, [tid]);

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  };

  const handleShowTestTable = () => {
    router.push(`${pathname}/conduct`);
  };

  const toggleAccordion = (index: number) => {
    setAccordionOpen(prevState => {
      const newState = [...prevState];
      newState[index] = !newState[index];
      return newState;
    });
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
          <DataGrid items={testCaseData} columns={columns}></DataGrid>
        </div>
        <div>
          <button
            className="w-full text-left p-4 border border-gray-200"
            onClick={() => toggleAccordion(0)}
          >
            2回目
          </button>
          {accordionOpen[0] && (
            <div className="p-4 border border-t-0 border-gray-200">
              <DataGrid items={secondTestCaseData} columns={columns}></DataGrid>
            </div>
          )}
        </div>
        <div>
          <button
            className="w-full text-left p-4 border border-gray-200"
            onClick={() => toggleAccordion(1)}
          >
            1回目
          </button>
          {accordionOpen[1] && (
            <div className="p-4 border border-t-0 border-gray-200">
              <DataGrid items={firstTestCaseData} columns={columns}></DataGrid>
            </div>
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