'use server';

import serverLogger from '@/utils/server-logger';
import { TestCaseListRow } from '../_components/types/testCase-list-row';
import { cookies } from 'next/headers';

interface GetDataListParams {
  page?: number;
  groupId?: number;
}

interface ApiTestCaseResponse {
  test_group_id: number;
  tid: string;
  first_layer: string;
  second_layer: string;
  third_layer: string;
  fourth_layer: string;
  purpose: string;
  request_id: string;
  test_procedure: string;
  created_at: string;
  updated_at: string;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getDataCount(groupId: number): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Request`, { groupId });
    const cookieStore = await cookies();
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups/${groupId}/cases`,
      {
        headers: {
          'Cookie': cookieStore.toString(),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const count = result.data ? (Array.isArray(result.data) ? result.data.length : 0) : 0;
    return { success: true, data: count };
  } catch (error) {
    serverLogger.error('getDataCount error', error);
    return { success: false, error: 'Failed to fetch test case count.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<TestCaseListRow[]>> {
  try {
    serverLogger.info(`getDataList Request`, { page: params.page, groupId: params.groupId });

    if (!params.groupId) {
      throw new Error('groupId is required');
    }

    const cookieStore = await cookies();
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups/${params.groupId}/cases`,
      {
        headers: {
          'Cookie': cookieStore.toString(),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('Invalid API response');
    }

    const page = params.page || 1;
    const pageSize = 10;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const testCases: TestCaseListRow[] = result.data
      .slice(startIndex, endIndex)
      .map((testCase: ApiTestCaseResponse) => ({
        tid: testCase.tid,
        firstLayer: testCase.first_layer,
        secondLayer: testCase.second_layer,
        thirdLayer: testCase.third_layer,
        fourthLayer: testCase.fourth_layer,
        purpose: testCase.purpose,
        requestId: testCase.request_id,
        checkItems: testCase.test_procedure,
        createdAt: testCase.created_at.split('T')[0],
        updatedAt: testCase.updated_at.split('T')[0],
        chartData: {
          okCount: 0,
          ngCount: 0,
          notStartCount: 0,
          excludedCount: 0,
        },
      }));

    serverLogger.info('getDataList success', { page, count: testCases.length });
    return { success: true, data: testCases };
  } catch (error) {
    serverLogger.error('getDataList error', error);
    return { success: false, error: 'Failed to fetch test case list.' };
  }
}
