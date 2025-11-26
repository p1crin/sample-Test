'use server';

import serverLogger from '@/utils/server-logger';
import { TestGroupFormData } from '@/app/(secure)/_components/types/testGroup-list-row';
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

export async function saveData(groupId: number, params: TestGroupFormData): Promise<Result<number>> {
  try {
    serverLogger.info(`saveData Request`, { groupId, params });

    const cookieStore = await cookies();

    // Build tag_names array from tag fields
    const tag_names: Array<{ tag_name: string; test_role: number }> = [];

    if (params.designerTag && params.designerTag.length > 0) {
      params.designerTag.forEach((tag) => {
        tag_names.push({ tag_name: tag, test_role: 1 });
      });
    }

    if (params.executerTag && params.executerTag.length > 0) {
      params.executerTag.forEach((tag) => {
        tag_names.push({ tag_name: tag, test_role: 2 });
      });
    }

    if (params.viewerTag && params.viewerTag.length > 0) {
      params.viewerTag.forEach((tag) => {
        tag_names.push({ tag_name: tag, test_role: 3 });
      });
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
          test_startdate: params.test_startdate || undefined,
          test_enddate: params.test_enddate || undefined,
          ng_plan_count: params.ngPlanCount ? parseInt(params.ngPlanCount) : undefined,
          tag_names: tag_names.length > 0 ? tag_names : undefined,
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

export async function getData(params: GetDataParams): Promise<Result<TestGroupFormData>> {
  try {
    serverLogger.info(`getData Request`, { groupId: params.groupId });

    const cookieStore = await cookies();
    const apiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups/${params.groupId}`;

    serverLogger.info('Fetching from API', { url: apiUrl });

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookieStore.toString(),
      },
    });

    serverLogger.info('API Response status', { status: response.status, statusText: response.statusText });

    if (!response.ok) {
      const errorBody = await response.text();
      serverLogger.error('API error response', { status: response.status, body: errorBody });
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    serverLogger.info('API Response JSON', { success: result.success, hasData: !!result.data });

    if (!result.success || !result.data) {
      serverLogger.error('Invalid API response', { result });
      throw new Error('Invalid API response: ' + JSON.stringify(result));
    }

    const group: ApiTestGroupResponse = result.data;

    // Parse tag_names to separate by test_role
    const designerTag: string[] = [];
    const executerTag: string[] = [];
    const viewerTag: string[] = [];

    if (group.tag_names && Array.isArray(group.tag_names)) {
      group.tag_names.forEach((tag) => {
        switch (tag.test_role) {
          case 1:
            designerTag.push(tag.tag_name);
            break;
          case 2:
            executerTag.push(tag.tag_name);
            break;
          case 3:
            viewerTag.push(tag.tag_name);
            break;
        }
      });
    }

    const data: TestGroupFormData = {
      oem: group.oem,
      model: group.model,
      event: group.event || '',
      variation: group.variation || '',
      destination: group.destination || '',
      specs: group.specs || '',
      test_startdate: group.test_startdate || '',
      test_enddate: group.test_enddate || '',
      ngPlanCount: String(group.ng_plan_count || ''),
      designerTag,
      executerTag,
      viewerTag,
      created_at: group.created_at,
      updated_at: group.updated_at
    };

    serverLogger.info('getData success - Form data prepared', {
      groupId: params.groupId,
      data
    });
    return { success: true, data };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    serverLogger.error('Error fetching data', { error: errorMsg, groupId: params.groupId });
    return { success: false, error: errorMsg };
  }
}

export async function getTagOptions(): Promise<Result<{ value: string, label: string }[]>> {
  try {
    const cookieStore = await cookies();
    const apiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tags`;

    serverLogger.info('getTagOptions: Fetching tags from API', { url: apiUrl });

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookieStore.toString(),
      },
    });

    serverLogger.info('getTagOptions: API response status', { status: response.status });

    if (!response.ok) {
      const errorBody = await response.text();
      serverLogger.error('getTagOptions: API error', { status: response.status, body: errorBody });
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    serverLogger.info('getTagOptions: API response parsed', {
      success: result.success,
      dataType: Array.isArray(result.data) ? 'array' : typeof result.data,
      dataLength: Array.isArray(result.data) ? result.data.length : 'N/A',
      result
    });

    if (!result.success) {
      serverLogger.error('getTagOptions: API returned success=false', { result });
      return { success: true, data: [] }; // 成功時は空配列を返す
    }

    if (!Array.isArray(result.data)) {
      serverLogger.warn('getTagOptions: result.data is not array', {
        dataType: typeof result.data,
        result
      });
      return { success: true, data: [] }; // 空配列を返す
    }

    const tagOptions = result.data.map((tag: { id: number; name: string }) => {
      serverLogger.debug('getTagOptions: processing tag', { tag });
      return {
        value: tag.name,
        label: tag.name,
      };
    });

    serverLogger.info('getTagOptions: success', { count: tagOptions.length });
    return { success: true, data: tagOptions };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    serverLogger.error('getTagOptions: Error fetching tag options', { error: errorMsg });
    return { success: true, data: [] }; // エラー時も空配列を返す
  }
}