'use server';

import serverLogger from '@/utils/server-logger';
import { UserListRow } from './_components/types/user-list-row';
import { cookies } from 'next/headers';

interface GetDataListParams {
  page?: number;
}

interface ApiUserResponse {
  id: number;
  email: string;
  user_role: number;
  department?: string;
  company?: string;
  is_deleted: boolean;
  tags?: { id: number; name: string }[];
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const roleMap: { [key: number]: string } = {
  0: 'システム管理者',
  1: 'テスト管理者',
  2: '一般',
};

export async function getDataCount(): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Request`);
    const cookieStore = await cookies();
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/users`, {
      headers: {
        'Cookie': cookieStore.toString(),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    const count = result.data ? result.data.length : 0;
    return { success: true, data: count };
  } catch (error) {
    serverLogger.error('getDataCount error', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to fetch user count.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<UserListRow[]>> {
  try {
    serverLogger.info(`getDataList Request`, { page: params.page });

    const cookieStore = await cookies();
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/users`, {
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

    const users: UserListRow[] = result.data
      .slice(startIndex, endIndex)
      .map((user: ApiUserResponse) => ({
        email: user.email,
        name: user.email.split('@')[0],
        department: user.department || '',
        company: user.company || '',
        role: roleMap[user.user_role] || '不明',
        tag: user.tags?.map(t => t.name).join(',') || '',
        status: !user.is_deleted,
      }));

    serverLogger.info('getDataList success', { page, count: users.length });
    return { success: true, data: users };
  } catch (error) {
    serverLogger.error('getDataList error', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to fetch user list.' };
  }
}

export async function getTagOptions(): Promise<Result<{ value: string, label: string }[]>> {
  try {
    const cookieStore = await cookies();
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tags`, {
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

    const tagOptions = result.data.map((tag: { id: number; name: string }) => ({
      value: tag.name,
      label: tag.name,
    }));

    return { success: true, data: tagOptions };
  } catch (error) {
    serverLogger.error('getTagOptions error', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to fetch tag options.' };
  }
}
