import DetailView from '@/components/ui/detailView';
import React from 'react';
import { ImportInfoListRow } from './types/import-info-list-row';
import { useRouter } from 'next/navigation';
import ButtonGroup from '@/components/ui/buttonGroup';
import ImportInfoView from '@/components/ui/importInfoView';

export type ImportInfoState = ImportInfoListRow;

type ImportInfoProps = {
  labels: {
    fileName: { name: string; type: 'text' };
    count: { name: string; type: 'text' };
    importDate: { name: string; type: 'text' };
    importStatus: { name: string; type: 'text' };
    execterName: { name: string; type: 'text' };
    errorDetails: { name: string; type: 'text' };
  };
  values: {
    fileName: string;
    count: string;
    importDate: string;
    importStatus: string;
    execterName: string;
    errorDetails: string;
  };
};

export function ImportInfo({ labels, values }: ImportInfoProps) {
  const router = useRouter();

  const handleCancel = () => {
    console.log('キャンセルされました');
    router.push('/importResult', { scroll: false });
  };

  const buttons = [
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true
    }
  ];

  return (
    <section>
      <div className="flex justify-center item-center mb-4">
        <ImportInfoView labels={labels} values={values} />
      </div>
      <ButtonGroup buttons={buttons} />
    </section>
  );
}