import { useEffect, useState } from 'react';
import ButtonGroup from '@/components/ui/buttonGroup';
import { CreateTestGroupListRow } from '../../../../_components/types/testGroup-list-row';
import { VerticalForm } from '@/components/ui/verticalForm';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { getTagOptions } from '../action';
import clientLogger from '@/utils/client-logger';

export type TestGroupEditFormState = CreateTestGroupListRow;

export type TestGroupEditChangeData = {
  target: {
    name: string;
    value: string;
    type: string;
  };
};

export type TestGroupEditFormProps = {
  groupName?: string;
  form: TestGroupEditFormState;
  errors: Record<string, string[]>;
  toastOpen: boolean;
  onChange: (e: TestGroupEditChangeData) => void;
  onClear: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onToastClose: () => void;
};

export function TestGroupEditForm({
  form,
  errors,
  toastOpen,
  onChange,
  onClear,
  onSubmit,
  onToastClose,
}: TestGroupEditFormProps) {
  const router = useRouter();
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    async function fetchTagOptions() {
      const result = await getTagOptions();
      if (result.success && result.data) {
        setTagOptions(result.data);
      }
    }
    fetchTagOptions();
  }, []);

  // 更新ボタン押下時処理
  const handleEditer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(e as React.FormEvent<HTMLFormElement>);
      clientLogger.info('TestGroupEditForm', 'テストグループ更新成功');
      setModalMessage('テストグループを更新しました');
      setIsModalOpen(true);
      setTimeout(() => {
        router.push('/testGroup');
      }, 1500);
    } catch (error) {
      clientLogger.error('TestGroupEditForm', 'テストグループ更新失敗', { error });
      setModalMessage(error instanceof Error ? error.message : 'テストグループの更新に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // キャンセルボタン押下時処理
  const handleCansel = () => {
    router.push('/testGroup', { scroll: false });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | { name: string; value: string | string[] };
    const { name } = target;
    const value = typeof target.value === 'string' ? target.value : Array.isArray(target.value) ? target.value.join(',') : '';
    onChange({
      target: {
        name,
        value,
        type: (target as HTMLInputElement).type || 'text',
      },
    });
  };

  const handleTagChange = (tagName: string, selectedValues: string[]) => {
    onChange({
      target: {
        name: tagName,
        value: selectedValues.join(','),
        type: 'tag',
      },
    });
  };

  const fields = [
    {
      label: 'OEM',
      type: 'text',
      name: 'oem',
      value: form.oem,
      onChange: handleInputChange,
      placeholder: 'OEM'
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: form.model,
      onChange: handleInputChange,
      placeholder: '機種'
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: form.event,
      onChange: handleInputChange,
      placeholder: 'イベント'
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: form.variation,
      onChange: handleInputChange,
      placeholder: 'バリエーション'
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: form.destination,
      onChange: handleInputChange,
      placeholder: '仕向'
    },
    {
      label: '制御仕様名',
      type: 'text',
      name: 'specs',
      value: form.specs,
      onChange: handleInputChange,
      placeholder: '制御仕様名'
    },
    {
      label: '試験予定期間',
      type: 'date',
      name: 'testDatespan',
      value: form.testDatespan,
      onChange: handleInputChange,
      placeholder: ''
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: form.ngPlanCount,
      onChange: handleInputChange,
      placeholder: ''
    },
  ];

  const buttons = [
    {
      label: isLoading ? '更新中...' : '更新',
      onClick: () => {
        console.log('更新ボタンクリック');
        handleEditer({ preventDefault: () => {} } as React.FormEvent);
      },
      disabled: isLoading
    },
    {
      label: '戻る',
      onClick: handleCansel,
      isCancel: true,
      disabled: isLoading
    },
  ];

  return (
    <div>
      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}