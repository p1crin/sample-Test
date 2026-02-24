"use client"
import { Column } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import ExportButton from '@/components/ui/exportButton';
import Loading from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import SeachForm from '@/components/ui/searchForm';
import { ROLE_OPTIONS, STATUS_OPTIONS } from '@/constants/constants';
import { apiDelete, apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { formatDateJST } from '@/utils/date-formatter';
import { buildQueryString, updateUrlParams } from '@/utils/queryUtils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { UserListRow, UserListTableRow } from './types/user-list-row';
import { UserList } from './UserList';

export function UserListContainer() {
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<UserListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof UserListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserListTableRow | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [tagLoading, setTagLoading] = useState(true);
  const [delLoading, setDelLoading] = useState(false);
  const [isDelModalOpen, setIsDelModalOpen] = useState(false);

  const pageSize = 10;
  const router = useRouter();
  const pathName = usePathname();
  const searchParamsQuery = useSearchParams();
  const pagePath = '/user';

  // フォーム入力値(リアルタイムで変更)
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({
    email: '',
    name: '',
    department: '',
    company: '',
    user_role: '',
    tags: [] as string[],
    status: '',
  });

  // 検索パラメータ(検索ボタン押下時に更新)
  const [searchParams, setSearchParams] = useState<Record<string, string | string[]>>({
    email: '',
    name: '',
    department: '',
    company: '',
    user_role: '',
    tags: [] as string[],
    status: '',
  });
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;
  // URLパラメータをコンポーネント状態に同期する
  useEffect(() => {
    const params: Record<string, string | string[]> = {
      email: searchParamsQuery.get('email') || '',
      name: searchParamsQuery.get('name') || '',
      department: searchParamsQuery.get('department') || '',
      company: searchParamsQuery.get('company') || '',
      user_role: searchParamsQuery.get('user_role') || '',
      tags: searchParamsQuery.getAll('tags') || [],
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
      updateUrlParams(router, params, pagePath, pageNum);
    }
  }, [searchParamsQuery]);

  useEffect(() => {
    // URLパラメータ同期が完了するまで待つ
    if (!isInitialized) {
      return;
    }
    let ignore = false;

    const getDataFunc = async () => {
      try {
        clientLogger.debug('ユーザ一覧画面', 'ユーザリスト取得開始', { page, searchParams });
        setUserLoading(true);
        const queryString = buildQueryString(searchParams, page, pageSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userData = await apiGet<any>(`/api/users?${queryString}`);
        const count = userData.totalCount || (userData.data ? userData.data.length : 0);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        if (!ignore) {
          // 日付をフォーマット（日本時間）
          const formattedUsers = userData.data.map((user: typeof userData.data[0]) => ({
            ...user,
            tags: user.tags.split(","),
            created_at: formatDateJST(user.created_at),
            updated_at: formatDateJST(user.updated_at),
          }));
          setMenuItems(formattedUsers);
        }
        clientLogger.info('ユーザ一覧画面', 'ユーザリスト取得成功', {
          page,
          count: userData.data?.length,
          result: userData.data,
        });
        setUserLoading(false);
      } catch (err) {
        if (!ignore) setMenuItems([]);
        clientLogger.error('ユーザ一覧画面', 'データ取得失敗', {
          page,
          error: err instanceof Error ? err.message : String(err),
        });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!ignore) {
          setUserLoading(false);
        }
      }
    };
    getDataFunc();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, searchParams, isInitialized]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setTagLoading(true);
        setTagError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>('/api/tags');

        if (result.success && Array.isArray(result.data)) {
          const tagOptions = result.data.map((tag: { id: number; name: string }) => ({
            value: tag.name,
            label: tag.name,
          }));
          setTagOptions(tagOptions);
        } else {
          setTagError('タグの取得に失敗しました');
        }
      } catch (err) {
        clientLogger.error('ユーザ一覧画面', 'タグ取得エラー', { error: err instanceof Error ? err.message : String(err) });
        setTagError(err instanceof Error ? err.message : 'タグの取得に失敗しました');
      } finally {
        setTagLoading(false);
      }
    };
    fetchTags();
  }, []);

  const handleTagChange = (tagName: string, selectedValues: string[]) => {
    setFormValues(prev => ({
      ...prev,
      [tagName]: selectedValues
    }));
  };

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
    { key: 'user_role', header: '権限', },
    { key: 'tags', header: 'タグ', },
    { key: 'is_deleted', header: 'ステータス', },
  ];

  // ユーザ新規登録画面遷移
  const toUserRegistPage = () => {
    clientLogger.info('ユーザ一覧画面', 'ユーザ登録ボタン押下');
    router.push('/user/regist');
  };

  // ユーザ編集画面遷移
  const toUserEditPage = (id: number) => {
    clientLogger.info('ユーザ一覧画面', '編集ボタン押下', { userId: id });
    router.push(`/user/${id}/edit`);
  };
  // ユーザインポート実施画面遷移
  const toUserImportPage = () => {
    clientLogger.info('ユーザ一覧画面', 'インポートボタン押下');
    router.push('user/userImportExecute');
  };

  const userDelete = async () => {
    if (!selectedUser) {
      throw new Error('削除対象ユーザが見つかりません')
    }
    clientLogger.info('ユーザ一覧画面', '削除ボタン押下', { userId: selectedUser.id });

    try {
      setDelLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiDelete<any>(`/api/users/${selectedUser.id}`);

      if (result.success) {
        clientLogger.info('ユーザ一覧画面', 'ユーザ削除成功', { userId: selectedUser.id });
        // ユーザ一覧再描画
        const queryString = buildQueryString(searchParams, page, pageSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newUserData = await apiGet<any>(`/api/users?${queryString}`);
        const count = newUserData.totalCount || (newUserData.data ? newUserData.data.length : 0);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        // 日付をフォーマット（日本時間）
        const formattedUsers = newUserData.data.map((user: typeof newUserData.data[0]) => ({
          ...user,
          tags: user.tags.split(","),
          created_at: formatDateJST(user.created_at),
          updated_at: formatDateJST(user.updated_at),
        }));
        setMenuItems(formattedUsers);

        setModalMessage(result.message);
        setIsDelModalOpen(true);
      } else {
        clientLogger.error('ユーザ一覧画面', 'ユーザ削除失敗', { error: result.error instanceof Error ? result.error.message : String(result.error) });
        setModalMessage('ユーザの削除に失敗しました');
        setIsDelModalOpen(true);
      }
    } catch (err) {
      clientLogger.error('ユーザ一覧画面', 'ユーザ一削除エラー', { error: err instanceof Error ? err.message : String(err) });
      setModalMessage('ユーザの削除に失敗しました');
      setIsDelModalOpen(true);
    } finally {
      setDelLoading(false);
    }
  };

  const renderActions = (item: UserListTableRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button onClick={() => toUserEditPage(item.id)}>
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

  const updatedItems = menuItems.map(item => {
    let userRole;
    switch (item.user_role) {
      case 0:
        userRole = ROLE_OPTIONS.SYSTEM_ADMIN;
        break;
      case 1:
        userRole = ROLE_OPTIONS.TEST_MANAGER;
        break;
      default:
        userRole = ROLE_OPTIONS.GENERAL;
    }
    return {
      ...item,
      user_role: userRole,
      is_deleted: item.is_deleted
        ? '無効' : '有効'
    };
  });

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'email',
      name: 'email',
      value: formValues.email,
      onChange: () => { },
      placeholder: 'ID (メールアドレス)',
      maxLength: 255
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: formValues.name,
      onChange: () => { },
      placeholder: '氏名',
      maxLength: 255
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: formValues.department,
      onChange: () => { },
      placeholder: '部署',
      maxLength: 255
    },
    {
      label: '会社名',
      type: 'text',
      name: 'company',
      value: formValues.company,
      onChange: () => { },
      placeholder: '会社名',
      maxLength: 255
    },
    {
      label: '権限',
      type: 'select',
      name: 'user_role',
      value: formValues.user_role,
      onChange: () => { },
      placeholder: '権限',
      options: Object.values(ROLE_OPTIONS).map(user_role => ({
        value: user_role,
        label: user_role
      }))
    },
    {
      label: 'ステータス',
      type: 'select',
      name: 'status',
      value: formValues.status,
      onChange: () => { },
      placeholder: 'ステータス',
      options: Object.values(STATUS_OPTIONS).map(status => ({
        value: status,
        label: status,
      }))
    },
    {
      label: 'タグ',
      type: 'tag',
      name: 'tags',
      value: formValues.tags || [],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('tags', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグ',
      options: tagOptions
    },
  ];

  /// 検索フォームのデータが更新されたときに呼び出される
  const handleFormDataChange = (formData: Record<string, string | string[]>) => {
    setFormValues(formData);
  };

  const handleSearch = () => {
    // 検索ボタン押下時、フォーム値を検索パラメータに設定してURLを更新
    setSearchParams(formValues);
    setPage(1); // ページを1にリセット
    updateUrlParams(router, formValues, pagePath, 1);
    clientLogger.info('ユーザ一覧画面', '検索ボタン押下', { formValues });
  };

  // ページ変更時にURLも更新
  const handlePageChange = (pageNum: number) => {
    setPage(pageNum);
    updateUrlParams(router, searchParams, pagePath, pageNum);
  };

  // UserListContainer.tsxでの呼び出しイメージ
  const handleExportError = (error: Error) => {
    clientLogger.error('ユーザ一覧画面', 'エクスポート失敗', { error: error.message });
    setModalMessage('エクスポートに失敗しました。');
    setIsDelModalOpen(true);
  };

  return (
    <div>
      {/* タグ読み込みエラー表示 */}
      {tagError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">{tagError}</p>
        </div>
      )}
      {/* ユーザ一覧のデータ読み込み中の表示 */}
      <Loading
        isLoading={tagLoading || delLoading}
        message={tagLoading || userLoading ? "データを読み込み中..." : "データ削除中..."}
        size="md"
      />
      {!userLoading && !tagLoading && !delLoading && (
        <>
          <SeachForm fields={fields} onClick={handleSearch} onFormDataChange={handleFormDataChange} /><div className="text-right space-x-2 pb-2">
            <Button
              onClick={() => toUserRegistPage()}
            >
              ユーザ登録
            </Button>
            <ExportButton onError={handleExportError} />
            <Button
              onClick={() => toUserImportPage()}
            >
              インポート
            </Button>
          </div>
          {
            updatedItems.length > 0 ? (
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
            ) : (
              <div className="text-gray-500 text-center py-8">ユーザデータがありません</div>
            )
          }
        </>
      )}
      {/* 削除対象表示モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">本当にこのユーザを削除しますか？</p>
        {selectedUser && <p className="mb-8">対象ユーザ: {selectedUser.name}</p>}
        <div className="flex justify-center space-x-5">
          <Button className="w-24 bg-red-600 text-white" onClick={() => {
            setIsModalOpen(false);
            userDelete();
          }}>削除</Button>
          <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
      {/* 削除完了モーダル */}
      <Modal open={isDelModalOpen} onClose={() => setIsDelModalOpen(false)}>
        <p className="mb-8 text-black font-bold text-center">
          {modalMessage}
        </p>
        <div className="flex justify-center">
          <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsDelModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
}