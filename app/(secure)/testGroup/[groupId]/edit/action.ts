'use server';

import serverLogger from '@/utils/server-logger';
import { TestGroupEditFormState } from './_components/TestGroupEditForm';
import { cookies } from 'next/headers';

interface GetDataParams {
  groupId: number;
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
  tag_names?: Array<{
    tag_name: string;
    test_role: number;
  }>;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function saveData(groupId: number, params: TestGroupEditFormState): Promise<Result<number>> {
  try {
    serverLogger.info(`saveData Request`, { groupId, params });

    const cookieStore = await cookies();

    // Parse test dates from testDatespan (format: "YYYY-MM-DD～YYYY-MM-DD" or "YYYY-MM-DD")
    let test_startdate = '';
    let test_enddate = '';
    if (params.testDatespan) {
      const dates = params.testDatespan.split('～');
      test_startdate = dates[0]?.trim() || '';
      test_enddate = dates[1]?.trim() || '';
    }

    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups/${groupId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieStore.toString(),
        },
        body: JSON.stringify({
          oem: params.oem,
          model: params.model,
          event: params.event || undefined,
          variation: params.variation || undefined,
          destination: params.destination || undefined,
          specs: params.specs || undefined,
          test_startdate: test_startdate || undefined,
          test_enddate: test_enddate || undefined,
          ng_plan_count: params.ngPlanCount ? parseInt(params.ngPlanCount) : undefined,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to update test group');
    }

    serverLogger.info('saveData success', { groupId });
    return { success: true, data: groupId };
  } catch (error) {
    serverLogger.error('Error saving data:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to save data.' };
  }
}

export async function getData(params: GetDataParams): Promise<Result<TestGroupEditFormState>> {
  try {
    serverLogger.info(`getData Request`, { groupId: params.groupId });

    const cookieStore = await cookies();
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups/${params.groupId}`,
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
    if (!result.success || !result.data) {
      throw new Error('Invalid API response');
    }

    const group: ApiTestGroupResponse = result.data;
    const testDatespan = group.test_enddate
      ? `${group.test_startdate}～${group.test_enddate}`
      : group.test_startdate;

    const data: TestGroupEditFormState = {
      oem: group.oem,
      model: group.model,
      event: group.event || '',
      variation: group.variation || '',
      destination: group.destination || '',
      specs: group.specs || '',
      testDatespan: testDatespan,
      ngPlanCount: String(group.ng_plan_count),
      created_at: group.created_at,
      updated_at: group.updated_at
    };

    serverLogger.info('getData success', { groupId: params.groupId });
    return { success: true, data };
  } catch (error) {
    serverLogger.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch test group data.' };
  }
}

export async function getTagOptions(): Promise<Result<{ value: string, label: string }[]>> {
  try {
    const cookieStore = await cookies();
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tags`,
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

    const tagOptions = result.data.map((tag: { id: number; name: string }) => ({
      value: tag.name,
      label: tag.name,
    }));

    return { success: true, data: tagOptions };
  } catch (error) {
    serverLogger.error('Error fetching tag options:', error);
    return { success: false, error: 'Failed to fetch tag options.' };
  }
}