'use client';

import { Column } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { Modal } from '@/components/ui/modal';
import SeachForm from '@/components/ui/searchForm';
import { apiDelete, apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { formatDateJST } from '@/utils/date-formatter';
import { buildQueryString, updateUrlParams } from '@/utils/queryUtils';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TestCaseList } from './TestCaseList';
import { TestCaseListRow } from './types/testCase-list-row';
export function TestCaseListContainer() {
  const [menuItems, setMenuItems] = useState<TestCaseListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TestCaseListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseListRow | null>(null);
  const [newid, setNewid] = useState<number | null>(null);
  const [testCaseLoading, setTestCaseLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [isDelModalOpen, setIsDelModalOpen] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const pageSize = 10;
  const router = useRouter();
  const pathName = usePathname();
  const searchParamsQuery = useSearchParams();
  const params = useParams();
  const testGroupId = params.groupId;
  const pagePath = `/testGroup/${testGroupId}/testCase`;

  // フォーム入力値(リアルタイムで変更)
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({
    tid: '',
    first_layer: '',
    second_layer: '',
    third_layer: '',
    fourth_layer: '',
  });

  // 検索パラメータ(検索ボタン押下時に更新)
  const [searchParams, setSearchParams] = useState<Record<string, string | string[]>>({
    tid: '',
    first_layer: '',
    second_layer: '',
    third_layer: '',
    fourth_layer: '',
  });

  // URLパラメータをコンポーネントの状態に同期する
  useEffect(() => {
    const params: Record<string, string | string[]> = {
      tid: searchParamsQuery.get('tid') || '',
      first_layer: searchParamsQuery.get('first_layer') || '',
      second_layer: searchParamsQuery.get('second_layer') || '',
      third_layer: searchParamsQuery.get('third_layer') || '',
      fourth_layer: searchParamsQuery.get('fourth_layer') || '',
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
        clientLogger.debug('テストケース一覧画面', 'テストケースリスト取得開始', { page, searchParams });
        setTestCaseLoading(true);
        const queryString = buildQueryString(searchParams, page, pageSize)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>(`/api/test-groups/${testGroupId}/cases?${queryString}`);
        const count = result.totalCount || (result.data ? result.data.length : 0);
        setCanEdit(result.isCanModify);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        if (!ignore) {
          // 日付をフォーマット（日本時間）
          const formattedTestCases = result.data.map((testcase: typeof result.data[0]) => ({
            ...testcase,
            created_at: formatDateJST(testcase.created_at),
            updated_at: formatDateJST(testcase.updated_at),
          }));
          setMenuItems(formattedTestCases);
          const latestId = Math.max(...result.data.map((item: { tid: number }) => item.tid));
          setNewid(latestId + 1);
        }
        clientLogger.debug('テストケース一覧画面', 'テストケースリスト取得成功', {
          page,
          count: result.data.length,
        });
      } catch (err: unknown) {
        if (!ignore) setMenuItems([]);
        if (err instanceof Error) {
          clientLogger.error('テストケース一覧画面', 'テストケースリスト取得失敗', {
            page,
            error: err.message,
          });
        }
      } finally {
        if (!ignore) {
          setTestCaseLoading(false);
        }
      }
    };
    getDataFunc();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, searchParams, isInitialized])

  const handleSort = (key: keyof TestCaseListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns: Column<TestCaseListRow>[] = [
    {
      key: 'tid', header: 'TID',
      render: (value: number) => (
        <Link href={`/testGroup/${testGroupId}/testCase/${value}/result`} style={{ color: 'blue', textDecoration: 'underline' }}>
          {value}
        </Link>
      ),
    },
    { key: 'first_layer', header: '第1層' },
    { key: 'second_layer', header: '第2層' },
    { key: 'third_layer', header: '第3層' },
    { key: 'fourth_layer', header: '第4層' },
    { key: 'request_id', header: '要求ID' },
    { key: 'created_at', header: '作成日' },
    { key: 'updated_at', header: '更新日' },
  ];

  const toTestCaseEditPage = (id: string) => {
    clientLogger.info('テストケース一覧画面', '編集ボタン押下');
    router.push(`${pathName}/${id}/edit`);
  };

  const testCaseDelete = async () => {
    if (!selectedTestCase) {
      throw new Error('tid is null');
    }

    clientLogger.info('テストケース一覧画面', '削除ボタン押下', selectedTestCase.tid);
    try {
      setDelLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiDelete<any>(`/api/test-groups/${testGroupId}/cases/${selectedTestCase.tid}`);
      if (result.success) {
        clientLogger.info('テストケース一覧画面', 'テストケース削除成功', { tid: selectedTestCase.tid });
        // テストケース一覧再描画
        const queryString = buildQueryString(searchParams, page, pageSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newList = await apiGet<any>(`/api/test-groups/${testGroupId}/cases?/${queryString}`);
        const count = newList.totalCount || (newList.data ? newList.data.length : 0);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        // 日付をフォーマット（日本時間）
        const formattedNewList = newList.data.map((testcase: typeof newList.data[0]) => ({
          ...testcase,
          created_at: formatDateJST(testcase.created_at),
          updated_at: formatDateJST(testcase.updated_at),
        }));
        setMenuItems(formattedNewList);

        setModalMessage('テストケースを削除しました');
        setIsDelModalOpen(true);
      } else {
        clientLogger.error('テストケース一覧画面', 'テストケース削除失敗', { error: result.error });
        setModalMessage('テストケースの削除に失敗しました');
        setIsDelModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('テストケース一覧画面', 'テストケース削除エラー', { error });
      setModalMessage('テストケースの削除に失敗しました');
      setIsDelModalOpen(true);
    } finally {
      setDelLoading(false);
    }
  };

  const renderActions = (item: TestCaseListRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button
        disabled={!canEdit}
        onClick={() => toTestCaseEditPage(item.tid)}
      >
        編集
      </Button>
      <Button
        disabled={!canEdit}
        onClick={() => {
          setSelectedTestCase(item);
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

  const fields = [
    {
      label: 'TID',
      type: 'text',
      name: 'tid',
      value: '',
      onChange: () => { },
      placeholder: 'TID'
    },
    {
      label: '第1層',
      type: 'text',
      name: 'first_layer',
      value: '',
      onChange: () => { },
      placeholder: '第1層'
    },
    {
      label: '第2層',
      type: 'text',
      name: 'second_layer',
      value: '',
      onChange: () => { },
      placeholder: '第2層'
    },
    {
      label: '第3層',
      type: 'text',
      name: 'third_layer',
      value: '',
      onChange: () => { },
      placeholder: '第3層'
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourth_layer',
      value: '',
      onChange: () => { },
      placeholder: '第4層'
    }
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
    clientLogger.info('テストケース一覧画面', '検索ボタン押下', { formValues });
  };

  // ページ変更時にURLも更新
  const handlePageChange = (pageNum: number) => {
    setPage(pageNum);
    updateUrlParams(router, searchParams, pagePath, pageNum);
  };

  const handleAddTestCase = () => {
    // テストケース追加処理をここに記述
    clientLogger.info('テストケース一覧画面', 'テストケース新規登録ボタン押下');
    router.push(`${pathName}/regist`);
  };

  // ユーザインポート実施画面遷移
  const toTestImportPage = () => {
    clientLogger.info('テストケース一覧画面', 'インポートボタン押下');
    router.push(`/testGroup/${testGroupId}/testCase/testImportExecute`);
  };

  return (
    <div>
      {/* テストケース一覧データ読み込み中の表示 */}
      <Loading
        isLoading={delLoading || testCaseLoading}
        message={delLoading ? "データ削除中..." : "データ読み込み中..."}
        size="md"
      />
      {!testCaseLoading && !delLoading && (
        <>
          <SeachForm fields={fields} values={formValues} onClick={handleSearch} onFormDataChange={handleFormDataChange} /><div className="text-right space-x-2 pb-2">
            <Button onClick={handleAddTestCase} disabled={!canEdit}>
              テストケース新規登録
            </Button>
            <Button
              onClick={() => toTestImportPage()}
            >
              インポート
            </Button>
          </div>
          {sortedItems.length > 0 ? (
            <TestCaseList
              items={sortedItems}
              columns={columns}
              sortConfig={sortConfig}
              page={page}
              pageCount={pageCount}
              onSort={handleSort}
              onPageChange={handlePageChange}
              renderActions={renderActions}
            />
          ) : (
            <div className="text-gray-500 text-center py-8">テストケースがありません</div>
          )}
          <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <p className="mb-8">本当にこのテストケースを削除しますか？</p>
            {selectedTestCase && <p className="mb-8">対象テストケース: {selectedTestCase.tid}</p>}
            <div className="flex justify-center space-x-5">
              <Button className="w-24 bg-red-600 text-white" onClick={
                () => {
                  setIsModalOpen(false)
                  testCaseDelete();
                }}>削除</Button>
              <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsModalOpen(false)}>閉じる</Button>
            </div>
          </Modal>
        </>
      )}
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