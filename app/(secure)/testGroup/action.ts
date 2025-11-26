'use server';

import serverLogger from '@/utils/server-logger';
import { TestGroupListRow } from '../_components/types/testGroup-list-row';
import { cookies } from 'next/headers';

interface GetDataListParams {
  page?: number;
}

interface ApiTestGroupResponse {
  id: number;
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  test_startdate: string;
  test_enddate?: string;
  ng_plan_count: number;
  created_at: string;
  updated_at: string;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getDataCount(): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Request`);
    const cookieStore = await cookies();
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups`, {
      headers: {
        'Cookie': cookieStore.toString(),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const count = result.data ? (Array.isArray(result.data) ? result.data.length : 0) : 0;
    return { success: true, data: count };
  } catch (error) {
    serverLogger.error('getDataCount error', error);
    return { success: false, error: 'Failed to fetch test group count.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<TestGroupListRow[]>> {
  try {
    serverLogger.info(`getDataList Request`, { page: params.page });

    const cookieStore = await cookies();
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups`, {
      headers: {
        'Cookie': cookieStore.toString(),
      },
    });

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

    const testGroups: TestGroupListRow[] = result.data
      .slice(startIndex, endIndex)
      .map((group: ApiTestGroupResponse) => ({
        id: group.id,
        oem: group.oem,
        model: group.model,
        event: group.event,
        variation: group.variation,
        destination: group.destination,
        specs: group.specs,
        testDatespan: `${group.test_startdate}${group.test_enddate ? ' ～ ' + group.test_enddate : ''}`,
        ngPlanCount: String(group.ng_plan_count),
        created_at: group.created_at,
        updated_at: group.updated_at,
      }));

    serverLogger.info('getDataList success', { page, count: testGroups.length });
    return { success: true, data: testGroups };
  } catch (error) {
    serverLogger.error('getDataList error', error);
    return { success: false, error: 'Failed to fetch test group list.' };
  }
}