'use client';
import TestTable from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/_components/testTable';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState, SetStateAction } from 'react';
import { getData, getSampleInitialTestCases, getSampleTestCases } from '../action';
import { TestCaseConduct } from './TestCaseConduct';
import { TestCaseResultRow } from '../../_components/types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';
import { Button } from '@/components/ui/button';
import { RootState } from '@/stores/store';
import { useSelector } from 'react-redux';
import Loading from '@/app/loading';

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

export function TestCaseConductContainer({ tid: tid }: { tid: number }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [pastTestCases, setPastTestCases] = useState<TestCaseResultRow[][]>([[], []]);
  const [initialTestCaseData, setInitialTestCaseData] = useState<TestCaseResultRow[]>([]);
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accordionOpen, setAccordionOpen] = useState([true, false]);
  const [showNewTestCaseConduct, setShowNewTestCaseConduct] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(false);

  const user = useSelector((state: RootState) => state.auth.user);
  console.log("user:", user)

  useEffect(() => {
    const getDataFunc = async () => {
      try {
        const testCaseData = await getData({ id: tid });
        if (!testCaseData.success || !testCaseData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testCaseData.error})`);
        }
        setData(testCaseData.data);
        setLabelData(labels);
        clientLogger.info('TestCaseConductContainer', 'データ取得成功', { data: testCaseData.data.tid });
      } catch (err) {
        clientLogger.error('TestCaseConductContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('データの取得に失敗しました');
      }
    };

    const getSampleTestCasesFunc = async () => {
      try {
        const sampleTestCasesResult = await getSampleTestCases();
        const sampleInitialTestCases = await getSampleInitialTestCases();
        if (!sampleTestCasesResult.success || !sampleTestCasesResult.data) {
          throw new Error('サンプルテストケースの取得に失敗しました' + ` (error: ${sampleTestCasesResult.error})`);
        }
        if (!sampleInitialTestCases.success || !sampleInitialTestCases.data) {
          throw new Error('サンプル初期値テストケースの取得に失敗しました' + ` (error: ${sampleInitialTestCases.error})`);
        }

        // 1回目、2回目、最新のテストケースに異なる初期値を設定
        const pastTestCases = [
          sampleTestCasesResult.data.slice(0, 7),
          sampleTestCasesResult.data.slice(7, 14)
        ];
        const initialTestCaseData = sampleInitialTestCases.data.slice(0, 7);

        setPastTestCases(pastTestCases);
        setInitialTestCaseData(initialTestCaseData);
        clientLogger.info('TestCaseConductContainer', 'サンプルテストケース取得成功');
      } catch (err) {
        clientLogger.error('TestCaseConductContainer', 'サンプルテストケース取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setLoadError('サンプルテストケースの取得に失敗しました');
      }
    };

    getDataFunc();
    getSampleTestCasesFunc();
  }, [tid]);

  const handleSubmit = () => {
    console.log('完了しました');
    history.back();
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
        Loading()
      )}
      <div className="space-y-2">
        <h1 className="text-lg font-bold">テスト結果</h1>
        <div className="space-y-4">
          {showNewTestCaseConduct && <TestTable data={initialTestCaseData} setData={setInitialTestCaseData} isPast={false} />}
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
              <TestTable data={pastTestCases[1]} setData={(newData: SetStateAction<TestCaseResultRow[]>) => {
                const newPastTestCases = [...pastTestCases];
                newPastTestCases[1] = newData as TestCaseResultRow[];
                setPastTestCases(newPastTestCases);
              }} isPast={true} />
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
              <TestTable data={pastTestCases[0]} setData={(newData: SetStateAction<TestCaseResultRow[]>) => {
                const newPastTestCases = [...pastTestCases];
                newPastTestCases[0] = newData as TestCaseResultRow[];
                setPastTestCases(newPastTestCases);
              }} isPast={true} />
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
        <Button type="submit" onClick={handleSubmit} >登録</Button>
        <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
      </div>
    </div>
  );
}