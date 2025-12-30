import ButtonGroup from '@/components/ui/buttonGroup';
import ImportInfoView from '@/components/ui/importInfoView';
import { useRouter } from 'next/navigation';
import { ImportInfoListRow } from './types/import-info-list-row';

export type ImportInfoState = ImportInfoListRow;

type ImportInfoProps = {
  labels: {
    file_name: { name: string; type: 'text' };
    count: { name: string; type: 'text' };
    created_at: { name: string; type: 'text' };
    import_status: { name: string; type: 'text' };
    executor_name: { name: string; type: 'text' };
    message: { name: string; type: 'text' };
  };
  values: {
    file_name: string;
    count: string;
    created_at: string;
    import_status: string;
    executor_name: string;
    message: string;
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