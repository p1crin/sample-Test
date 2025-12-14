// UserListContainer.tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import clientLogger from '@/utils/client-logger';
import { Column } from '@/components/datagrid/DataGrid';
import { UserListRow, UserListTableRow } from './types/user-list-row';
import { UserList } from './UserList';
import { getDataList, getDataCount, getTagOptions } from '../action';
import { Button } from '@/components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import ImportButton from '@/components/ui/importButton';
import ExportButton from '@/components/ui/exportButton';
import { Modal } from '@/components/ui/modal';
import SeachForm from '@/components/ui/searchForm';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/constants/constants';

export function UserListContainer() {
  const router = useRouter();
  const searchParamsQuery = useSearchParams();

  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [menuItems, setMenuItems] = useState<UserListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof UserListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const pageSize = 10;

  // APIエラーがある場合はスロー（error.tsx がキャッチする）
  if (apiError) {
    throw apiError;
  }

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListTableRow | null>(null);

  // フォーム入力値（リアルタイムで変更）
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({
    email: '',
    name: '',
    department: '',
    company: '',
    role: '',
    tag: [],
    status: '',
  });

  // 検索パラメータ（検索ボタン押下時に更新）
  const [searchParams, setSearchParams] = useState<Record<string, string | string[]>>({
    email: '',
    name: '',
    department: '',
    company: '',
    role: '',
    tag: [],
    status: '',
  });

  // 検索パラメータを含むクエリ文字列を構築（API用）
  const buildQueryString = (params: Record<string, string | string[]>, pageNum: number = 1) => {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(pageNum));
    queryParams.append('limit', String(pageSize));

    // 空でない検索パラメータのみ追加
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // タグなど配列の場合は複数の値を追加
        value.forEach(v => {
          if (v.trim()) {
            queryParams.append(key, v);
          }
        });
      } else if (typeof value === 'string' && value.trim()) {
        queryParams.append(key, value);
      }
    });

    return queryParams.toString();
  };

  // URLパラメータを更新する関数（limitは含めない）
  const updateUrlParams = (newSearchParams: Record<string, string | string[]>, pageNum: number = 1) => {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(pageNum));

    // 空でない検索パラメータのみ追加
    Object.entries(newSearchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => {
          if (v.trim()) {
            queryParams.append(key, v);
          }
        });
      } else if (typeof value === 'string' && value.trim()) {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    router.push(`/user?${queryString}`);
    clientLogger.info('UserListContainer', 'URL更新', { pageNum, searchParams: newSearchParams });
  };

  // URLパラメータをコンポーネント状態に同期する
  useEffect(() => {
    const params: Record<string, string | string[]> = {
      email: searchParamsQuery.get('email') || '',
      name: searchParamsQuery.get('name') || '',
      department: searchParamsQuery.get('department') || '',
      company: searchParamsQuery.get('company') || '',
      role: searchParamsQuery.get('role') || '',
      tag: searchParamsQuery.getAll('tag') || [],
      status: searchParamsQuery.get('status') || '',
    };

    const pageNum = parseInt(searchParamsQuery.get('page') || '1', 10);
    const hasPageInUrl = searchParamsQuery.get('page') !== null;

    setFormValues(params);
    setSearchParams(params);
    setPage(pageNum);
    setIsInitialized(true);

    // URLにpageパラメータがない場合は、URLを更新（初期表示やサイドバーからの遷移時）
    if (!hasPageInUrl) {
      updateUrlParams(params, pageNum);
    }

    clientLogger.info('UserListContainer', 'URLパラメータ同期完了', { params, pageNum, hasPageInUrl });
  }, [searchParamsQuery]);

  useEffect(() => {
    // URLパラメータ同期が完了するまで待つ
    if (!isInitialized) {
      return;
    }

    const getDataCountFunc = async () => {
      try {
        clientLogger.info('UserListContainer', 'ユーザー数取得開始', { searchParams, isInitialized });
        const result = await getDataCount(searchParams);
        if (!result.success || !result.data) {
          throw new Error('ユーザー数の取得に失敗しました');
        }
        setPageCount(result.success && result.data ? Math.ceil(result.data / pageSize) : 0);
        clientLogger.info('UserListContainer', 'ユーザー数取得成功', { count: result.data, searchParams });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        clientLogger.error('UserListContainer', 'ユーザー数取得失敗', {
          error: error.message,
          searchParams,
        });
        setApiError(error);
      }
    };
    getDataCountFunc();
  }, [searchParams, pageSize, isInitialized]);

  useEffect(() => {
    // URLパラメータ同期が完了するまで待つ
    if (!isInitialized) {
      return;
    }

    let ignore = false;
    clientLogger.info('UserListContainer', 'データ取得開始', { page, searchParams, isInitialized });

    const getDataListFunc = async () => {
      try {
        clientLogger.info('UserListContainer', 'ユーザーリスト取得開始', { page, searchParams });
        const userData = await getDataList({ page, searchParams });
        if (!userData.success || !userData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${userData.error})`);
        }
        if (!ignore) setMenuItems(userData.data);
        clientLogger.info('UserListContainer', 'ユーザーリスト取得成功', {
          page,
          count: userData.data?.length,
        });
      } catch (err) {
        if (!ignore) setMenuItems([]);
        const error = err instanceof Error ? err : new Error(String(err));
        clientLogger.error('UserListContainer', 'ユーザーデータ取得失敗', {
          page,
          error: error.message,
        });
        if (!ignore) setApiError(error);
      }
    };
    getDataListFunc();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, searchParams, isInitialized]);

  useEffect(() => {
    async function fetchTagOptions() {
      try {
        const result = await getTagOptions();
        if (!result.success || !result.data) {
          throw new Error('タグオプションの取得に失敗しました');
        }
        setTagOptions(result.data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        clientLogger.error('UserListContainer', 'タグオプション取得失敗', {
          error: error.message,
        });
        setApiError(error);
      }
    }
    fetchTagOptions();
  }, []);

  const handleSort = (key: keyof UserListTableRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns: Column<UserListTableRow>[] = [
    { key: 'email', header: 'ID (メールアドレス)', },
    { key: 'name', header: '氏名', },
    { key: 'department', header: '部署', },
    { key: 'company', header: '会社名', },
    { key: 'role', header: '権限', },
    { key: 'tag', header: 'タグ', },
    { key: 'status', header: 'ステータス', },
  ];

  const toUserEditPage = (id: string) => {
    router.push(`/user/edit/${id}`);
  };

  const userDelete = () => {
    if (selectedUser) {
      console.log("ユーザ削除", selectedUser.email);
      setIsModalOpen(false);
    }
  };

  const renderActions = (item: UserListTableRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button variant="default" onClick={() => toUserEditPage(item.email)}>
        編集
      </Button>
      <Button
        onClick={() => {
          setSelectedUser(item);
          setIsModalOpen(true);
        }}
      >
        削除
      </Button>
    </div>
  );

  const sortedItems = [...menuItems];
  if (sortConfig) {
    sortedItems.sort((a, b) => {
      const key = sortConfig.key;
      const aValue = a[key];
      const bValue = b[key];
      if (aValue === undefined || bValue === undefined) return 0;
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const updatedItems = sortedItems.map(item => ({
    ...item,
    status: item.status ? '有効' : '無効'
  }));

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'email',
      name: 'email',
      value: formValues.email || '',
      onChange: () => { },
      placeholder: 'ID (メールアドレス)'
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: formValues.name || '',
      onChange: () => { },
      placeholder: '氏名'
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: formValues.department || '',
      onChange: () => { },
      placeholder: '部署'
    },
    {
      label: '会社名',
      type: 'text',
      name: 'company',
      value: formValues.company || '',
      onChange: () => { },
      placeholder: '会社名'
    },
    {
      label: '権限',
      type: 'select',
      name: 'role',
      value: formValues.role || '',
      onChange: () => { },
      placeholder: '権限',
      options: Object.values(ROLE_OPTIONS).map(role => ({
        value: role,
        label: role
      }))
    },
    {
      label: 'タグ',
      type: 'tag',
      name: 'tag',
      value: formValues.tag || [],
      onChange: () => { },
      placeholder: 'タグ',
      options: tagOptions
    },
    {
      label: 'ステータス',
      type: 'select',
      name: 'status',
      value: formValues.status || '',
      onChange: () => { },
      placeholder: 'ステータス',
      options: Object.values(STATUS_OPTIONS).map(role => ({
        value: role,
        label: role
      }))
    },
  ];

  // 検索フォームのデータが更新されたときに呼び出される
  const handleFormDataChange = (formData: Record<string, string | string[]>) => {
    setFormValues(formData);
  };

  const handleSearch = () => {
    // 検索ボタン押下時、フォーム値を検索パラメータに設定してURLを更新
    setSearchParams(formValues);
    setPage(1); // ページを1にリセット
    updateUrlParams(formValues, 1);
    clientLogger.info('UserListContainer', '検索実行', { formValues });
  };

  // ページ変更時にURLも更新
  const handlePageChange = (pageNum: number) => {
    setPage(pageNum);
    updateUrlParams(searchParams, pageNum);
  };

  return (
    <div>
      <SeachForm fields={fields} values={formValues} onClick={handleSearch} onFormDataChange={handleFormDataChange} />
      <div className="text-right space-x-2 pb-2">
        <Button variant="default">
          <Link href="/user/regist">
            ユーザ登録
          </Link>
        </Button>
        <ExportButton />
        <ImportButton type={'user'} />
      </div>
      <UserList
        items={updatedItems}
        columns={columns}
        sortConfig={sortConfig}
        page={page}
        pageCount={pageCount}
        onSort={handleSort}
        onPageChange={handlePageChange}
        renderActions={renderActions}
      />
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">本当にこのユーザを削除しますか？</p>
        {selectedUser && <p className="mb-8">対象ユーザ: {selectedUser.name}</p>}
        <div className="flex justify-center space-x-5">
          <Button className="w-24 bg-red-600 text-white" onClick={userDelete}>削除</Button>
          <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}