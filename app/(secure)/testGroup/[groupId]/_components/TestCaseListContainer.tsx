'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from "next/navigation";
import clientLogger from '@/utils/client-logger';
import { Column } from '@/components/datagrid/DataGrid';
import { TestCaseListRow } from './types/testCase-list-row';
import { TestCaseList } from './TestCaseList';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import ImportButton from '@/components/ui/importButton';
import SeachForm from '@/components/ui/searchForm';
import type { TestCase } from '@/types';

export function TestCaseListContainer() {
  const [menuItems, setMenuItems] = useState<TestCaseListRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof TestCaseListRow;
    direction: 'asc' | 'desc';
  } | null>(null);
  const pageSize = 10;
  const router = useRouter();
  const pathname = usePathname();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCaseListRow | null>(null);

  // Extract groupId from pathname
  const groupId = parseInt(pathname.split('/')[2] || '0', 10);

  useEffect(() => {
    const getDataCountFunc = async () => {
      try {
        const response = await fetch(`/api/test-groups/${groupId}/cases`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        const count = result.testCases ? (Array.isArray(result.testCases) ? result.testCases.length : 0) : 0;
        setPageCount(Math.ceil(count / pageSize));
      } catch (err) {
        clientLogger.error('TestCaseListContainer', 'データ取得失敗', {
          page,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    if (groupId > 0) {
      getDataCountFunc();
    }
  }, [groupId, pageSize]);

  useEffect(() => {
    let ignore = false;
    clientLogger.info('TestCaseListContainer', 'データ取得開始', { page, groupId });

    const getDataListFunc = async () => {
      try {
        const response = await fetch(`/api/test-groups/${groupId}/cases?page=${page}&limit=${pageSize}`);

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        if (!Array.isArray(result.testCases)) {
          throw new Error('Invalid API response');
        }

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        if (!ignore) {
          setMenuItems(result.testCases.slice(startIndex, endIndex).map((testCase: TestCase) => ({
            tid: testCase.tid,
            firstLayer: testCase.first_layer,
            secondLayer: testCase.second_layer,
            thirdLayer: testCase.third_layer,
            fourthLayer: testCase.fourth_layer,
            purpose: testCase.purpose,
            requestId: testCase.request_id,
            checkItems: testCase.test_procedure,
            createdAt: testCase.created_at ? testCase.created_at.toString().split('T')[0] : '',
            updatedAt: testCase.updated_at ? testCase.updated_at.toString().split('T')[0] : '',
            chartData: {
              okCount: 0,
              ngCount: 0,
              notStartCount: 0,
              excludedCount: 0,
            },
          })));
        }
        clientLogger.info('TestCaseListContainer', 'データ取得成功', {
          page,
          count: result.testCases?.length,
        });
      } catch (err) {
        if (!ignore) setMenuItems([]);
        clientLogger.error('TestCaseListContainer', 'データ取得失敗', {
          page,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    if (groupId > 0) {
      getDataListFunc();
    }
    return () => {
      ignore = true;
    };
  }, [page, groupId, pageSize]);

  const handleSort = (key: keyof TestCaseListRow) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const columns: Column<TestCaseListRow>[] = [
    { key: 'tid', header: 'TID', isLink: true, linkPrefix: `/result` },
    { key: 'firstLayer', header: '第1層' },
    { key: 'secondLayer', header: '第2層' },
    { key: 'thirdLayer', header: '第3層' },
    { key: 'fourthLayer', header: '第4層' },
    { key: 'requestId', header: '要求ID' },
    { key: 'createdAt', header: '作成日' },
    { key: 'updatedAt', header: '更新日' },
  ];

  const toTestCaseEditPage = (id: string) => {
    console.log("テストケース編集画面へ");
    router.push(`${pathname}/${id}/edit`);
  };

  const testCaseDelete = () => {
    if (selectedTestCase) {
      console.log("テストケース削除", selectedTestCase.tid);
      setIsModalOpen(false);
    }
  };

  const renderActions = (item: TestCaseListRow) => (
    <div className="flex items-center justify-end space-x-4 w-full box-border pr-4">
      <Button
        variant="default"
        onClick={() => toTestCaseEditPage(item.tid)}
      >
        編集
      </Button>
      <Button
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
      name: 'firstLayer',
      value: '',
      onChange: () => { },
      placeholder: '第1層'
    },
    {
      label: '第2層',
      type: 'text',
      name: 'secondLayer',
      value: '',
      onChange: () => { },
      placeholder: '第2層'
    },
    {
      label: '第3層',
      type: 'text',
      name: 'thirdLayer',
      value: '',
      onChange: () => { },
      placeholder: '第3層'
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourthLayer',
      value: '',
      onChange: () => { },
      placeholder: '第4層'
    }
  ];
  const handleSearch = () => {
    // 検索処理をここに記述
    console.log('検索クエリ:', FormData);
  };

  const handleAddTestCase = () => {
    // テストケース追加処理をここに記述
    router.push(`${pathname}/regist`);
  };

  return (
    <div>
      <SeachForm fields={fields} onClick={handleSearch} />
      <div className="text-right space-x-2 pb-2">
        <Button onClick={handleAddTestCase} variant="default">
          テストケース新規登録
        </Button>
        <ImportButton type={'test'} />
      </div>
      <TestCaseList
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
        <p className="mb-8">本当にこのテストケースを削除しますか？</p>
        {selectedTestCase && <p className="mb-8">対象テストケース: {selectedTestCase.tid}</p>}
        <div className="flex justify-center space-x-5">
          <Button className="w-24 bg-red-600 text-white" onClick={testCaseDelete}>削除</Button>
          <Button className="w-24 bg-gray-500 hover:bg-gray-400" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}