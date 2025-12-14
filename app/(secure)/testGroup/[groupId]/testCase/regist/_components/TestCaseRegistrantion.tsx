'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { VerticalForm } from '@/components/ui/verticalForm';
import FileUploadField from '@/components/ui/FileUploadField';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import clientLogger from '@/utils/client-logger';
import { testCaseRegistSchema } from './schemas/testCase-regist-schema';
import TestCaseForm from '@/components/ui/testCaseForm';
import { FileInfo } from '@/utils/fileUtils';

type TestCase = {
  id: number;
  testCase: string;
  expectedValue: string;
  excluded: boolean;
  selected: boolean;
};

const TestCaseRegistrantion: React.FC = () => {
  const router = useRouter();
  const params = useParams();
  const groupId = parseInt(params.groupId as string);

  const [formData, setFormData] = useState({
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

  // testCaseForm に渡す value を memoize して、無駄な re-render を防ぐ
  const testCaseFormValue = useMemo(() =>
    testContents.map(tc => ({
      testCase: tc.testCase,
      expectedValue: tc.expectedValue,
      excluded: tc.excluded,
    })),
    [testContents]
  );

  const handleFileChange = (fieldName: string, files: FileInfo[]) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: files
    }));
  };

  const handleTestContentsChange = (contents: { testCase: string; expectedValue: string; excluded: boolean }[]) => {
    setTestContents(contents.map((tc, index) => ({
      id: Date.now() + index,
      testCase: tc.testCase,
      expectedValue: tc.expectedValue,
      excluded: tc.excluded,
      selected: true,
    })));
  };

  // VerticalForm expects a broader onChange type that includes HTMLSelectElement
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

  const handleTidBlur = async () => {
    if (!formData.tid.trim()) {
      return;
    }

    setIsTidChecking(true);
    try {
      const response = await fetch(
        `/api/test-cases/check-tid?groupId=${groupId}&tid=${encodeURIComponent(formData.tid)}`
      );
      const result = await response.json();

      if (result.success && result.isDuplicate) {
        setErrors(prev => ({
          ...prev,
          tid: `TID「${formData.tid}」は既に登録されています`,
        }));
      } else {
        // TIDが重複していない場合、tidエラーをクリア
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.tid;
          return newErrors;
        });
      }
    } catch (error) {
      clientLogger.error('TestCaseRegistration', 'TID重複チェックエラー', { error });
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
      placeholder: '例：1-1-1-1',
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
        // testContents[index].fieldName の形式でエラーキーを作成
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
      return;
    }

    setErrors({});
    setIsLoading(true);

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

      const response = await fetch(`/api/test-cases/regist`, {
        method: 'POST',
        body: formDataObj,
      });

      const result = await response.json();

      if (result.success) {
        clientLogger.info('TestCaseRegistration', 'テストケース作成成功', { tid: formData.tid });
        setModalMessage('テストケースを登録しました');
        setIsModalOpen(true);
        setTimeout(() => {
          router.push(`/testGroup/${groupId}/testCase`);
        }, 1500);
      } else {
        clientLogger.error('TestCaseRegistration', 'テストケース作成失敗', { error: result.error });
        setModalMessage(result.error || 'テストケースの作成に失敗しました');
        setIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('TestCaseRegistration', 'テストケース作成エラー', { error });
      setModalMessage(error instanceof Error ? error.message : 'エラーが発生しました');
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push(`/testGroup/${groupId}`);
  };

  const buttons = [
    {
      label: isLoading ? '登録中...' : '登録',
      onClick: handleRegister,
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
      <VerticalForm fields={fieldsBeforeFiles} />

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
          <TestCaseForm value={testCaseFormValue} onChange={handleTestContentsChange} errors={errors} />
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