'use client';

import FileUploadField from '@/components/ui/FileUploadField';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiFetch, apiGet, apiPost } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';
import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { CreateTestCaseListRow } from '../../../_components/types/testCase-list-row';
import TestCaseForm from '../../[tid]/_components/testCaseForm';
import { testCaseRegistSchema } from '../schemas/testCase-regist-schema';

// ファイルタイプ定数（API側と統一）
const FILE_TYPE = {
  CONTROL_SPEC: 0,
  DATA_FLOW: 1,
} as const;

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
    first_layer: '',
    second_layer: '',
    third_layer: '',
    fourth_layer: '',
    purpose: '',
    request_id: '',
    checkItems: '',
    testProcedure: '',
    controlSpecFile: [],
    dataFlowFile: [],
  });

  const [testContents, setTestContents] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTidChecking, setIsTidChecking] = useState(false);

  const handleFileChange = (fieldName: string, files: FileInfo[], deletedFile?: FileInfo) => {
    // 削除されたファイルがある場合の処理は、作成画面では不要
    // （編集画面との互換性のために引数は受け取る）
    setFormData(prev => ({
      ...prev,
      [fieldName]: files
    }));
  };

  // ファイルアップロード処理（編集画面と同じ仕組み）
  const handleFileUpload = async (file: FileInfo, fileType: number): Promise<FileInfo> => {
    const formDataObj = new FormData();

    // base64をBlobに変換
    if (file.base64 && file.type) {
      const byteString = atob(file.base64);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([uint8Array], { type: file.type });
      const fileObj = new File([blob], file.name, { type: file.type });

      formDataObj.append('file', fileObj);
      formDataObj.append('testGroupId', String(groupId));
      formDataObj.append('tid', formData.tid);
      formDataObj.append('fileType', String(fileType));

      const response = await apiFetch('/api/files', {
        method: 'POST',
        body: formDataObj,
      });

      if (response.ok) {
        clientLogger.info('テストケース新規登録画面', 'ファイルアップロード成功');
        const result = await response.json();
        // アップロード成功後、サーバーから返されたfileNo等を設定
        return {
          ...file,
          fileNo: result.data.fileNo,
          path: result.data.filePath,
          fileType: result.data.fileType,
        };
      } else {
        clientLogger.error('テストケース新規登録画面', 'ファイルアップロード失敗');
        throw new Error('ファイルアップロードに失敗しました');
      }
    }

    return file;
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
      name: 'first_layer',
      value: formData.first_layer,
      onChange: handleChange,
      placeholder: '第1層',
      required: true,
      error: errors.first_layer
    },
    {
      label: '第2層',
      type: 'text',
      name: 'second_layer',
      value: formData.second_layer,
      onChange: handleChange,
      placeholder: '第2層',
      required: true,
      error: errors.second_layer
    },
    {
      label: '第3層',
      type: 'text',
      name: 'third_layer',
      value: formData.third_layer,
      onChange: handleChange,
      placeholder: '第3層',
      required: true,
      error: errors.third_layer
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourth_layer',
      value: formData.fourth_layer,
      onChange: handleChange,
      placeholder: '第4層',
      required: true,
      error: errors.fourth_layer
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
      name: 'request_id',
      value: formData.request_id,
      onChange: handleChange,
      placeholder: '要求ID',
      required: true,
      error: errors.request_id
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

  // 登録ボタン押下時
  const handleRegister = async () => {
    // バリデーション
    const validationData = {
      ...formData,
      testCase: testContents.map((testCase) => ({
        id: testCase.id,
        testCase: testCase.testCase
      })),
      expectedValue: testContents.map((expected) => ({
        id: expected.id,
        expectedValue: expected.expectedValue
      })),
    }

    const validationResult = testCaseRegistSchema.safeParse(validationData);

    if (!validationResult.success) {
      const newErrors: Record<string, string> = {};
      validationResult.error.errors.forEach(err => {
        if (err.path[0] === 'testCase' || err.path[0] === 'expectedValue') {
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

    // バリデーション成功時にエラークリア
    setErrors({});
    setIsLoading(true);
    clientLogger.info('テストケース新規登録画面', 'テストケース登録開始', { formData, testContents });

    try {
      // JSONペイロードを作成（編集画面と同じ形式）
      const payload = {
        tid: formData.tid,
        first_layer: formData.first_layer,
        second_layer: formData.second_layer,
        third_layer: formData.third_layer,
        fourth_layer: formData.fourth_layer,
        purpose: formData.purpose,
        request_id: formData.request_id,
        checkItems: formData.checkItems,
        testProcedure: formData.testProcedure,
        controlSpecFile: formData.controlSpecFile,
        dataFlowFile: formData.dataFlowFile,
        testContents: testContents,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPost<any>(`/api/test-groups/${groupId}/cases`, payload);

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
          onChange={(e, deletedFile) => handleFileChange('controlSpecFile', e.target.value, deletedFile)}
          onFileUpload={(file) => handleFileUpload(file, FILE_TYPE.CONTROL_SPEC)}
          error={errors.controlSpecFile}
          isCopyable={true}
        />
        <FileUploadField
          label="データフロー"
          name="dataFlowFile"
          value={formData.dataFlowFile}
          onChange={(e, deletedFile) => handleFileChange('dataFlowFile', e.target.value, deletedFile)}
          onFileUpload={(file) => handleFileUpload(file, FILE_TYPE.DATA_FLOW)}
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