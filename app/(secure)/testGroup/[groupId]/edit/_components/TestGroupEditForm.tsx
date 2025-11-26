import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VerticalForm } from '@/components/ui/verticalForm';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { getTagOptions } from '../action';
import clientLogger from '@/utils/client-logger';
import { TestGroupFormData } from '@/app/(secure)/_components/types/testGroup-list-row';

export type TestGroupEditChangeData = {
  target: {
    name: string;
    value: string | string[];
    type: string;
  };
};

export type TestGroupEditFormProps = {
  form: TestGroupFormData;
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
  const [tagOptions, setTagOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    async function fetchTagOptions() {
      try {
        clientLogger.info('TestGroupEditForm', 'タグオプション取得開始');
        const result = await getTagOptions();

        clientLogger.info('TestGroupEditForm', 'タグオプション取得レスポンス', {
          success: result.success,
          dataLength: result.data?.length || 0,
          error: result.error,
        });

        if (result.success && result.data && Array.isArray(result.data)) {
          setTagOptions(result.data);
          clientLogger.info('TestGroupEditForm', 'タグオプション設定完了', {
            count: result.data.length,
          });
        } else {
          clientLogger.warn('TestGroupEditForm', 'タグオプション取得失敗', {
            success: result.success,
            hasData: !!result.data,
            isArray: Array.isArray(result.data),
            error: result.error,
          });
          setTagOptions([]);
        }
      } catch (error) {
        clientLogger.error('TestGroupEditForm', 'タグオプション取得エラー', {
          error: error instanceof Error ? error.message : String(error),
        });
        setTagOptions([]);
      }
    }
    fetchTagOptions();
  }, []);

  // 更新ボタン押下時処理
  const handleUpdate = async (e: React.FormEvent) => {
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
      setModalMessage(
        error instanceof Error ? error.message : 'テストグループの更新に失敗しました'
      );
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // キャンセルボタン押下時処理
  const handleCancel = () => {
    router.push('/testGroup', { scroll: false });
  };

  const handleInputChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
      | { target: { name: string; value: string | string[] } }
  ) => {
    const target = e.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | { name: string; value: string | string[] };
    const { name } = target;
    const value =
      typeof target.value === 'string'
        ? target.value
        : Array.isArray(target.value)
          ? target.value.join(',')
          : '';
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
        value: selectedValues,
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
      placeholder: 'OEM',
      required: true,
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: form.model,
      onChange: handleInputChange,
      placeholder: '機種',
      required: true,
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: form.event,
      onChange: handleInputChange,
      placeholder: 'イベント',
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: form.variation,
      onChange: handleInputChange,
      placeholder: 'バリエーション',
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: form.destination,
      onChange: handleInputChange,
      placeholder: '仕向',
    },
    {
      label: '制御仕様名',
      type: 'text',
      name: 'specs',
      value: form.specs,
      onChange: handleInputChange,
      placeholder: '制御仕様名',
    },
    {
      label: '試験開始日',
      type: 'date',
      name: 'test_startdate',
      value: form.test_startdate,
      onChange: handleInputChange,
      placeholder: '',
    },
    {
      label: '試験終了日',
      type: 'date',
      name: 'test_enddate',
      value: form.test_enddate,
      onChange: handleInputChange,
      placeholder: '',
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: form.ngPlanCount,
      onChange: handleInputChange,
      placeholder: '',
    },
    {
      label: 'テスト設計者',
      type: 'tag',
      name: 'designerTag',
      value: form.designerTag,
      onChange: (
        e:
          | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
          | { target: { name: string; value: string | string[] } }
      ) =>
        handleTagChange(
          'designerTag',
          Array.isArray(e.target?.value) ? e.target.value : []
        ),
      placeholder: 'タグを選択してください。',
      options: tagOptions,
    },
    {
      label: 'テスト実施者',
      type: 'tag',
      name: 'executerTag',
      value: form.executerTag,
      onChange: (
        e:
          | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
          | { target: { name: string; value: string | string[] } }
      ) =>
        handleTagChange(
          'executerTag',
          Array.isArray(e.target?.value) ? e.target.value : []
        ),
      placeholder: 'タグを選択してください。',
      options: tagOptions,
    },
    {
      label: 'テスト閲覧者',
      type: 'tag',
      name: 'viewerTag',
      value: form.viewerTag,
      onChange: (
        e:
          | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
          | { target: { name: string; value: string | string[] } }
      ) =>
        handleTagChange('viewerTag', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグを選択してください。',
      options: tagOptions,
    },
  ];

  const buttons = [
    {
      label: isLoading ? '更新中...' : '更新',
      onClick: () => {
        console.log('更新ボタンクリック');
        handleUpdate({ preventDefault: () => {} } as React.FormEvent);
      },
      disabled: isLoading,
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true,
      disabled: isLoading,
    },
  ];

  return (
    <div>
      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
}
