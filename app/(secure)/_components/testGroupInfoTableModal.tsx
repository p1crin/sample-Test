"use client"
import DetailView from '@/components/ui/detailView';
import { Modal } from "@/components/ui/modal";
import { apiGet } from '@/utils/apiClient';
import { formatDateJST } from '@/utils/date-formatter';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TestGroupModalRow } from './types/testGroup-list-row';
import clientLogger from '@/utils/client-logger';

export default function TestGroupInfoTableModal() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testGroupData, setTestGroupData] = useState({
    id: 0,
    oem: '',
    model: '',
    event: '',
    variation: '',
    destination: '',
    specs: '',
    testDatespan: '',
    ngPlanCount: '',
    created_at: '',
    updated_at: '',
  });
  const params = useParams();
  const groupId = params.groupId;
  const openModal = () => {
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
  };
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;

  useEffect(() => {
    const getTestGroup = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const testGroup = await apiGet<any>(`/api/test-groups/${groupId}`);
        const testGroupVal = testGroup.data;

        const viewValues: TestGroupModalRow = {
          id: testGroupVal.id,
          oem: testGroupVal.oem,
          model: testGroupVal.model,
          event: testGroupVal.event,
          variation: testGroupVal.variation,
          destination: testGroupVal.destination,
          specs: testGroupVal.specs,
          testDatespan: formatDateJST(testGroupVal.test_startdate) + '～' + formatDateJST(testGroupVal.test_enddate),
          ngPlanCount: testGroupVal.ng_plan_count,
          created_at: formatDateJST(testGroupVal.created_at),
          updated_at: formatDateJST(testGroupVal.updated_at)
        };
        setTestGroupData(viewValues);
        clientLogger.info('テストグループ情報モーダル', 'データ取得成功', { data: viewValues.id });
      } catch (err) {
        clientLogger.error('テストグループ情報モーダル', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    getTestGroup();
  }, []);

  const detailViewValues = {
    ...testGroupData,
    id: testGroupData.id.toString(),
    ngPlanCount: testGroupData.ngPlanCount.toString()
  }

  const labels = {
    id: { name: 'ID', type: 'text' as const },
    oem: { name: 'OEM', type: 'text' as const },
    model: { name: '機種', type: 'text' as const },
    event: { name: 'イベント', type: 'text' as const },
    variation: { name: 'バリエーション', type: 'text' as const },
    destination: { name: '仕向', type: 'text' as const },
    specs: { name: '制御仕様名', type: 'text' as const },
    testDatespan: { name: '試験予定期間', type: 'text' as const },
    ngPlanCount: { name: '不具合摘出予定数', type: 'text' as const },
    created_at: { name: '作成日', type: 'text' as const },
    updated_at: { name: '更新日', type: 'text' as const },
  };

  return (
    <>
      <button onClick={openModal} className="ml-2 p-1 border border-black rounded-full w-6 h-6 flex items-center justify-center font-bold border-2">
        i
      </button>
      <Modal open={isModalOpen} onClose={closeModal}>
        <button onClick={closeModal} className="absolute top-2 right-2 text-xl">×</button>
        <h1 className="text-l font-bold ">テストグループ情報</h1>
        <DetailView
          labels={labels}
          values={detailViewValues}
          isFull={true}
        />
      </Modal>
    </>
  );
}