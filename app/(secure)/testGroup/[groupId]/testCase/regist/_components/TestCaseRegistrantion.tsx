'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { VerticalForm } from '@/components/ui/verticalForm';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import clientLogger from '@/utils/client-logger';
import { testCaseRegistSchema } from './schemas/testCase-regist-schema';
import TestCaseForm from '@/components/ui/testCaseForm';

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
    controlSpecFile: null as File | null,
    dataFlowFile: null as File | null,
  });

  const [testContents, setTestContents] = useState<TestCase[]>([]);
  const [controlSpecFileName, setControlSpecFileName] = useState('');
  const [dataFlowFileName, setDataFlowFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: any) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const { name, value } = target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: any, fieldName: string) => {
    const inputElement = e.target as HTMLInputElement;
    const file = inputElement.files?.[0] || null;
    setFormData(prev => ({
      ...prev,
      [fieldName]: file
    }));
    if (fieldName === 'controlSpecFile') {
      setControlSpecFileName(file?.name || '');
    } else {
      setDataFlowFileName(file?.name || '');
    }
  };

  const fieldsBeforeFiles = [
    {
      label: 'TID',
      type: 'text',
      name: 'tid',
      value: formData.tid,
      onChange: handleInputChange,
      placeholder: '例：1-1-1-1',
      required: true,
      error: errors.tid
    },
    {
      label: '第1層',
      type: 'text',
      name: 'firstLayer',
      value: formData.firstLayer,
      onChange: handleInputChange,
      placeholder: '第1層',
      required: true,
      error: errors.firstLayer
    },
    {
      label: '第2層',
      type: 'text',
      name: 'secondLayer',
      value: formData.secondLayer,
      onChange: handleInputChange,
      placeholder: '第2層',
      required: true,
      error: errors.secondLayer
    },
    {
      label: '第3層',
      type: 'text',
      name: 'thirdLayer',
      value: formData.thirdLayer,
      onChange: handleInputChange,
      placeholder: '第3層',
      required: true,
      error: errors.thirdLayer
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourthLayer',
      value: formData.fourthLayer,
      onChange: handleInputChange,
      placeholder: '第4層',
      required: true,
      error: errors.fourthLayer
    },
    {
      label: '目的',
      type: 'text',
      name: 'purpose',
      value: formData.purpose,
      onChange: handleInputChange,
      placeholder: '目的',
      required: true,
      error: errors.purpose
    },
    {
      label: '要求ID',
      type: 'text',
      name: 'requestId',
      value: formData.requestId,
      onChange: handleInputChange,
      placeholder: '要求ID',
      required: true,
      error: errors.requestId
    },
    {
      label: '確認観点',
      type: 'textarea',
      name: 'checkItems',
      value: formData.checkItems,
      onChange: handleInputChange,
      placeholder: '確認観点',
      required: true,
      error: errors.checkItems
    },
    {
      label: '制御仕様書',
      type: 'file',
      name: 'controlSpecFile',
      value: '',
      onChange: (e: any) => handleFileChange(e, 'controlSpecFile'),
      required: true,
      error: errors.controlSpecFile,
      fileDisplay: controlSpecFileName
    } as any,
    {
      label: 'データフロー',
      type: 'file',
      name: 'dataFlowFile',
      value: '',
      onChange: (e: any) => handleFileChange(e, 'dataFlowFile'),
      required: true,
      error: errors.dataFlowFile,
      fileDisplay: dataFlowFileName
    } as any,
    {
      label: 'テスト手順',
      type: 'textarea',
      name: 'testProcedure',
      value: formData.testProcedure,
      onChange: handleInputChange,
      placeholder: 'テスト手順',
      required: true,
      error: errors.testProcedure
    },
  ];

  const handleRegister = async () => {
    // バリデーション
    const validationData = {
      ...formData,
      testContents: testContents.filter(tc => tc.testCase || tc.expectedValue),
    };

    const validationResult = testCaseRegistSchema.safeParse(validationData);
    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        const fieldPath = err.path[0] as string;
        newErrors[fieldPath] = err.message;
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

      if (formData.controlSpecFile) {
        formDataObj.append('controlSpecFile', formData.controlSpecFile);
      }
      if (formData.dataFlowFile) {
        formDataObj.append('dataFlowFile', formData.dataFlowFile);
      }

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
          router.push(`/testGroup/${groupId}`);
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

      {/* テスト内容セクション */}
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-4">テスト内容</h2>
        <div className="bg-gray-50 p-4 rounded-md flex justify-center">
          <TestCaseForm value={testContents.map(tc => ({
            testCase: tc.testCase,
            expectedValue: tc.expectedValue,
            excluded: tc.excluded,
          }))} />
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