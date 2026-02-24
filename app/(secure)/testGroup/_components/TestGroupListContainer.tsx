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
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TestGroupListRow } from '../../_components/types/testGroup-list-row';
import { TestGroupList } from './TestGroupList';

export function TestGroupListContainer() {
  const router = useRouter();
  const searchParamsQuery = useSearchParams();
  const [menuItems, setMenuItems] = useState<TestGroupListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [totalTestCase, setTotalTestCase] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TestGroupListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isdelModalOpen, setIsDelModalOpen] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [selectedTestGroup, setSelectedTestGroup] = useState<TestGroupListRow | null>(null);
  const [newid, setNewid] = useState<number | null>(null);
  const [modalContent, setModalContent] = useState<'initial' | 'confirm'>('initial');
  const [testGroupLoading, setTestGroupLoading] = useState(false);

  const pageSize = 10;
  const pagepath = '/testGroup';
  const { data: session } = useSession();

  // 権限チェック: テスト管理者(1)または管理者(0)のみが新規作成・複製可能
  const canCreate = session?.user?.user_role !== undefined && session.user.user_role <= 1;

  // フォーム入力値（リアルタイムで変更）
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({
    oem: '',
    model: '',
    event: '',
    variation: '',
    destination: '',
  });

  // 検索パラメータ（検索ボタン押下時に更新）
  const [searchParams, setSearchParams] = useState<Record<string, string | string[]>>({
    oem: '',
    model: '',
    event: '',
    variation: '',
    destination: '',
  });
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;

  // URLパラメータをコンポーネント状態に同期する
  useEffect(() => {
    const params: Record<string, string> = {
      oem: searchParamsQuery.get('oem') || '',
      model: searchParamsQuery.get('model') || '',
      event: searchParamsQuery.get('event') || '',
      variation: searchParamsQuery.get('variation') || '',
      destination: searchParamsQuery.get('destination') || '',
    };

    let pageNum = parseInt(searchParamsQuery.get('page') || '1', 10);
    // もし結果が数値でない (NaN) なら、1を代入する
    if (isNaN(pageNum)) {
      pageNum = 1;
    }

    const hasPageInUrl = searchParamsQuery.get('page') !== null;

    setFormValues(params);
    setSearchParams(params);
    setPage(pageNum);
    setIsInitialized(true);

    // URLにpageパラメータがない場合は、URLを更新（初期表示やサイドバーからの遷移時）
    if (!hasPageInUrl) {
      updateUrlParams(router, params, pagepath, pageNum);
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
        clientLogger.debug('テストグループ一覧画面', 'テストグループリスト取得開始', { page, searchParams });
        setTestGroupLoading(true);
        const queryString = buildQueryString(searchParams, page, pageSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>(`/api/test-groups?${queryString}`);
        const count = result.totalCount || (result.data ? result.data.length : 0);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        if (!ignore) {
          // 日付をフォーマット（日本時間）
          const formattedTestGroups = result.data.map((group: typeof result.data[0]) => ({
            ...group,
            created_at: formatDateJST(group.created_at),
            updated_at: formatDateJST(group.updated_at),
          }));
          setMenuItems(formattedTestGroups);
          const latestId = Math.max(...result.data.map((item: { id: number }) => item.id));
          setNewid(latestId + 1);
        }
        clientLogger.debug('テストグループ一覧画面', 'テストグループリスト取得成功', { page, count: result.data?.length, result: result.data });
      } catch (err) {
        if (!ignore) setMenuItems([]);
        clientLogger.error('テストグループ一覧画面', 'テストグループリスト取得失敗', { page, error: err instanceof Error ? err.message : String(err) });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!ignore) {
          setTestGroupLoading(false);
        }
      }
    };
    getDataFunc();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, searchParams, isInitialized]);

  const handleSort = (key: keyof TestGroupListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };
  const toTestCasePage = (id: number) => {
    clientLogger.info('テストグループ一覧画面', 'IDリンク押下', { testGroupId: id })
  }
  const columns: Column<TestGroupListRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (value: number) => (
        <Link
          href={`/testGroup/${value}/testCase`}
          style={{ color: 'blue', textDecoration: 'underline' }}
          onClick={() => toTestCasePage(value)}>
          {value}
        </Link>
      ),
    },
    { key: 'oem', header: 'OEM' },
    { key: 'model', header: '機種' },
    { key: 'event', header: 'イベント' },
    { key: 'variation', header: 'バリエーション' },
    { key: 'destination', header: '仕向' },
    { key: 'created_at', header: '作成日' },
    { key: 'updated_at', header: '更新日' },
  ];

  const toTestGroupEditPage = (id: number) => {
    // テストグループ編集画面への遷移処理
    clientLogger.info('テストグループ一覧画面', '編集ボタン押下', { testGroupId: id });
    router.push(`/testGroup/${id}/edit`);
  };

  const toTestSummaryResultPage = (id: number) => {
    // テストグループ集計画面への遷移処理
    clientLogger.info('テストグループ一覧画面', '集計ボタン押下', { testGroupId: id });
    router.push(`/testGroup/${id}/testSummaryResult`);
  };

  const toTestGroupCopyPage = (id: number) => {
    // テストグループ複製画面への遷移処理
    clientLogger.info('テストグループ一覧画面', '複製ボタン押下', { testGroupId: id });
    router.push(`/testGroup/${id}/copy`);
  }

  const renderActions = (item: TestGroupListRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button
        onClick={() => toTestGroupEditPage(item.id)}
        disabled={!item.isCanModify}
      >
        編集
      </Button>
      <Button
        onClick={() => {
          setSelectedTestGroup(item);
          getTotalTestCase(item.id);
        }}
        disabled={!item.isCanModify}
      >
        削除
      </Button>
      <Button
        onClick={() => toTestSummaryResultPage(item.id)}
      >
        集計
      </Button>
      <Button
        onClick={() => toTestGroupCopyPage(item.id)}
        disabled={!canCreate}
      >
        複製
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
      label: 'OEM',
      type: 'text',
      name: 'oem',
      value: formValues.oem,
      onChange: () => { },
      placeholder: 'OEM',
      maxLength: 255
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: formValues.model,
      onChange: () => { },
      placeholder: '機種',
      maxLength: 255
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: formValues.event,
      onChange: () => { },
      placeholder: 'イベント',
      maxLength: 255
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: formValues.variation,
      onChange: () => { },
      placeholder: 'バリエーション',
      maxLength: 255
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: formValues.destination,
      onChange: () => { },
      placeholder: '仕向',
      maxLength: 255
    },
  ];

  const getTotalTestCase = async (id: number) => {

    clientLogger.info('テストグループ一覧画面', '削除ボタン押下', { testGroupId: id });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiGet<any>(`/api/test-groups/${id}/cases`);
      setTotalTestCase(result.totalCount);
      setIsModalOpen(true);
      setModalContent('initial');
    } catch (err) {
      clientLogger.error('テストグループ一覧画面', '関連テストグループケース件数取得エラー', { error: err instanceof Error ? err.message : String(err) });
      setApiError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 検索フォームのデータが更新されたときに呼び出される
  const handleFormDataChange = (formData: Record<string, string | string[]>) => {
    setFormValues(formData);
  };

  const handleSearch = () => {
    // 検索ボタン押下時、フォーム値を検索パラメータに設定してURLを更新
    setSearchParams(formValues);
    setPage(1); // ページを1にリセット
    updateUrlParams(router, formValues, pagepath, 1);
    clientLogger.info('テストグループ一覧画面', '検索ボタン押下', { formValues });
  };

  // ページ変更時にURLも更新
  const handlePageChange = (pageNum: number) => {
    setPage(pageNum);
    updateUrlParams(router, searchParams, pagepath, pageNum);
  };

  const handleAddTestGroup = () => {
    clientLogger.info('テストグループ一覧画面', 'テストグループ新規作成ボタン押下');
    router.push(`testGroup/regist`);
  };

  const handleDeleteTestGroup = async () => {
    if (selectedTestGroup === null) {
      throw new Error('groupId is NULL');
    }

    try {
      setDelLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiDelete<any>(`/api/test-groups/${selectedTestGroup.id}`);

      if (result.success) {
        clientLogger.info('テストグループ一覧画面', 'テストグループ削除成功', { testGroupId: selectedTestGroup.id });
        //テストグループ一覧再描画
        const queryString = buildQueryString(searchParams, page, pageSize);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newList = await apiGet<any>(`/api/test-groups?${queryString}`);
        const count = newList.totalCount || (newList.data ? newList.data.length : 0);
        setTotalCount(count);
        setPageCount(Math.ceil(count / pageSize));

        // 日付をフォーマット（日本時間）
        const formattedNewList = newList.data.map((group: typeof newList.data[0]) => ({
          ...group,
          created_at: formatDateJST(group.created_at),
          updated_at: formatDateJST(group.updated_at),
        }));
        setMenuItems(formattedNewList);

        setModalMessage('テストグループを削除しました');
        setIsDelModalOpen(true);
      } else {
        clientLogger.error('テストグループ一覧画面', 'テストグループ削除失敗', { error: result.error instanceof Error ? result.error.message : String(result.error) });
        setModalMessage('テストグループの削除に失敗しました');
        setIsDelModalOpen(true);
      }
    } catch (err) {
      clientLogger.error('テストグループ一覧画面', 'テストグループ削除エラー', { error: err instanceof Error ? err.message : String(err) });
      setModalMessage('テストグループの削除に失敗しました');
      setIsDelModalOpen(true);
    } finally {
      setDelLoading(false);
    }
  };

  return (
    <div>
      {/* テストグループデータ削除中の表示 */}
      <Loading
        isLoading={delLoading || testGroupLoading}
        message={delLoading ? "データ削除中..." : "データ読み込み中..."}
        size="md"
      />
      {!delLoading && !testGroupLoading && (
        <>
          <SeachForm fields={fields} values={formValues} onClick={handleSearch} onFormDataChange={handleFormDataChange} />
          <div className="text-right pb-2">
            <Button onClick={handleAddTestGroup} disabled={!canCreate}>
              テストグループ新規登録
            </Button>
          </div>
          {sortedItems.length > 0 ? (
            <TestGroupList
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
            <div className="text-gray-500 text-center py-8">テストグループがありません</div>
          )
          }
          <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
            <p className="mb-8 text-red-600 font-bold text-center">
              {modalContent === 'initial' && totalTestCase > 0
                ? (
                  <>
                    本当にこのテストグループを削除しますか？<br />
                    この操作は取り消せません。削除すると、関連する{totalTestCase}件のテストケースが失われます。
                  </>
                )
                : "本当に削除しますか？"}
            </p>
            {selectedTestGroup && (
              <p className="mb-8 text-red-600 font-bold text-center">
                対象テストグループID: {selectedTestGroup.id}
              </p>
            )}
            <div className="flex justify-center space-x-10">
              <Button className="w-24 bg-red-600 text-white" onClick={() => {
                if (modalContent === 'initial' && totalTestCase > 0) {
                  setModalContent('confirm');
                } else {
                  setIsModalOpen(false);
                  handleDeleteTestGroup();
                }
              }}>削除</Button>
              <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsModalOpen(false)}>
                閉じる
              </Button>
            </div>
          </Modal>
        </>
      )}

      <Modal open={isdelModalOpen} onClose={() => setIsDelModalOpen(false)}>
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