import TestCaseForm from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/_components/testCaseForm';
import ButtonGroup from '@/components/ui/buttonGroup';
import FileUploadField from '@/components/ui/FileUploadField';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiFetch } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UpdateTestCaseListRow } from '../../../../_components/types/testCase-list-row';

// ファイルタイプ定数（API側と統一）
const FILE_TYPE = {
  CONTROL_SPEC: 0,
  DATA_FLOW: 1,
} as const;

export type TestCaseEditChangeData = {
  target: {
    id: string;
    name: string;
    value: string;
    type: string;
  };
};

export type TestCaseEditFormProps = {
  id?: number;
  form: UpdateTestCaseListRow;
  contents: [] | TestCase[];
};

export type TestCase = {
  id: number;
  testCase: string;
  expectedValue: string;
  is_target: boolean;
  selected: boolean;
};

// 削除されたファイルの情報
export type DeletedFile = {
  fileNo: number;
  fileType: number; // 0: controlSpec, 1: dataFlow
};

// 削除されたテスト内容の情報
export type DeletedContent = {
  testCaseNo: number;
};

export function TestCaseEditForm({
  id,
  form,
  contents,
}: TestCaseEditFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [testContents, setTestContents] = useState<[] | TestCase[]>([]);
  const [submitError, setSubmitError] = useState<string>('');

  // 削除追跡用ステート
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([]);
  const [deletedContents, setDeletedContents] = useState<DeletedContent[]>([]);

  // 初期ファイルIDを保存（編集開始時に存在していたファイル）
  const initialFileIds = useRef({
    controlSpec: [] as number[],
    dataFlow: [] as number[]
  });
  const isFileIdsInitializedRef = useRef(false);

  // テストケースのフォーマットの各値取得
  useEffect(() => {
    // 初回のみ初期ファイルIDを保存
    if (!isFileIdsInitializedRef.current) {
      isFileIdsInitializedRef.current = true;
      initialFileIds.current = {
        controlSpec: form.controlSpecFile.map(f => f.fileNo).filter((id): id is number => id !== undefined),
        dataFlow: form.dataFlowFile.map(f => f.fileNo).filter((id): id is number => id !== undefined),
      };
    }

    setFormData(form);
    setTestContents(contents);
  }, [form, contents]);

  // テスト内容が変更されたときのハンドラー
  // IDは生成せず、データのみを保持（IDはTestCaseFormが内部管理）
  const handleTestContentsChange = (contents: { testCase: string; expectedValue: string; is_target: boolean }[]) => {
    setTestContents(contents.map((tc) => ({
      id: 0, // サーバー送信時には使用しないダミー値
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

  const handleFileChange = (fieldName: string, files: FileInfo[], deletedFile?: FileInfo) => {
    // 削除されたファイルがある場合、削除リストに追加
    if (deletedFile && typeof deletedFile.fileNo === 'number') {
      const fileType = fieldName === 'controlSpecFile' ? FILE_TYPE.CONTROL_SPEC : FILE_TYPE.DATA_FLOW;
      setDeletedFiles(prev => [...prev, { fileNo: deletedFile.fileNo as number, fileType }]);
    }

    setFormData(prev => ({
      ...prev,
      [fieldName]: files
    }));
  };

  // テスト内容が削除されたときのハンドラー
  const handleTestContentDelete = (deletedDbId: number) => {
    setDeletedContents(prev => [...prev, { testCaseNo: deletedDbId }]);
  };

  // ファイルアップロード処理
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
      formDataObj.append('testGroupId', String(id));
      formDataObj.append('tid', formData.tid);
      formDataObj.append('fileType', String(fileType));

      const response = await apiFetch('/api/files', {
        method: 'POST',
        body: formDataObj,
      });

      if (response.ok) {
        const result = await response.json();
        // アップロード成功後、サーバーから返されたfileId等を設定
        return {
          ...file,
          fileNo: result.data.fileNo,
          path: result.data.filePath,
          fileType: result.data.fileType,
        };
      } else {
        throw new Error('File upload failed');
      }
    }

    return file;
  };

  const fields = [
    {
      label: 'TID',
      type: 'text',
      name: 'tid',
      value: formData.tid,
      onChange: handleChange,
      placeholder: 'TID',
      disabled: true
    },
    {
      label: '第1層',
      type: 'text',
      name: 'firstLayer',
      value: formData.firstLayer,
      onChange: handleChange,
      placeholder: '第1層'
    },
    {
      label: '第2層',
      type: 'text',
      name: 'secondLayer',
      value: formData.secondLayer,
      onChange: handleChange,
      placeholder: '第2層'
    },
    {
      label: '第3層',
      type: 'text',
      name: 'thirdLayer',
      value: formData.thirdLayer,
      onChange: handleChange,
      placeholder: '第3層'
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourthLayer',
      value: formData.fourthLayer,
      onChange: handleChange,
      placeholder: '第4層'
    },
    {
      label: '目的',
      type: 'text',
      name: 'purpose',
      value: formData.purpose,
      onChange: handleChange,
      placeholder: '目的'
    },
    {
      label: '要求ID',
      type: 'text',
      name: 'requestId',
      value: formData.requestId,
      onChange: handleChange,
      placeholder: '要求ID'
    },
    {
      label: '確認観点',
      type: 'textarea',
      name: 'checkItems',
      value: formData.checkItems,
      onChange: handleChange,
      placeholder: '確認観点'
    },
    {
      label: 'テスト手順',
      type: 'textarea',
      name: 'testProcedure',
      value: formData.testProcedure,
      onChange: handleChange,
      placeholder: 'テスト手順',
      required: true,
    }
  ];

  // 更新ボタン押下時処理
  const handleEditer = async () => {
    // エラーをクリア
    setSubmitError('');

    clientLogger.info('テストケース編集画面', 'テストケース更新開始', { formData, testContents, deletedFiles, deletedContents });

    try {
      // JSONペイロードを作成
      const payload = {
        tid: formData.tid,
        firstLayer: formData.firstLayer,
        secondLayer: formData.secondLayer,
        thirdLayer: formData.thirdLayer,
        fourthLayer: formData.fourthLayer,
        purpose: formData.purpose,
        requestId: formData.requestId,
        checkItems: formData.checkItems,
        testProcedure: formData.testProcedure,
        controlSpecFileIds: formData.controlSpecFile.map(f => f.fileNo).filter((id): id is number => id !== undefined),
        dataFlowFileIds: formData.dataFlowFile.map(f => f.fileNo).filter((id): id is number => id !== undefined),
        testContents: testContents,
        deletedFiles: deletedFiles,
        deletedContents: deletedContents,
      };

      const response = await apiFetch(`/api/test-groups/${id}/cases/${encodeURIComponent(formData.tid)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        clientLogger.info('テストケース編集画面', 'テストケース更新成功');
        router.push(`/testGroup/${id}/testCase`);
      } else {
        // エラーレスポンスを取得
        const errorData = await response.json().catch(() => ({ message: '更新に失敗しました' }));
        const errorMessage = errorData.message || '更新に失敗しました';
        setSubmitError(errorMessage);
        clientLogger.error('テストケース編集画面', 'テストケース更新失敗', {
          statusCode: response.status,
          message: errorMessage
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新中にエラーが発生しました';
      setSubmitError(errorMessage);
      clientLogger.error('テストケース編集画面', 'テストケース更新失敗', { error: errorMessage });
    }
  }

  // キャンセルボタン押下時処理
  const handleCansel = async () => {
    // 新規追加されたファイルを削除
    const currentControlSpecIds = formData.controlSpecFile.map(f => f.fileNo).filter((id): id is number => id !== undefined);
    const currentDataFlowIds = formData.dataFlowFile.map(f => f.fileNo).filter((id): id is number => id !== undefined);

    // 初期状態になかったファイルIDを抽出（新規追加されたファイル）
    const newControlSpecIds = currentControlSpecIds.filter(id => !initialFileIds.current.controlSpec.includes(id));
    const newDataFlowIds = currentDataFlowIds.filter(id => !initialFileIds.current.dataFlow.includes(id));

    // 新規追加されたファイルを削除
    const deletePromises: Promise<Response>[] = [];

    for (const fileNo of newControlSpecIds) {
      deletePromises.push(
        apiFetch('/api/files', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            testGroupId: id,
            tid: formData.tid,
            fileNo: fileNo,
            fileType: FILE_TYPE.CONTROL_SPEC,
          }),
        })
      );
    }

    for (const fileNo of newDataFlowIds) {
      deletePromises.push(
        apiFetch('/api/files', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            testGroupId: id,
            tid: formData.tid,
            fileNo: fileNo,
            fileType: FILE_TYPE.DATA_FLOW,
          }),
        })
      );
    }

    try {
      await Promise.all(deletePromises);
      clientLogger.info('テストケース編集画面', 'キャンセル時のファイル削除成功', {
        deletedControlSpec: newControlSpecIds,
        deletedDataFlow: newDataFlowIds
      });
    } catch (error) {
      clientLogger.error('テストケース編集画面', 'キャンセル時のファイル削除失敗', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    router.push(`/testGroup/${id}/testCase`);
  }

  const buttons = [
    {
      label: '更新',
      onClick: () => {
        handleEditer();
      },
    },
    {
      label: '戻る',
      onClick: handleCansel,
      isCancel: true
    }
  ];

  return (
    <div>
      <h1 className="text-lg font-bold">テスト情報</h1>

      {/* エラーメッセージ表示 */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p className="font-bold">エラー</p>
          <p>{submitError}</p>
        </div>
      )}

      <div>
        <VerticalForm fields={fields} />
      </div>
      {/* ファイルアップロードセレクション */}
      <div className="pb-2 w-4/5 grid gap-4 grid-cols-1">
        <FileUploadField
          label="制御仕様書"
          name="controlSpecFile"
          value={formData.controlSpecFile}
          onChange={(e, deletedFile) => handleFileChange('controlSpecFile', e.target.value, deletedFile)}
          onFileUpload={(file) => handleFileUpload(file, FILE_TYPE.CONTROL_SPEC)}
          error={''}
          isCopyable={true}
        />
        <FileUploadField
          label="データフロー"
          name="dataFlowFile"
          value={formData.dataFlowFile}
          onChange={(e, deletedFile) => handleFileChange('dataFlowFile', e.target.value, deletedFile)}
          onFileUpload={(file) => handleFileUpload(file, FILE_TYPE.DATA_FLOW)}
          error={''}
          isCopyable={true}
        />
      </div>
      {/* テスト内容セクション */}
      <div className="my-10">
        <h2 className="text-lg font-bold mb-4">テスト内容</h2>
        <div className="bg-gray-50 p-4 rounded-md flex justify-center">
          <TestCaseForm
            value={testContents}
            onChange={handleTestContentsChange}
            onDelete={handleTestContentDelete}
          />
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <ButtonGroup buttons={buttons} />
      </div>
    </div>
  );
}