import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiGet, apiPost } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateTestGroupListRow } from '../../../_components/types/testGroup-Form-row';
import { testGroupCopySchema } from './schemas/testGroup-copy-schema';

export type TestGroupCopyFormState = UpdateTestGroupListRow;

export type TestGroupCopyChangeData = {
  target: {
    testGroupId: string;
    name: string;
    value: string;
    type: string;
  };
};

export type TestGroupCopyFormProps = {
  form: TestGroupCopyFormState;
};

export function TestGroupCopyForm({
  form,
}: TestGroupCopyFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [copyIsLoading, setCopyIsLoading] = useState(false);
  const [copyIsModalOpen, setCopyIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [copyError, setCopyErrors] = useState<Record<string, string>>({});
  const params = useParams();
  const groupId = params.groupId;

  useEffect(() => {
    setFormData(form);
  }, [form]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setTagError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await apiGet<any>('/api/tags');

        if (result.success && Array.isArray(result.data)) {
          const tagOptions = result.data.map((tag: { id: number; name: string }) => ({
            value: tag.name,
            label: tag.name,
          }));
          setTagOptions(tagOptions);
        } else {
          setTagError('タグの取得に失敗しました');
        }
      } catch (error) {
        clientLogger.error('テストグループ複製画面', 'タグ取得エラー', { error });
        setTagError(error instanceof Error ? error.message : 'タグの取得に失敗しました');
      }
    };
    fetchTags();
  }, []);

  // 登録ボタン押下時処理
  const testGroupCopy = async () => {
    // バリデーションチェック
    const validationResult = testGroupCopySchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        const fieldPath = err.path[0] as string;
        newErrors[fieldPath] = err.message;
      });
      setCopyErrors(newErrors);
      return;
    }

    // バリデーション成功時にエラークリア
    setCopyErrors({});

    setCopyIsLoading(true);
    clientLogger.info('テストグループ複製画面', 'テストグループ複製開始', { formData });
    try {
      // タグ名の配列を生成
      const tag_names: { tag_name: string; test_role: number }[] = [];

      if (formData.designerTag && formData.designerTag.length > 0) {
        formData.designerTag.forEach(tag => {
          tag_names.push({ tag_name: tag, test_role: 0 });
        });
      }
      if (formData.executerTag && formData.executerTag.length > 0) {
        formData.executerTag.forEach(tag => {
          tag_names.push({ tag_name: tag, test_role: 1 });
        });
      }
      if (formData.viewerTag && formData.viewerTag.length > 0) {
        formData.viewerTag.forEach(tag => {
          tag_names.push({ tag_name: tag, test_role: 2 });
        });
      }

      // API呼び出し
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await apiPost<any>(`/api/test-groups/${groupId}`, {
        oem: formData.oem,
        model: formData.model,
        event: formData.event,
        variation: formData.variation,
        destination: formData.destination,
        specs: formData.specs,
        test_startdate: formData.test_startdate,
        test_enddate: formData.test_enddate,
        ng_plan_count: formData.ngPlanCount ? parseInt(formData.ngPlanCount) : 0,
        tag_names: tag_names.length > 0 ? tag_names : undefined,
      });

      if (response.success) {
        clientLogger.info('テストグループ複製画面', 'テストグループ複製成功', { groupId: response.data.id });
        setModalMessage('テストグループを複製しました');
        setCopyIsModalOpen(true);
        setTimeout(() => {
          router.push('/testGroup');
        }, 1500);
      } else {
        clientLogger.error('テストグループ複製画面', 'テストグループ複製失敗', { error: response.error });
        setModalMessage('テストグループの複製に失敗しました');
        setCopyIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('テストグループ複製画面', 'テストグループ複製失敗', { error });
      setModalMessage('テストグループの複製に失敗しました');
      setCopyIsModalOpen(true);
    } finally {
      setCopyIsLoading(false);
    }
  };

  // キャンセルボタン押下時処理
  const handleCansel = () => {
    router.push('/testGroup');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | { name: string; value: string | string[] };
    const { name, value } = target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTagChange = (tagName: string, selectedValues: string[]) => {
    setFormData(prev => ({
      ...prev,
      [tagName]: selectedValues
    }));
  };

  const fields = [
    {
      label: 'OEM',
      type: 'text',
      name: 'oem',
      value: formData.oem,
      onChange: handleInputChange,
      placeholder: 'OEM',
      error: copyError.oem
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: formData.model,
      onChange: handleInputChange,
      placeholder: '機種',
      error: copyError.model
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: formData.event,
      onChange: handleInputChange,
      placeholder: 'イベント',
      error: copyError.event
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: formData.variation,
      onChange: handleInputChange,
      placeholder: 'バリエーション',
      error: copyError.variation
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: formData.destination,
      onChange: handleInputChange,
      placeholder: '仕向',
      error: copyError.destination
    },
    {
      label: '制御仕様名',
      type: 'text',
      name: 'specs',
      value: formData.specs,
      onChange: handleInputChange,
      placeholder: '制御仕様名',
      error: copyError.specs
    },
    {
      label: '試験開始日',
      type: 'date',
      name: 'test_startdate',
      value: formData.test_startdate,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: copyError.test_startdate
    },
    {
      label: '試験終了日',
      type: 'date',
      name: 'test_enddate',
      value: formData.test_enddate,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: copyError.test_enddate
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: formData.ngPlanCount,
      onChange: handleInputChange,
      placeholder: '0〜9999',
      required: true,
      min: 0,
      max: 9999,
      error: copyError.ngPlanCount
    },
    {
      label: 'テスト設計者',
      type: 'tag',
      name: 'designerTag',
      value: formData.designerTag,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('designerTag', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグを選択してください。',
      options: tagOptions
    },
    {
      label: 'テスト実施者',
      type: 'tag',
      name: 'executerTag',
      value: formData.executerTag,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('executerTag', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグを選択してください。',
      options: tagOptions
    },
    {
      label: 'テスト閲覧者',
      type: 'tag',
      name: 'viewerTag',
      value: formData.viewerTag,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => handleTagChange('viewerTag', Array.isArray(e.target?.value) ? e.target.value : []),
      placeholder: 'タグを選択してください。',
      options: tagOptions
    },
  ];

  const buttons = [
    {
      label: copyIsLoading ? '登録中...' : '登録',
      onClick: () => {
        clientLogger.info('テストグループ複製画面', '登録ボタン押下');
        testGroupCopy();
      },
      disabled: copyIsLoading
    },
    {
      label: '戻る',
      onClick: handleCansel,
      isCancel: true
    },
  ];

  return (
    <div>
      {/* タグ読み込みエラー表示 */}
      {tagError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">タグの読み込みに失敗しました</p>

        </div>
      )}

      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />

      {/* 結果モーダル */}
      <Modal open={copyIsModalOpen} onClose={() => setCopyIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => {
            setCopyIsModalOpen(false);
            router.push('/testGroup');
          }}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
}