'use server';

import serverLogger from '@/utils/server-logger';
import { UserListRow } from './_components/types/user-list-row';
import { RoleOption, ROLE_OPTIONS } from '@/constants/constants';
import { cookies } from 'next/headers';

interface GetDataListParams {
  page?: number;
  searchParams?: Record<string, string | string[]>;
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

const roleMap: { [key: number]: RoleOption } = {
  0: ROLE_OPTIONS.SYSTEM_ADMIN,
  1: ROLE_OPTIONS.TEST_MANAGER,
  2: ROLE_OPTIONS.GENERAL,
};

// ユーザーをフィルタリングするヘルパー関数
const filterUsers = (users: ApiUserResponse[], searchParams?: Record<string, string | string[]>): ApiUserResponse[] => {
  if (!searchParams || Object.keys(searchParams).length === 0) {
    return users;
  }

  return users.filter(user => {
    // メールアドレスで検索
    if (searchParams.email && typeof searchParams.email === 'string' && searchParams.email.trim()) {
      if (!user.email.toLowerCase().includes(searchParams.email.toLowerCase())) {
        return false;
      }
    }

    // 氏名で検索（メールアドレスの @ 前の部分）
    if (searchParams.name && typeof searchParams.name === 'string' && searchParams.name.trim()) {
      const userName = user.email.split('@')[0];
      if (!userName.toLowerCase().includes(searchParams.name.toLowerCase())) {
        return false;
      }
    }

    // 部署で検索
    if (searchParams.department && typeof searchParams.department === 'string' && searchParams.department.trim()) {
      if (!user.department?.toLowerCase().includes(searchParams.department.toLowerCase())) {
        return false;
      }
    }

    // 会社名で検索
    if (searchParams.company && typeof searchParams.company === 'string' && searchParams.company.trim()) {
      if (!user.company?.toLowerCase().includes(searchParams.company.toLowerCase())) {
        return false;
      }
    }

    // 権限で検索
    if (searchParams.role && typeof searchParams.role === 'string' && searchParams.role.trim()) {
      const userRole = roleMap[user.user_role] || '不明';
      if (userRole !== searchParams.role) {
        return false;
      }
    }

    // タグで検索
    if (searchParams.tag && Array.isArray(searchParams.tag) && searchParams.tag.length > 0) {
      const userTags = user.tags?.map(t => t.name) || [];
      const hasMatchingTag = searchParams.tag.some(tag => userTags.includes(tag));
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  });
};

export async function getDataCount(searchParams?: Record<string, string | string[]>): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Request`, { searchParams });
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
    const allUsers = result.data || [];
    const filteredUsers = filterUsers(allUsers, searchParams);
    const count = filteredUsers.length;
    return { success: true, data: count };
  } catch (error) {
    serverLogger.error('getDataCount error', error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to fetch user count.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<UserListRow[]>> {
  try {
    serverLogger.info(`getDataList Request`, { page: params.page, searchParams: params.searchParams });

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

    // フィルタリング
    const filteredUsers = filterUsers(result.data, params.searchParams);

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    const users: UserListRow[] = filteredUsers
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

    serverLogger.info('getDataList success', { page, count: users.length, filteredTotal: filteredUsers.length });
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
