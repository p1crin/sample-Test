import serverLogger from '@/utils/server-logger';
import { TestCaseDetailState, TestCaseResultState } from './_components/TestCaseResult';

interface GetDataParams {
  id: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function saveData(params: TestCaseDetailState): Promise<Result<number>> {
  try {
    serverLogger.info(`saveData Resquest`, { params });

    // TODO 保存処理

    return { success: true, data: 1 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getData(params: GetDataParams): Promise<Result<TestCaseDetailState>> {
  try {
    serverLogger.info(`getData Resquest`, { id: params.id });

    const data: TestCaseDetailState = {
      tid: "1-1-1",
      firstLayer: "第1層-1",
      secondLayer: "第2層-1",
      thirdLayer: "第3層-1",
      fourthLayer: "第4層-1",
      purpose: "目的1",
      requestId: "要求ID-1",
      checkItems: '確認観点1',
      controlSpec: "/images/dummy.png",
      dataFlow: "/images/dummy.png",
      testProcedure: "テスト手順サンプル\nテスト手順サンプル\nテスト手順サンプル\nテスト手順サンプル",
    };

    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getSampleTestCases(): Promise<Result<TestCaseResultState[]>> {
  try {
    const sampleTestCases: TestCaseResultState[] = [
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
        evidence: ["/images/dummy.png", "/images/dummy.png"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
        note: "19630",
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
        note: "",
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
        evidence: [],
        note: "",
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
        evidence: [],
        note: "",
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
        evidence: [],
        note: "",
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
        evidence: [],
        note: "",
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
        evidence: [],
        note: "",
      },
      // 最新のテストケース
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
        evidence: ["/images/dummy.png", "/images/dummy.png"],
        note: "19630",
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
        note: "",
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
        note: "",
      },
      {
        testCase: "テストケース4",
        expectedValue: "期待値4",
        result: "期待値4",
        judgment: "OK",
        softwareVersion: "1.0.0",
        hardwareVersion: "1.0.0",
        comparatorVersion: "1.0.0",
        executionDate: "2025/09/26",
        executor: "テスト 太郎",
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
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
        evidence: ["/images/dummy.png", "/images/dummy.xls"],
        note: "",
      }
    ];

    return { success: true, data: sampleTestCases };
  } catch (error) {
    console.error('Error fetching sample test cases:', error);
    return { success: false, error: 'Failed to fetch sample test cases.' };
  }
}