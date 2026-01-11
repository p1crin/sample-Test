'use client';

import FileUploadField from '@/components/ui/FileUploadField';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiFetch, apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';
import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { CreateTestCaseListRow } from '../../../_components/types/testCase-list-row';
import TestCaseForm from '../../[tid]/_components/testCaseForm';
import { testCaseRegistSchema } from '../schemas/testCase-regist-schema';

type TestCase = {
  id: number;
  testCase: string;
  expectedValue: string;
  is_target: boolean;
  selected: boolean;
};

const TestCaseRegistrantion: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const groupId = parseInt(params.groupId as string);

  const [formData, setFormData] = useState<CreateTestCaseListRow>({
    tid: '',
    firstLayer: '',
    secondLayer: '',
    thirdLayer: '',
    fourthLayer: '',
    purpose: '',
    requestId: '',
    checkItems: '',
    testProcedure: '',
    controlSpecFile: [] as FileInfo[],
    dataFlowFile: [] as FileInfo[],
  });

  const [testContents, setTestContents] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTidChecking, setIsTidChecking] = useState(false);

  const handleFileChange = (fieldName: string, files: FileInfo[]) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: files
    }));
  };

  const handleTestContentsChange = (contents: { testCase: string; expectedValue: string; is_target: boolean }[]) => {
    setTestContents(contents.map((tc, index) => ({
      id: Date.now() + index,
      testCase: tc.testCase,
      expectedValue: tc.expectedValue,
      is_target: tc.is_target,
      selected: true,
    })));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    if ('target' in e && 'name' in e.target) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      const { name, value } = target;
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // BlurでTID重複チェック
  const handleTidBlur = async () => {
    if (!formData.tid.trim()) {
      return;
    }

    setIsTidChecking(true);
    clientLogger.info('テストケース新規登録画面', 'TID重複チェック開始', { tid: formData.tid });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiGet<any>(`/api/test-cases/check-tid?groupId=${groupId}&tid=${encodeURIComponent(formData.tid)}`);

      if (result.success && result.isDuplicate) {
        setErrors(prev => ({
          ...prev,
          tid: `TID「${formData.tid}」は既に登録されています`,
        }));
        clientLogger.warn('テストケース新規登録画面', 'TID重複', { tid: formData.tid });
      } else {
        // TIDが重複していない場合、tidエラーをクリア
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.tid;
          return newErrors;
        });
        clientLogger.info('テストケース新規登録画面', 'TID重複なし', { tid: formData.tid });
      }
    } catch (error) {
      clientLogger.error('テストケース新規登録画面', 'TID重複チェックエラー', { error });
    } finally {
      setIsTidChecking(false);
    }
  };

  const fieldsBeforeFiles = [
    {
      label: 'TID',
      type: 'text',
      name: 'tid',
      value: formData.tid,
      onChange: handleChange,
      onBlur: handleTidBlur,
      placeholder: 'TID（例: 123-45-6-789）',
      required: true,
      error: errors.tid,
      disabled: isTidChecking
    },
    {
      label: '第1層',
      type: 'text',
      name: 'firstLayer',
      value: formData.firstLayer,
      onChange: handleChange,
      placeholder: '第1層',
      required: true,
      error: errors.firstLayer
    },
    {
      label: '第2層',
      type: 'text',
      name: 'secondLayer',
      value: formData.secondLayer,
      onChange: handleChange,
      placeholder: '第2層',
      required: true,
      error: errors.secondLayer
    },
    {
      label: '第3層',
      type: 'text',
      name: 'thirdLayer',
      value: formData.thirdLayer,
      onChange: handleChange,
      placeholder: '第3層',
      required: true,
      error: errors.thirdLayer
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourthLayer',
      value: formData.fourthLayer,
      onChange: handleChange,
      placeholder: '第4層',
      required: true,
      error: errors.fourthLayer
    },
    {
      label: '目的',
      type: 'text',
      name: 'purpose',
      value: formData.purpose,
      onChange: handleChange,
      placeholder: '目的',
      required: true,
      error: errors.purpose
    },
    {
      label: '要求ID',
      type: 'text',
      name: 'requestId',
      value: formData.requestId,
      onChange: handleChange,
      placeholder: '要求ID',
      required: true,
      error: errors.requestId
    },
    {
      label: '確認観点',
      type: 'textarea',
      name: 'checkItems',
      value: formData.checkItems,
      onChange: handleChange,
      placeholder: '確認観点',
      required: true,
      error: errors.checkItems
    },
    {
      label: 'テスト手順',
      type: 'textarea',
      name: 'testProcedure',
      value: formData.testProcedure,
      onChange: handleChange,
      placeholder: 'テスト手順',
      required: true,
      error: errors.testProcedure
    },
  ];

  const handleRegister = async () => {
    // バリデーション
    const validationData = {
      ...formData,
      testContents,
    };

    const validationResult = testCaseRegistSchema.safeParse(validationData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        if (err.path[0] === 'testContents' && typeof err.path[1] === 'number') {
          const rowIndex = err.path[1];
          const fieldName = err.path[2] as string;
          newErrors[`testContents[${rowIndex}].${fieldName}`] = err.message;
        } else {
          const fieldPath = err.path[0] as string;
          newErrors[fieldPath] = err.message;
        }
      });
      setErrors(newErrors);
      clientLogger.warn('テストケース新規登録画面', 'バリデーションエラー', { errors: newErrors });
      return;
    }

    // TID重複エラーが存在する場合
    if (errors.tid) {
      clientLogger.warn('テストケース新規登録画面', 'TID重複エラー', { errors });
      return;
    }

    setErrors({});
    setIsLoading(true);
    clientLogger.info('テストケース新規登録画面', 'テストケース登録開始', { formData, testContents });

    try {
      const formDataObj = new FormData();
      formDataObj.append('groupId', String(groupId));
      formDataObj.append('tid', formData.tid);
      formDataObj.append('firstLayer', formData.firstLayer);
      formDataObj.append('secondLayer', formData.secondLayer);
      formDataObj.append('thirdLayer', formData.thirdLayer);
      formDataObj.append('fourthLayer', formData.fourthLayer);
      formDataObj.append('purpose', formData.purpose);
      formDataObj.append('requestId', formData.requestId);
      formDataObj.append('checkItems', formData.checkItems);
      formDataObj.append('testProcedure', formData.testProcedure);

      // 複数のファイルを処理
      formData.controlSpecFile.forEach((fileInfo, index) => {
        formDataObj.append(`controlSpecFile[${index}]`, JSON.stringify(fileInfo));
      });
      formData.dataFlowFile.forEach((fileInfo, index) => {
        formDataObj.append(`dataFlowFile[${index}]`, JSON.stringify(fileInfo));
      });

      if (testContents.length > 0) {
        formDataObj.append('testContents', JSON.stringify(testContents));
      }

      const response = await apiFetch(`/api/test-groups/${groupId}/cases`, {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `API error: ${response.status}`
        );
      }

      const result = await response.json();

      if (result.success) {
        clientLogger.info('テストケース新規登録画面', 'テストケース作成成功', { tid: formData.tid });
        setModalMessage('テストケースを登録しました');
        setIsModalOpen(true);
        setTimeout(() => {
          router.push(`/testGroup/${groupId}/testCase`);
        }, 1500);
      } else {
        clientLogger.error('テストケース新規登録画面', 'テストケース作成失敗', { error: result.error });
        setModalMessage('テストケースの作成に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('テストケース新規登録画面', 'テストケース作成エラー', { error });
      setModalMessage('テストケースの作成に失敗しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const buttons = [
    {
      label: isLoading ? '登録中...' : '登録',
      onClick: () => {
        clientLogger.info('テストケース新規登録画面', '登録ボタン押下');
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
      <h1 className="text-lg font-bold">テスト情報</h1>
      <div>
        <VerticalForm fields={fieldsBeforeFiles} />
      </div>
      {/* ファイルアップロードセクション */}
      <div className="pb-2 w-4/5 grid gap-4 grid-cols-1">
        <FileUploadField
          label="制御仕様書"
          name="controlSpecFile"
          value={formData.controlSpecFile}
          onChange={(e) => handleFileChange('controlSpecFile', e.target.value)}
          error={errors.controlSpecFile}
          isCopyable={true}
        />
        <FileUploadField
          label="データフロー"
          name="dataFlowFile"
          value={formData.dataFlowFile}
          onChange={(e) => handleFileChange('dataFlowFile', e.target.value)}
          error={errors.dataFlowFile}
          isCopyable={true}
        />
      </div>

      {/* テスト内容セクション */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-4">テスト内容</h2>
        <div className="bg-gray-50 p-4 rounded-md flex justify-center">
          <TestCaseForm onChange={handleTestContentsChange} errors={errors} />
        </div>
        {errors.testContents && (
          <div className="text-red-500 text-sm mt-2">{errors.testContents}</div>
        )}
      </div>

      <ButtonGroup buttons={buttons} />

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

export default TestCaseRegistrantion;