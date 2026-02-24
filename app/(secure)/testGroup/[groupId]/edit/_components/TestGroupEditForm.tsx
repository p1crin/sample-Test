import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiGet, apiPut } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { testGroupEditSchema } from './schemas/testGroup-edit-schema';
import Loading from '@/components/ui/loading';

export type TestGroupEditFormState = {
  oem: string;
  model: string;
  event: string;
  variation: string;
  destination: string;
  specs: string;
  test_startdate: string;
  test_enddate: string;
  ngPlanCount: string;
  designerTag: [] | string[];
  executerTag: [] | string[];
  viewerTag: [] | string[];
};

export type TestGroupEditChangeData = {
  target: {
    id: number;
    name: string;
    value: string;
    type: string;
  };
};

export type TestGroupEditFormProps = {
  groupName?: string;
  form: TestGroupEditFormState;
};

export function TestGroupEditForm({
  form,
}: TestGroupEditFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isApiSuccess, setIsApiSuccess] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editModalMessage, setEditModalMessage] = useState('');
  const [editError, setEditErrors] = useState<Record<string, string>>({});
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);
  if (apiError) throw apiError;

  const params = useParams();
  const groupId = params.groupId;

  // テストグループのフォーマットの各値取得
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
      } catch (err) {
        clientLogger.error('テストグループ編集画面', 'タグ取得エラー', { error: err instanceof Error ? err.message : String(err) });
        setTagError(err instanceof Error ? err.message : 'タグの取得に失敗しました');
        setApiError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    fetchTags();
  }, []);

  // 更新ボタン押下時処理
  const handleEditer = async () => {
    // クライアント側バリデーション
    const validationResult = testGroupEditSchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        const fieldPath = err.path[0] as string;
        newErrors[fieldPath] = err.message;
      });
      setEditErrors(newErrors);
      return;
    }

    // バリデーション成功時にエラークリア
    setEditErrors({});

    setIsEditLoading(true);
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
      const result = await apiPut<any>(`/api/test-groups/${groupId}`, {
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

      if (result.success) {
        clientLogger.info('テストグループ編集画面', 'テストグループ更新成功', { testGroupId: result.data.id });
        setEditModalMessage('テストグループを更新しました');
        setIsApiSuccess(result.success);
        setIsEditModalOpen(true);
        setTimeout(() => {
          router.push('/testGroup');
        }, 1500); // 1.5秒後にテストグループ一覧に飛ばす
      } else {
        clientLogger.error('テストグループ編集画面', 'テストグループ更新失敗', { error: result.error instanceof Error ? result.error.message : String(result.error) });
        setEditModalMessage('テストグループの更新に失敗しました');
        setIsEditModalOpen(true);
      }
    } catch (err) {
      clientLogger.error('テストグループ編集画面', 'テストグループ更新エラー', { error: err instanceof Error ? err.message : String(err) });
      setEditModalMessage('テストグループの更新に失敗しました');
      setIsEditModalOpen(true);
    } finally {
      setIsEditLoading(false);
    }
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

  const closeModal = (isApiSuccess: boolean) => {
    setIsEditModalOpen(false);
    // 更新成功時はテストグループ一覧へ遷移する
    if (isApiSuccess) {
      router.push('/testGroup');
    }
  };

  const fields = [
    {
      label: 'OEM',
      type: 'text',
      name: 'oem',
      value: formData.oem,
      onChange: handleInputChange,
      placeholder: 'OEM',
      required: true,
      error: editError.oem
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: formData.model,
      onChange: handleInputChange,
      placeholder: '機種',
      required: true,
      error: editError.model
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: formData.event,
      onChange: handleInputChange,
      placeholder: 'イベント',
      required: true,
      error: editError.event
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: formData.variation,
      onChange: handleInputChange,
      placeholder: 'バリエーション',
      required: true,
      error: editError.variation
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: formData.destination,
      onChange: handleInputChange,
      placeholder: '仕向',
      required: true,
      error: editError.destination
    },
    {
      label: '制御仕様名',
      type: 'text',
      name: 'specs',
      value: formData.specs,
      onChange: handleInputChange,
      placeholder: '制御仕様名',
      required: true,
      error: editError.specs
    },
    {
      label: '試験開始日',
      type: 'date',
      name: 'test_startdate',
      value: formData.test_startdate,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: editError.test_startdate
    },
    {
      label: '試験終了日',
      type: 'date',
      name: 'test_enddate',
      value: formData.test_enddate,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: editError.test_enddate
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: formData.ngPlanCount,
      onChange: handleInputChange,
      placeholder: '0〜9999',
      required: true,
      error: editError.ngPlanCount,
      min: 0,
      max: 9999
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
      label: isEditLoading ? '更新中...' : '更新',
      onClick: () => {
        clientLogger.info('テストグループ編集画面', '更新ボタン押下');
        handleEditer();
      },
      disabled: isEditLoading,
    },
    {
      label: '戻る',
      onClick: () => {
        clientLogger.info('テストグループ編集画面', '戻るボタン押下');
        router.push('/testGroup');
      },
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
      <>
        <VerticalForm fields={fields} />
        <ButtonGroup buttons={buttons} />
      </>
      <Modal open={isEditLoading} onClose={() => setIsEditLoading(false)} isUnclosable={true}>
        <div className="flex justify-center">
          <Loading
            isLoading={true}
            message="データ更新中..."
            size="md"
          />
        </div>
      </Modal>
      {/* 結果モーダル */}
      <Modal open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <p className="mb-8">{editModalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => closeModal(isApiSuccess)}>
            閉じる
          </Button>
        </div>
      </Modal>
    </div>
  );
}