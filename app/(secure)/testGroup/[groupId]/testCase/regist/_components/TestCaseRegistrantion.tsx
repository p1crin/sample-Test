'use client';

import FileUploadField from '@/components/ui/FileUploadField';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiDelete, apiFetch, apiGet, apiPost } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';
import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { CreateTestCaseListRow } from '../../../_components/types/testCase-list-row';
import TestCaseForm from '../../[tid]/_components/testCaseForm';
import { testCaseRegistSchema } from '../schemas/testCase-regist-schema';
import Loading from '@/components/ui/loading';

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
  const [isApiSuccess, setIsApiSuccess] = useState(false);

  const handleFileChange = (fieldName: string, files: FileInfo[]) => {
    // ファイル選択時はbase64データをstateに保持するのみ
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

  // TID重複チェック（共通関数）
  const checkTidDuplicate = async (tid: string): Promise<boolean> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiGet<any>(`/api/test-cases/check-tid?groupId=${groupId}&tid=${encodeURIComponent(tid)}`);
      return result.success && result.isDuplicate;
    } catch (error) {
      clientLogger.error('テストケース新規登録画面', 'TID重複チェックエラー', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  };

  // BlurでTID重複チェック
  const handleTidBlur = async () => {
    if (!formData.tid.trim()) {
      return;
    }
    setIsTidChecking(true);
    clientLogger.info('テストケース新規登録画面', 'TID重複チェック開始', { groupId, tid: formData.tid });
    try {
      const isDuplicate = await checkTidDuplicate(formData.tid);
      if (isDuplicate) {
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
        clientLogger.info('テストケース新規登録画面', 'TID重複なし', { groupId, tid: formData.tid });
      }
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
      // TIDエラーは気づきにくいのでバリデーションエラー時は画面をトップに移す
      window.scroll({
        top: 0,
        behavior: "smooth",
      });
      return;
    }

    // TID重複チェック（ブラーをスキップして直接登録ボタンを押した場合に対応）
    clientLogger.info('テストケース新規登録画面', '登録時TID重複チェック開始', { groupId, tid: formData.tid });
    const isDuplicate = await checkTidDuplicate(formData.tid);
    if (isDuplicate) {
      setErrors(prev => ({
        ...prev,
        tid: `TID「${formData.tid}」は既に登録されています`,
      }));
      window.scroll({ top: 0, behavior: "smooth" });
      return;
    }

    // バリデーション成功時にエラークリア
    setErrors({});
    setIsLoading(true);

    // ログに出力するデータからファイル情報を除外
    const { controlSpecFile, dataFlowFile, ...formDataForLog } = formData;
    clientLogger.info('テストケース新規登録画面', 'テストケース登録開始', { formData: formDataForLog, testContents });

    // ファイル情報を除いてテストケースを登録
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
      testContents: testContents,
      // ファイル情報はここでは含めない
      controlSpecFile: [],
      dataFlowFile: [],
    };

    // DBへの登録が成功したかどうかを追跡（S3失敗時のロールバック用）
    let testCaseCreated = false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPost<any>(`/api/test-groups/${groupId}/cases`, payload);

      if (!result.success) {
        throw new Error(result.error || 'テストケースの作成に失敗しました');
      }

      // DBへの登録成功
      testCaseCreated = true;
      clientLogger.info('テストケース新規登録画面', 'テストケース作成成功、ファイルアップロード開始', { groupId, tid: formData.tid });

      // ファイルアップロード
      const allFiles = [
        ...formData.controlSpecFile.map(file => ({ file, type: FILE_TYPE.CONTROL_SPEC, name: '制御仕様書' })),
        ...formData.dataFlowFile.map(file => ({ file, type: FILE_TYPE.DATA_FLOW, name: 'データフロー' }))
      ];

      for (const { file, type, name } of allFiles) {
        if (file.base64 && file.type) {
          const formDataObj = new FormData();
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
          formDataObj.append('fileType', String(type));

          const response = await apiFetch('/api/files/test-info', {
            method: 'POST',
            body: formDataObj,
          });

          if (!response.ok) {
            throw new Error(`${name}「${file.name}」のアップロードに失敗しました`);
          }
          clientLogger.info('テストケース新規登録画面', `${name}アップロード成功`, { fileName: file.name });
        }
      }

      // 全て成功
      clientLogger.info('テストケース新規登録画面', 'テストケース登録成功', { testGroupId: groupId, tid: formData.tid });
      setModalMessage('テストケースを登録しました');
      setIsApiSuccess(true);
      setIsModalOpen(true);
      setTimeout(() => {
        router.push(`/testGroup/${groupId}/testCase`);
      }, 1500);

    } catch (error) {
      // DBに登録済みでS3アップロードが失敗した場合、DBのレコードを削除してロールバック
      if (testCaseCreated) {
        try {
          await apiDelete(`/api/test-groups/${groupId}/cases/${encodeURIComponent(formData.tid)}`);
          clientLogger.info('テストケース新規登録画面', 'S3アップロード失敗のためDBロールバック成功', { groupId, tid: formData.tid });
        } catch (deleteError) {
          clientLogger.error('テストケース新規登録画面', 'DBロールバック失敗', { error: deleteError instanceof Error ? deleteError.message : String(deleteError) });
        }
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      clientLogger.error('テストケース新規登録画面', 'テストケース登録エラー', { error: errorMessage });
      setModalMessage(`テストケースの登録に失敗しました。`);
      setIsModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = (isApiSuccess: boolean) => {
    setIsModalOpen(false);
    // 登録成功時テストケース一覧へ遷移する
    if (isApiSuccess) {
      router.push(`/testGroup/${groupId}/testCase`);
    }
  };

  // 戻るボタン押下時処理
  const handleCancel = () => {
    clientLogger.info('テストケース新規登録画面', '戻るボタン押下');
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
          onChange={(e, deletedFile) => handleFileChange('controlSpecFile', e.target.value)}
          error={errors.controlSpecFile}
          isCopyable={true}
        />
        <FileUploadField
          label="データフロー"
          name="dataFlowFile"
          value={formData.dataFlowFile}
          onChange={(e, deletedFile) => handleFileChange('dataFlowFile', e.target.value)}
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
      <Modal open={isLoading} onClose={() => setIsLoading(false)} isUnclosable={true}>
        <div className="flex justify-center">
          <Loading
            isLoading={true}
            message="データ登録中..."
            size="md"
          />
        </div>
      </Modal>
      {/* 登録結果モーダル */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p className="mb-8">{modalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => closeModal(isApiSuccess)}>閉じる</Button>
        </div >
      </Modal >
    </div >
  );
};

export default TestCaseRegistrantion;