'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clientLogger from '@/utils/client-logger';
import { Column } from '@/components/datagrid/DataGrid';
import { TestGroupListRow } from '../../_components/types/testGroup-list-row';
import { TestGroupList } from './TestGroupList';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import SeachForm from '@/components/ui/searchForm';
import { getDataCount, getDataList } from '../action';

export function TestGroupListContainer() {
  const [menuItems, setMenuItems] = useState<TestGroupListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TestGroupListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const pageSize = 10;
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTestGroup, setSelectedTestGroup] = useState<TestGroupListRow | null>(null);
  const [newid, setNewid] = useState<number | null>(null);
  const [modalContent, setModalContent] = useState<'initial' | 'confirm'>('initial');

  useEffect(() => {
    const getDataCountFunc = async () => {
      try {
        clientLogger.info('TestGroupListContainer', 'テスト数取得開始');
        const result = await getDataCount();
        clientLogger.info('TestGroupListContainer', 'テスト数取得レスポンス', {
          resultExists: !!result,
          resultType: typeof result,
          hasSuccess: result && typeof result === 'object' && 'success' in result,
        });

        if (!result || typeof result !== 'object' || !('success' in result)) {
          throw new Error('Invalid response from getDataCount: ' + JSON.stringify(result));
        }

        if (!result.success || result.data === undefined) {
          throw new Error('データの取得に失敗しました' + ` (error: ${result.error})`);
        }
        setTotalCount(result.data);
        setPageCount(Math.ceil(result.data / pageSize));
        clientLogger.info('TestGroupListContainer', 'テスト数取得成功', { count: result.data });
      } catch (err) {
        clientLogger.error('TestGroupListContainer', 'テスト数取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    getDataCountFunc();
  }, []);

  useEffect(() => {
    let ignore = false;
    clientLogger.info('TestGroupListContainer', 'データ取得開始', { page });

    const getDataListFunc = async () => {
      try {
        clientLogger.info('TestGroupListContainer', 'リスト取得開始', { page });
        const testGroupData = await getDataList({ page: page });
        clientLogger.info('TestGroupListContainer', 'リスト取得レスポンス', {
          page,
          dataExists: !!testGroupData,
          dataType: typeof testGroupData,
          hasSuccess: testGroupData && typeof testGroupData === 'object' && 'success' in testGroupData,
        });

        if (!testGroupData || typeof testGroupData !== 'object' || !('success' in testGroupData)) {
          throw new Error('Invalid response from getDataList: ' + JSON.stringify(testGroupData));
        }

        if (!testGroupData.success || !Array.isArray(testGroupData.data)) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testGroupData.error})`);
        }

        if (!ignore) {
          setMenuItems(testGroupData.data);
          // TODO:IDの最大値＋１は事故る気がするので将来的にはシーケンス管理しているID表から発行したい。
          // ID発酵処理はテストグループ複製画面で実行する想定。
          const latestId = Math.max(...testGroupData.data.map((item: { id: unknown }) => item.id as number));
          setNewid(latestId + 1);
        }
        clientLogger.info('TestGroupListContainer', 'リスト取得成功', {
          page,
          count: testGroupData.data?.length,
        });
      } catch (err) {
        if (!ignore) setMenuItems([]);
        clientLogger.error('TestGroupListContainer', 'リスト取得失敗', {
          page,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    getDataListFunc();
    return () => {
      ignore = true;
    };
  }, [page]);

  const handleSort = (key: keyof TestGroupListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns: Column<TestGroupListRow>[] = [
    { key: 'id', header: 'ID', isLink: true, linkPrefix: '/testCase' },
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
    router.push(`/testGroup/${id}/edit`);
  };

  const testGroupDelete = () => {
    if (selectedTestGroup) {
      console.log("テストグループ削除", selectedTestGroup.id);
      setIsModalOpen(false);
    }
  };

  const toTestSummaryResultPage = (id: number) => {
    // テストグループ編集画面への遷移処理
    router.push(`/testGroup/${id}/testSummaryResult`);
  };

  const toTestGroupCopyPage = (id: number) => {
    // テストグループ複製画面への遷移処理
    router.push(`/testGroup/${id}/copy`);
  }

  const renderActions = (item: TestGroupListRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button
        onClick={() => toTestGroupEditPage(item.id)}
      >
        編集
      </Button>
      <Button
        onClick={() => {
          setSelectedTestGroup(item);
          setIsModalOpen(true);
          setModalContent('initial');
        }}
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
      value: '',
      onChange: () => { },
      placeholder: 'OEM'
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: '',
      onChange: () => { },
      placeholder: '機種'
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: '',
      onChange: () => { },
      placeholder: 'イベント'
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: '',
      onChange: () => { },
      placeholder: 'バリエーション'
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: '',
      onChange: () => { },
      placeholder: '仕向'
    },
  ];

  const handleSearch = () => {
    // 検索処理をここに記述
    console.log('検索クエリ:', FormData);
  };

  const handleAddTestGroup = () => {
    // テストグループ追加処理をここに記述
    console.log('テストグループ新規作成');
  };

  return (
    <div>
      <SeachForm fields={fields} onClick={handleSearch} />
      <div className="text-right pb-2">
        <Button onClick={handleAddTestGroup} variant="default">
          <Link href="/testGroup/regist">
            テストグループ新規登録
          </Link>
        </Button>
      </div>
      <TestGroupList
        items={sortedItems}
        columns={columns}
        sortConfig={sortConfig}
        page={page}
        pageCount={pageCount}
        onSort={handleSort}
        onPageChange={setPage}
        renderActions={renderActions}
      />
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8 text-red-600 font-bold text-center">
          {modalContent === 'initial'
            ? (
              <>
                本当にこのテストグループを削除しますか？<br />
                この操作は取り消せません。削除すると、関連する20件のテストケースが失われます。
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
            if (modalContent === 'initial') {
              setModalContent('confirm');
            } else {
              testGroupDelete();
            }
          }}>削除</Button>
          <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
}