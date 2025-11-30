'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VerticalForm } from '@/components/ui/verticalForm';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { getTagOptions, createTestGroup } from '../action';
import clientLogger from '@/utils/client-logger';
import { testGroupRegistSchema } from './schemas/testGroup-regist-schema';

const Resist: React.FC = () => {
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);
  const [tagLoading, setTagLoading] = useState(true);
  const [tagError, setTagError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    oem: '',
    model: '',
    event: '',
    variation: '',
    destination: '',
    specs: '',
    test_startdate: '',
    test_enddate: '',
    ngPlanCount: '',
    designerTag: [] as string[],
    executerTag: [] as string[],
    viewerTag: [] as string[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  useEffect(() => {
    async function fetchTagOptions() {
      try {
        setTagLoading(true);
        setTagError(null);
        const result = await getTagOptions();
        if (result.success && result.data) {
          setTagOptions(result.data);
        } else {
          setTagError(result.error || 'タグの取得に失敗しました');
        }
      } catch (error) {
        setTagError(error instanceof Error ? error.message : 'タグの取得に失敗しました');
      } finally {
        setTagLoading(false);
      }
    }
    fetchTagOptions();
  }, []);

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
      required: true,
      error: errors.oem
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: formData.model,
      onChange: handleInputChange,
      placeholder: '機種',
      required: true,
      error: errors.model
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: formData.event,
      onChange: handleInputChange,
      placeholder: 'イベント',
      required: true,
      error: errors.event
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: formData.variation,
      onChange: handleInputChange,
      placeholder: 'バリエーション',
      required: true,
      error: errors.variation
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: formData.destination,
      onChange: handleInputChange,
      placeholder: '仕向',
      required: true,
      error: errors.destination
    },
    {
      label: '制御仕様名',
      type: 'text',
      name: 'specs',
      value: formData.specs,
      onChange: handleInputChange,
      placeholder: '制御仕様名',
      required: true,
      error: errors.specs
    },
    {
      label: '試験開始日',
      type: 'date',
      name: 'test_startdate',
      value: formData.test_startdate,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: errors.test_startdate
    },
    {
      label: '試験終了日',
      type: 'date',
      name: 'test_enddate',
      value: formData.test_enddate,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: errors.test_enddate
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: formData.ngPlanCount,
      onChange: handleInputChange,
      placeholder: '',
      required: true,
      error: errors.ngPlanCount
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

  const handleRegister = async () => {
    console.log('handleRegister called with formData:', formData);

    // Validation
    const validationResult = testGroupRegistSchema.safeParse(formData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        const fieldPath = err.path[0] as string;
        newErrors[fieldPath] = err.message;
      });
      setErrors(newErrors);
      return;
    }

    // Clear errors on successful validation
    setErrors({});

    setIsLoading(true);
    try {
      const tag_names: { tag_name: string; test_role: number; }[] | undefined = [];
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

      const result = await createTestGroup({
        oem: formData.oem,
        model: formData.model,
        event: formData.event || undefined,
        variation: formData.variation || undefined,
        destination: formData.destination || undefined,
        specs: formData.specs || undefined,
        test_startdate: formData.test_startdate || undefined,
        test_enddate: formData.test_enddate || undefined,
        ng_plan_count: formData.ngPlanCount ? parseInt(formData.ngPlanCount) : undefined,
        tag_names: tag_names.length > 0 ? tag_names : undefined,
      });

      if (result.success) {
        clientLogger.info('TestGroupRegistration', 'テストグループ作成成功', { groupId: result.data?.id });
        setModalMessage('テストグループを作成しました');
        setIsModalOpen(true);
        setTimeout(() => {
          router.push('/testGroup');
        }, 1500);
      } else {
        clientLogger.error('TestGroupRegistration', 'テストグループ作成失敗', { error: result.error });
        setModalMessage(result.error || 'テストグループの作成に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('TestGroupRegistration', '例外エラー', { error });
      setModalMessage(error instanceof Error ? error.message : 'エラーが発生しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/testGroup');
  };

  const buttons = [
    {
      label: isLoading ? '登録中...' : '登録',
      onClick: () => {
        console.log('登録ボタンクリック');
        handleRegister();
      },
      disabled: isLoading
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true,
      disabled: isLoading
    }
  ];

  return (
    <div>
      {/* タグ読み込みエラー表示 */}
      {tagError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="font-bold">タグの読み込みに失敗しました</p>
          <p className="text-sm">{tagError}</p>
        </div>
      )}

      {/* タグ読み込み中の表示 */}
      <Loading
        isLoading={tagLoading}
        message="タグを読み込み中..."
        size="md"
      />

      {/* フォームの表示 */}
      {!tagLoading && (
        <>
          <VerticalForm fields={fields} />
          <ButtonGroup buttons={buttons} />
        </>
      )}

      {/* 登録結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
};

export default Resist;
