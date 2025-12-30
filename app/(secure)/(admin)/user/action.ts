import serverLogger from '@/utils/server-logger';
import { UserListRow } from './_components/types/user-list-row';

interface GetDataListParams {
  page?: number;
}

export type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function getDataCount(): Promise<Result<number>> {
  try {
    serverLogger.info(`getDataCount Resquest`);

    return { success: true, data: 50 };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getDataList(params: GetDataListParams): Promise<Result<UserListRow[]>> {
  try {
    serverLogger.info(`getDataList Resquest`, { id: params.page });

    const page = !params.page ? 0 : params.page;
    const id: number = (page - 1) * 10 + 1;
    const data: UserListRow[] = [
      { email: `Sample${id}@sample.com`, name: `テスト${id}郎`, department: `部署${id}`, company: `会社名${id}`, role: 'システム管理者', tag: `A-${id}`, status: true },
      { email: `Sample${id + 1}@sample.com`, name: `テスト${id + 1}郎`, department: `部署${id + 1}`, company: `会社名${id + 1}`, role: 'テスト管理者', tag: `A-${id + 1},B-${id + 1}`, status: true },
      { email: `Sample${id + 2}@sample.com`, name: `テスト${id + 2}郎`, department: `部署${id + 2}`, company: `会社名${id + 2}`, role: 'テスト管理者', tag: `A-${id + 2}`, status: true },
      { email: `Sample${id + 3}@sample.com`, name: `テスト${id + 3}郎`, department: `部署${id + 3}`, company: `会社名${id + 3}`, role: '一般', tag: `A-${id + 3},B-${id + 3},C-${id + 3}`, status: true },
      { email: `Sample${id + 4}@sample.com`, name: `テスト${id + 4}郎`, department: `部署${id + 4}`, company: `会社名${id + 4}`, role: 'システム管理者', tag: `A-${id + 4}`, status: true },
      { email: `Sample${id + 5}@sample.com`, name: `テスト${id + 5}郎`, department: `部署${id + 5}`, company: `会社名${id + 5}`, role: 'テスト管理者', tag: `A-${id + 5}`, status: true },
      { email: `Sample${id + 6}@sample.com`, name: `テスト${id + 6}郎`, department: `部署${id + 6}`, company: `会社名${id + 6}`, role: 'テスト管理者', tag: `A-${id + 6},B-${id + 6}`, status: true },
      { email: `Sample${id + 7}@sample.com`, name: `テスト${id + 7}郎`, department: `部署${id + 7}`, company: `会社名${id + 7}`, role: '一般', tag: `A-${id + 7}`, status: true },
      { email: `Sample${id + 8}@sample.com`, name: `テスト${id + 8}郎`, department: `部署${id + 8}`, company: `会社名${id + 8}`, role: 'システム管理者', tag: `A-${id + 8}`, status: true },
      { email: `Sample${id + 9}@sample.com`, name: `テスト${id + 9}郎`, department: `部署${id + 9}`, company: `会社名${id + 9}`, role: 'テスト管理者', tag: `A-${id + 9}`, status: true },
    ];

    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching data:', error);
    return { success: false, error: 'Failed to fetch data.' };
  }
}

export async function getTagOptions(): Promise<Result<{ value: string, label: string }[]>> {
  try {
    const tagOptions = [
      { value: 'タグA', label: 'タグA' },
      { value: 'タグB', label: 'タグB' },
      { value: 'タグC', label: 'タグC' },
      { value: 'タグD', label: 'タグD' },
      { value: 'タグE', label: 'タグE' },
      { value: 'タグF', label: 'タグF' },
    ];

    return { success: true, data: tagOptions };
  } catch (error) {
    console.error('Error fetching tag options:', error);
    return { success: false, error: 'Failed to fetch tag options.' };
  }
}