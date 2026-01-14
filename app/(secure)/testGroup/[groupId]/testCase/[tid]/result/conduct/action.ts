import serverLogger from '@/utils/server-logger';
import { TestCaseDetailState, TestCaseConductState } from './_components/TestCaseConduct';

interface GetDataParams {
  groupId: number;
  tid: string;
}

interface SaveDataParams {
  groupId: number;
  tid: string;
  testResults: Array<{
    testCaseNo: number;
    result: string;
    judgment: string;
    softwareVersion: string;
    hardwareVersion: string;
    comparatorVersion: string;
    executionDate: string;
    executor: string;
    note: string;
    evidenceIds: number[];
  }>;
  deletedEvidences: Array<{
    testCaseNo: number;
    historyCount: number;
    evidenceNo: number;
  }>;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function saveData(params: SaveDataParams): Promise<Result<string>> {
  try {
    serverLogger.info(`saveData Request`, { groupId: params.groupId, tid: params.tid });

    const response = await fetch(`/api/test-groups/${params.groupId}/cases/${params.tid}/results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        testResults: params.testResults,
        deletedEvidences: params.deletedEvidences,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save test results');
    }

    const result = await response.json();
    serverLogger.info(`saveData Success`, { groupId: params.groupId, tid: params.tid });

    return { success: true, data: result.message };
  } catch (error) {
    serverLogger.error('saveData Error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save test results.' };
  }
}

export async function getData(params: GetDataParams): Promise<Result<TestCaseDetailState>> {
  try {
    serverLogger.info(`getData Request`, { groupId: params.groupId, tid: params.tid });

    const response = await fetch(`/api/test-groups/${params.groupId}/cases/${params.tid}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch test case data');
    }

    const result = await response.json();

    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error('Test case not found');
    }

    const testCase = result.data[0];

    // controlSpec と dataFlow の最初のファイルパスを取得（複数ある場合は最初のもの）
    const controlSpecPath = testCase.control_spec && testCase.control_spec.length > 0
      ? testCase.control_spec[0].file_path
      : '';
    const dataFlowPath = testCase.data_flow && testCase.data_flow.length > 0
      ? testCase.data_flow[0].file_path
      : '';

    const data: TestCaseDetailState = {
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

    serverLogger.info(`getData Success`, { tid: data.tid });
    return { success: true, data: data };
  } catch (error) {
    serverLogger.error('getData Error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch data.' };
  }
}
export async function getTestResults(params: GetDataParams): Promise<Result<{
  currentResults: TestCaseConductState[];
  historicalResults: TestCaseConductState[][];
}>> {
  try {
    serverLogger.info(`getTestResults Request`, { groupId: params.groupId, tid: params.tid });

    const response = await fetch(`/api/test-groups/${params.groupId}/cases/${params.tid}/results`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch test results');
    }

    const result = await response.json();

    if (!result.success || !result.results) {
      throw new Error('Test results not found');
    }

    const groupedResults = result.results;

    // テストケース番号順にソート
    const sortedTestCaseNos = Object.keys(groupedResults).sort((a, b) => parseInt(a) - parseInt(b));

    // 最新の結果を取得
    const currentResults: TestCaseConductState[] = sortedTestCaseNos.map((testCaseNo) => {
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
    const historicalResults: TestCaseConductState[][] = sortedHistoryCounts.map((historyCount) => {
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

    serverLogger.info(`getTestResults Success`, { resultsCount: currentResults.length, historyCount: historicalResults.length });
    return { success: true, data: { currentResults, historicalResults } };
  } catch (error) {
    serverLogger.error('getTestResults Error', { error: error instanceof Error ? error.message : String(error) });
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch test results.' };
  }
}

export async function getSampleInitialTestCases(): Promise<Result<TestCaseConductState[]>> {
  try {
    const sampleTestCases: TestCaseConductState[] = [
      // 初期のテストケース
      {
        testCase: "テストケース1",
        expectedValue: "期待値1",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース2",
        expectedValue: "期待値2",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース3",
        expectedValue: "期待値3",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース4",
        expectedValue: "期待値4",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース5",
        expectedValue: "期待値5",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース6",
        expectedValue: "期待値6",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース7",
        expectedValue: "期待値7",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      }
    ];

    return { success: true, data: sampleTestCases };
  } catch (error) {
    console.error('Error fetching sample test cases:', error);
    return { success: false, error: 'Failed to fetch sample test cases.' };
  }
}

export async function getSampleTestCases(): Promise<Result<TestCaseConductState[]>> {
  try {
    const sampleTestCases: TestCaseConductState[] = [
      // 1回目のテストケース
      {
        testCase: "テストケース1",
        expectedValue: "期待値1",
        result: "期待値X",
        judgment: "NG",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/29",
        executor: "テスト 太郎",
        evidence: null,
        note: "19630",
      },
      {
        testCase: "テストケース2",
        expectedValue: "期待値2",
        result: "期待値X",
        judgment: "NG",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/28",
        executor: "テスト 太郎",
        evidence: null,
        note: "19629",
      },
      {
        testCase: "テストケース3",
        expectedValue: "期待値3",
        result: "期待値3",
        judgment: "OK",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/27",
        executor: "テスト 太郎",
        evidence: null,
        note: "",
      },
      {
        testCase: "テストケース4",
        expectedValue: "期待値4",
        result: "",
        judgment: "対象外",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: "",
      },
      {
        testCase: "テストケース5",
        expectedValue: "期待値5",
        result: "期待値5",
        judgment: "OK",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/25",
        executor: "テスト 太郎",
        evidence: null,
        note: "",
      },
      {
        testCase: "テストケース6",
        expectedValue: "期待値6",
        result: "期待値6",
        judgment: "OK",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/24",
        executor: "テスト 太郎",
        evidence: null,
        note: "",
      },
      {
        testCase: "テストケース7",
        expectedValue: "期待値7",
        result: "期待値7",
        judgment: "OK",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/23",
        executor: "テスト 太郎",
        evidence: null,
        note: "",
      },
      // 2回目のテストケース
      {
        testCase: "テストケース1",
        expectedValue: "期待値1",
        result: "期待値X",
        judgment: "NG",
        softwareVersion: "1.0.1",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/29",
        executor: "テスト 太郎",
        evidence: null,
        note: "19630"
      },
      {
        testCase: "テストケース2",
        expectedValue: "期待値2",
        result: "期待値2",
        judgment: "OK",
        softwareVersion: "1.0.1",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/28",
        executor: "テスト 太郎",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース3",
        expectedValue: "期待値3",
        result: "",
        judgment: "再実施対象外",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "テスト 太郎",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース4",
        expectedValue: "期待値4",
        result: "",
        judgment: "再実施対象外",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "テスト 太郎",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース5",
        expectedValue: "期待値5",
        result: "",
        judgment: "再実施対象外",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "テスト 太郎",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース6",
        expectedValue: "期待値6",
        result: "",
        judgment: "再実施対象外",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "テスト 太郎",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース7",
        expectedValue: "期待値7",
        result: "",
        judgment: "再実施対象外",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "テスト 太郎",
        evidence: null,
        note: ""
      },
      // 最新のテストケース
      {
        testCase: "テストケース1",
        expectedValue: "期待値1",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース2",
        expectedValue: "期待値2",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース3",
        expectedValue: "期待値3",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース4",
        expectedValue: "期待値4",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース5",
        expectedValue: "期待値5",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース6",
        expectedValue: "期待値6",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      },
      {
        testCase: "テストケース7",
        expectedValue: "期待値7",
        result: "",
        judgment: "",
        softwareVersion: "",
        hardwareVersion: "",
        comparatorVersion: "",
        executionDate: "",
        executor: "",
        evidence: null,
        note: ""
      }
    ];

    return { success: true, data: sampleTestCases };
  } catch (error) {
    console.error('Error fetching sample test cases:', error);
    return { success: false, error: 'Failed to fetch sample test cases.' };
  }
}