'use client';
import clientLogger from '@/utils/client-logger';
import { useEffect, useState } from 'react';
import { TestCaseResult } from './TestCaseResult';
import { TestCaseResultRow } from './types/testCase-result-list-row';
import { TestCaseDetailRow } from './types/testCase-detail-list-row';
import { Button } from '@/components/ui/button';
import { RootState } from '@/stores/store';
import { useSelector } from 'react-redux';
import Loading from '@/app/loading';
import { usePathname, useRouter } from 'next/navigation';
import { READMINE_URL } from '@/constants/constants';
import { Column } from '@/components/datagrid/DataGrid';
import {
  TableBody,
  TableRow,
  TableCell,
  TableHeader,
  Table
} from '@/components/ui/table';

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

interface ResultWithHistory {
  latestValidResult: Record<string, unknown>;
  allHistory: Record<string, unknown>[];
  historyCounts: number[];
}

interface TestResultsData {
  [testCaseNo: string]: ResultWithHistory;
}

export function TestCaseResultContainer({ groupId, tid }: { groupId: number; tid: string }) {
  const [data, setData] = useState<TestCaseDetailRow | null>(null);
  const [resultsWithHistory, setResultsWithHistory] = useState<TestResultsData>({});
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // 0 = 最新（初期状態で展開）
  const [labelData, setLabelData] = useState(labels);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);

  if (apiError) throw apiError;

  const router = useRouter();
  const pathname = usePathname();

  const user = useSelector((state: RootState) => state.auth.user);

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
    const fetchTestCaseDetail = async () => {
      try {
        clientLogger.info('TestCaseResultContainer', 'テストケース詳細取得開始', { groupId, tid });

        const response = await fetch(`/api/test-groups/${groupId}/cases/${tid}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (!result || !result.testCase) {
          clientLogger.warn('TestCaseResultContainer', 'API response structure invalid', { result });
          throw new Error('テストケース詳細の取得に失敗しました');
        }

        const testCase = result.testCase as Record<string, unknown>;
        const testCaseDetail: TestCaseDetailRow = {
          tid: (testCase.tid as string) || '',
          firstLayer: (testCase.first_layer as string) || '',
          secondLayer: (testCase.second_layer as string) || '',
          thirdLayer: (testCase.third_layer as string) || '',
          fourthLayer: (testCase.fourth_layer as string) || '',
          purpose: (testCase.purpose as string) || '',
          checkItems: (testCase.check_items as string) || '',
          requestId: (testCase.request_id as string) || '',
          controlSpec: (testCase.control_spec_path as string) || '/images/dummy.png',
          dataFlow: (testCase.data_flow_path as string) || '/images/dummy.png',
          testProcedure: (testCase.test_procedure as string) || '',
        };

        setData(testCaseDetail);
        setLabelData(labels);

        clientLogger.info('TestCaseResultContainer', 'テストケース詳細取得成功', { tid });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('TestCaseResultContainer', 'テストケース詳細取得失敗', { error: errorMessage });
        setLoadError('テストケース詳細の取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const fetchTestResults = async () => {
      try {
        clientLogger.info('TestCaseResultContainer', 'テスト結果取得開始', { groupId, tid });

        const response = await fetch(`/api/test-groups/${groupId}/cases/${tid}/results`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success || !data.results) {
          throw new Error(data.error || 'テスト結果の取得に失敗しました');
        }

        // Store the results with history
        const resultsData = data.results as TestResultsData;
        setResultsWithHistory(resultsData);

        clientLogger.info('TestCaseResultContainer', 'テスト結果取得成功', { tid, count: Object.keys(resultsData).length });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        clientLogger.error('TestCaseResultContainer', 'テスト結果取得失敗', { error: errorMessage });
        setLoadError('テスト結果の取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    fetchTestCaseDetail();
    fetchTestResults();
  }, [groupId, tid]);

  const handleCancel = () => {
    window.history.back();
  };

  const handleShowTestTable = () => {
    router.push(`${pathname}/conduct`);
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

  // Helper function to get value from result with snake_case to camelCase conversion
  const getResultValue = (result: Record<string, unknown>, key: string): unknown => {
    // First try camelCase key
    if (key in result) {
      return result[key];
    }
    // Convert camelCase to snake_case and try again
    const snakeCase = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    return result[snakeCase];
  };

  // Helper function to extract filename from evidence URL
  const getEvidenceFilename = (evidence: unknown): string => {
    if (!evidence) return '';
    const evidenceStr = String(evidence);

    // Check if there's a query parameter with the filename
    const urlObj = new URL(evidenceStr, window.location.origin);
    const nameParam = urlObj.searchParams.get('name');
    if (nameParam) {
      return decodeURIComponent(nameParam);
    }

    // Fallback to extracting from path
    return evidenceStr.split('/').pop() || evidenceStr;
  };

  // Helper function to render note with ticket links
  const renderNoteWithTicketLinks = (text: unknown): React.ReactNode => {
    if (!text) return '';

    const noteStr = String(text);
    // Split by #数値 pattern, keeping the delimiters
    const parts = noteStr.split(/(#\d+)/);

    return parts.map((part, index) => {
      // Check if part matches #数値 pattern
      if (part.match(/^#\d+$/)) {
        const ticketId = part.substring(1); // Remove # to get the number
        return (
          <a
            key={index}
            href={`${READMINE_URL}${ticketId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
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
        <div className="space-y-6">
          {Object.entries(resultsWithHistory).length > 0 ? (
            (() => {
              // Group results by history_count to build sections
              const historyCountsSet = new Set<number>();
              const resultsByHistoryCount: Record<number, Map<string, Record<string, unknown>>> = {};

              // Collect all history counts and organize data
              Object.entries(resultsWithHistory).forEach(([testCaseNo, data]) => {
                const rwh = data as ResultWithHistory;

                // Add latest valid result
                historyCountsSet.add(0); // 0 represents "最新"
                if (!resultsByHistoryCount[0]) {
                  resultsByHistoryCount[0] = new Map();
                }
                resultsByHistoryCount[0].set(testCaseNo, rwh.latestValidResult);

                // Add all history entries
                rwh.allHistory.forEach((histItem) => {
                  const hc = (histItem as Record<string, unknown>).history_count as number;
                  historyCountsSet.add(hc);
                  if (!resultsByHistoryCount[hc]) {
                    resultsByHistoryCount[hc] = new Map();
                  }
                  resultsByHistoryCount[hc].set(testCaseNo, histItem);
                });
              });

              // Sort history counts: 0 (最新) first, then descending
              const sortedHistoryCounts = Array.from(historyCountsSet).sort((a, b) => {
                if (a === 0) return -1;
                if (b === 0) return 1;
                return b - a;
              });

              // Render sections
              return sortedHistoryCounts.map((historyCount) => {
                const sectionLabel = historyCount === 0 ? '最新' : `${historyCount}回目`;
                const testCasesData = resultsByHistoryCount[historyCount];
                const sortedTestCaseNos = Array.from(testCasesData.keys()).sort(
                  (a, b) => parseInt(a, 10) - parseInt(b, 10)
                );
                const isExpanded = expandedSections.has(historyCount);

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
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-100">
                              <TableCell className="px-4 py-2 font-semibold text-sm w-12">No</TableCell>
                              {columns.map((col) => (
                                <TableCell key={String(col.key)} className="px-4 py-2 font-semibold text-sm">
                                  {col.header}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedTestCaseNos.map((testCaseNo, rowIndex) => {
                              const result = testCasesData.get(testCaseNo) as Record<string, unknown>;
                              return (
                                <TableRow key={testCaseNo}>
                                  <TableCell className="px-4 py-2 text-sm w-12 font-medium">{rowIndex + 1}</TableCell>
                                  {columns.map((col) => {
                                    const value = getResultValue(result, col.key as string);
                                    let displayValue = '';

                                    if (col.key === 'executionDate' && value) {
                                      displayValue = new Date(value as string).toLocaleDateString('ja-JP');
                                    } else if (col.key === 'evidence') {
                                      displayValue = (value as string) || '';
                                    } else {
                                      displayValue = String(value || '');
                                    }

                                    return (
                                      <TableCell key={String(col.key)} className="px-4 py-2 text-sm">
                                        {col.key === 'evidence' && displayValue ? (
                                          <a
                                            href={displayValue}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:underline break-words"
                                          >
                                            {getEvidenceFilename(displayValue)}
                                          </a>
                                        ) : col.key === 'note' ? (
                                          <span className="break-words">
                                            {renderNoteWithTicketLinks(displayValue)}
                                          </span>
                                        ) : col.isLink ? (
                                          <a
                                            href={col.linkPrefix ? `${col.linkPrefix}${displayValue}` : displayValue}
                                            target={col.isExlink ? '_blank' : undefined}
                                            rel={col.isExlink ? 'noopener noreferrer' : undefined}
                                            className="text-blue-500 hover:underline break-words"
                                          >
                                            {displayValue}
                                          </a>
                                        ) : (
                                          <span className="break-words">{displayValue}</span>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          ) : (
            <div className="text-gray-500 text-center py-8">テスト結果がありません</div>
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
