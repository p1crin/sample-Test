"use client"
import { TestGroupListRow } from './types/testGroup-list-row';
import { Modal } from "@/components/ui/modal";
import { useState } from 'react';
import DetailView from '@/components/ui/detailView';

export default function TestGroupInfoTableModal() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = () => {
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
  };

  const sampleValues: TestGroupListRow = {
    id: 1,
    oem: "OEM1OEM1OEM1",
    model: "機種1機種1機種1",
    event: "イベント1イベント1イベント1",
    variation: "バリエーション1バリエーション1バリエーション1",
    destination: "仕向1仕向1仕向1",
    specs: "制御仕様名1",
    testDatespan: "2025/09/09～2025/09/12",
    ngPlanCount: "30",
    created_at: "2025/09/25",
    updated_at: "2025/09/25"
  };

  const detailViewValues = {
    testGroupId: sampleValues.id.toString(),
    oem: sampleValues.oem,
    model: sampleValues.model,
    event: sampleValues.event,
    variation: sampleValues.variation,
    destination: sampleValues.destination,
    specs: sampleValues.specs,
    testDatespan: sampleValues.testDatespan,
    ngPlanCount: sampleValues.ngPlanCount,
    createdAt: sampleValues.created_at,
    updatedAt: sampleValues.updated_at
  };

  const labels = {
    testGroupId: { name: 'ID', type: 'text' as const },
    oem: { name: 'OEM', type: 'text' as const },
    model: { name: '機種', type: 'text' as const },
    event: { name: 'イベント', type: 'text' as const },
    variation: { name: 'バリエーション', type: 'text' as const },
    destination: { name: '仕向', type: 'text' as const },
    specs: { name: '制御仕様名', type: 'text' as const },
    testDatespan: { name: '試験予定期間', type: 'text' as const },
    ngPlanCount: { name: '不具合摘出予定数', type: 'text' as const },
    createdAt: { name: '作成日', type: 'text' as const },
    updatedAt: { name: '更新日', type: 'text' as const },
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