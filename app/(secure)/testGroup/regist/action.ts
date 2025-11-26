'use server';

import { cookies } from 'next/headers';

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

interface CreateTestGroupRequest {
  oem: string;
  model: string;
  event?: string;
  variation?: string;
  destination?: string;
  specs?: string;
  test_startdate?: string;
  test_enddate?: string;
  ng_plan_count?: number;
  tag_names?: Array<{
    tag_name: string;
    test_role: number;
  }>;
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
    console.error('Error fetching tag options:', error);
    return { success: false, error: 'Failed to fetch tag options.' };
  }
}

export async function createTestGroup(data: CreateTestGroupRequest): Promise<Result<{ id: number }>> {
  try {
    const cookieStore = await cookies();
    const response = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/test-groups`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieStore.toString(),
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to create test group');
    }

    return { success: true, data: { id: result.data.id } };
  } catch (error) {
    console.error('Error creating test group:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create test group.'
    };
  }
}