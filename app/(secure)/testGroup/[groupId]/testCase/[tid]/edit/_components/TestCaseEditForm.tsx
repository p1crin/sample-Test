import TestCaseForm from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/_components/testCaseForm';
import { Button } from '@/components/ui/button';
import ButtonGroup from '@/components/ui/buttonGroup';
import FileUploadField from '@/components/ui/FileUploadField';
import { Modal } from '@/components/ui/modal';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiDelete, apiFetch, apiPut } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UpdateTestCaseListRow } from '../../../../_components/types/testCase-list-row';
import { testCaseEditSchema } from './schemas/testCase-edit-schema';

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
  base64?: string;
};

// 削除されたテスト内容の情報
export type DeletedContent = {
  testCaseNo: number;
};

export function TestCaseEditForm({
  id: groupId,
  form,
  contents,
}: TestCaseEditFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [testContents, setTestContents] = useState<[] | TestCase[]>([]);

  // 削除追跡用ステート
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([]);
  const [deletedContents, setDeletedContents] = useState<DeletedContent[]>([]);

  // 初期ファイルIDを保存（編集開始時に存在していたファイル）
  const initialFileIds = useRef({
    controlSpec: [] as number[],
    dataFlow: [] as number[]
  });
  const isFileIdsInitializedRef = useRef(false);

  // 初期テスト内容のIDを保存
  const testContentIds = useRef<number[]>([]);
  const testContentIdsRef = useRef(false);
  const maxId = useRef(0);

  const [editError, setEditErrors] = useState<Record<string, string>>({});
  const [editIsModalOpen, setEditIsModalOpen] = useState(false);
  const [editModalMessage, setEditModalMessage] = useState('');
  const [editIsLoading, setEditIsLoading] = useState(false);

  // 更新成功フラグ（ブラウザバック時の判定用）
  const isUpdateSuccessful = useRef(false);

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
    // 初回のみテスト内容IDを保存
    if (!testContentIdsRef.current) {
      testContentIdsRef.current = true;
      if (contents.length) {
        contents.map((ids) => {
          testContentIds.current.push(ids.id);
        });
        maxId.current = (Math.max(...testContentIds.current) + 1);
      }
      maxId.current = maxId.current > 0 ? maxId.current : 0;
    }
    setFormData(form);
    setTestContents(contents);
  }, [form, contents]);

  // ブラウザバックやタブクローズ時のクリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントがアンマウントされる時（ブラウザバック含む）
      // 更新が成功していない場合のみ、新規追加されたファイルを削除
      if (!isUpdateSuccessful.current) {
        const currentControlSpecIds = formData.controlSpecFile
          .map(f => f.fileNo)
          .filter((id): id is number => id !== undefined);
        const currentDataFlowIds = formData.dataFlowFile
          .map(f => f.fileNo)
          .filter((id): id is number => id !== undefined);

        // 新規追加されたファイルのみを特定
        const newControlSpecIds = currentControlSpecIds.filter(
          id => !initialFileIds.current.controlSpec.includes(id)
        );
        const newDataFlowIds = currentDataFlowIds.filter(
          id => !initialFileIds.current.dataFlow.includes(id)
        );

        // 新規追加されたファイルがある場合のみ削除処理を実行
        if (newControlSpecIds.length > 0 || newDataFlowIds.length > 0) {
          const deletePromises: Promise<Response>[] = [];

          // 制御仕様書ファイルの削除
          for (const fileNo of newControlSpecIds) {
            const fileInfo = formData.controlSpecFile.find(f => f.fileNo === fileNo);
            if (fileInfo) {
              deletePromises.push(
                apiFetch('/api/files', {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    testGroupId: groupId,
                    tid: formData.tid,
                    fileType: FILE_TYPE.CONTROL_SPEC,
                    fileNo: fileNo,
                    filePath: fileInfo.path,
                  }),
                })
              );
            }
          }

          // データフローファイルの削除
          for (const fileNo of newDataFlowIds) {
            const fileInfo = formData.dataFlowFile.find(f => f.fileNo === fileNo);
            if (fileInfo) {
              deletePromises.push(
                apiFetch('/api/files', {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    testGroupId: groupId,
                    tid: formData.tid,
                    fileType: FILE_TYPE.DATA_FLOW,
                    fileNo: fileNo,
                    filePath: fileInfo.path,
                  }),
                })
              );
            }
          }

          // ファイル削除実行（非同期だがクリーンアップなのでawaitしない）
          Promise.all(deletePromises)
            .then(() => {
              clientLogger.info('テストケース編集画面', 'ブラウザバック時のファイル削除成功', {
                deletedControlSpec: newControlSpecIds,
                deletedDataFlow: newDataFlowIds
              });
            })
            .catch((error) => {
              clientLogger.error('テストケース編集画面', 'ブラウザバック時のファイル削除失敗', {
                error: error instanceof Error ? error.message : String(error)
              });
            });
        }
      }
    };
  }, [formData.controlSpecFile, formData.dataFlowFile, formData.tid, groupId]);

  // タブクローズ・ページリロード時のクリーンアップ
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // 更新が成功していない場合のみ、新規追加されたファイルを削除
      if (!isUpdateSuccessful.current) {
        const currentControlSpecIds = formData.controlSpecFile
          .map(f => f.fileNo)
          .filter((id): id is number => id !== undefined);
        const currentDataFlowIds = formData.dataFlowFile
          .map(f => f.fileNo)
          .filter((id): id is number => id !== undefined);

        // 新規追加されたファイルのみを特定
        const newControlSpecIds = currentControlSpecIds.filter(
          id => !initialFileIds.current.controlSpec.includes(id)
        );
        const newDataFlowIds = currentDataFlowIds.filter(
          id => !initialFileIds.current.dataFlow.includes(id)
        );

        // 新規追加されたファイルがある場合のみ削除処理を実行
        if (newControlSpecIds.length > 0 || newDataFlowIds.length > 0) {
          // 制御仕様書ファイルの削除
          for (const fileNo of newControlSpecIds) {
            const fileInfo = formData.controlSpecFile.find(f => f.fileNo === fileNo);
            if (fileInfo) {
              // keepalive: true を使用してページアンロード後もリクエストを継続
              fetch('/api/files', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  testGroupId: groupId,
                  tid: formData.tid,
                  fileType: FILE_TYPE.CONTROL_SPEC,
                  fileNo: fileNo,
                  filePath: fileInfo.path,
                }),
                keepalive: true,
              }).catch(() => {
                // エラーは無視（ページがアンロードされるため）
              });
            }
          }

          // データフローファイルの削除
          for (const fileNo of newDataFlowIds) {
            const fileInfo = formData.dataFlowFile.find(f => f.fileNo === fileNo);
            if (fileInfo) {
              // keepalive: true を使用してページアンロード後もリクエストを継続
              fetch('/api/files', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  testGroupId: groupId,
                  tid: formData.tid,
                  fileType: FILE_TYPE.DATA_FLOW,
                  fileNo: fileNo,
                  filePath: fileInfo.path,
                }),
                keepalive: true,
              }).catch(() => {
                // エラーは無視（ページがアンロードされるため）
              });
            }
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [formData.controlSpecFile, formData.dataFlowFile, formData.tid, groupId]);


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

    // testContentのId整形
    if (contents.length != testContentIds.current.length) {
      if (contents.length < testContentIds.current.length) {
        testContentIds.current.pop();
      } else {
        if (Math.max(...testContentIds.current) < maxId.current) {
          testContentIds.current.push(maxId.current);
        } else {
          testContentIds.current.push(Math.max(...testContentIds.current) + 1);
        }
      }
    }
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
      setDeletedFiles(prev => [...prev, { fileNo: deletedFile.fileNo as number, fileType, base64: deletedFile.base64 }]);
    }

    setFormData(prev => ({
      ...prev,
      [fieldName]: files
    }));
  };

  // テスト内容が削除されたときのハンドラー
  const handleTestContentDelete = (deletedDbId: number) => {
    testContentIds.current = testContentIds.current.filter(id => id != deletedDbId);
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
      formDataObj.append('testGroupId', String(groupId));
      formDataObj.append('tid', formData.tid);
      formDataObj.append('fileType', String(fileType));

      const response = await apiFetch('/api/files', {
        method: 'POST',
        body: formDataObj,
      });

      if (response.ok) {
        clientLogger.info('テストケース編集画面', 'ファイルアップロード成功');
        const result = await response.json();
        // アップロード成功後、サーバーから返されたfileId等を設定
        return {
          ...file,
          fileNo: result.data.fileNo,
          path: result.data.filePath,
          fileType: result.data.fileType,
        };
      } else {
        clientLogger.error('テストケース編集画面', 'ファイルアップロード失敗');
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
      placeholder: 'TID（例: 123-45-6-789）',
      disabled: true,
      error: editError.tid
    },
    {
      label: '第1層',
      type: 'text',
      name: 'first_layer',
      value: formData.first_layer,
      onChange: handleChange,
      placeholder: '第1層',
      error: editError.first_layer
    },
    {
      label: '第2層',
      type: 'text',
      name: 'second_layer',
      value: formData.second_layer,
      onChange: handleChange,
      placeholder: '第2層',
      error: editError.second_layer
    },
    {
      label: '第3層',
      type: 'text',
      name: 'third_layer',
      value: formData.third_layer,
      onChange: handleChange,
      placeholder: '第3層',
      error: editError.third_layer
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourth_layer',
      value: formData.fourth_layer,
      onChange: handleChange,
      placeholder: '第4層',
      error: editError.fourth_layer
    },
    {
      label: '目的',
      type: 'text',
      name: 'purpose',
      value: formData.purpose,
      onChange: handleChange,
      placeholder: '目的',
      error: editError.purpose
    },
    {
      label: '要求ID',
      type: 'text',
      name: 'request_id',
      value: formData.request_id,
      onChange: handleChange,
      placeholder: '要求ID',
      error: editError.request_id
    },
    {
      label: '確認観点',
      type: 'textarea',
      name: 'checkItems',
      value: formData.checkItems,
      onChange: handleChange,
      placeholder: '確認観点',
      error: editError.checkItems
    },
    {
      label: 'テスト手順',
      type: 'textarea',
      name: 'testProcedure',
      value: formData.testProcedure,
      onChange: handleChange,
      placeholder: 'テスト手順',
      required: true,
      error: editError.testProcedure
    }
  ];

  // 更新ボタン押下時処理
  const handleEditer = async () => {
    // バリデーションチェック
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

    const validationResult = testCaseEditSchema.safeParse(validationData);

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
      setEditErrors(newErrors);
      clientLogger.warn('テストケース編集画面', 'バリデーションエラー', { errors: newErrors });
      return;
    }

    // バリデーション成功時にエラークリア
    setEditErrors({});

    setEditIsLoading(true);
    clientLogger.info('テストケース編集画面', 'テストケース更新開始', { formData, testContents, deletedFiles, deletedContents });

    try {
      // JSONペイロードを作成
      const payload = {
        first_layer: formData.first_layer,
        second_layer: formData.second_layer,
        third_layer: formData.third_layer,
        fourth_layer: formData.fourth_layer,
        purpose: formData.purpose,
        request_id: formData.request_id,
        checkItems: formData.checkItems,
        testProcedure: formData.testProcedure,
        testContents: testContents,
        testContentIds: testContentIds.current,
        deletedContents: deletedContents,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await apiPut<any>(`/api/test-groups/${groupId}/cases/${encodeURIComponent(formData.tid)}`, payload);

      // 削除されたファイルのレスポンス格納用
      const deletePromises: Promise<Response>[] = [];

      for (const file of deletedFiles) {
        deletePromises.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          apiDelete<any>('/api/files', {
            testGroupId: groupId,
            tid: formData.tid,
            fileNo: file.fileNo,
            fileType: file.fileType,
          })
        );
      }

      try {
        await Promise.all(deletePromises);
        clientLogger.info('テストケース編集画面', 'ファイル削除成功', {
          deletedFiles: deletedFiles,
        });
      } catch (error) {
        clientLogger.error('テストケース編集画面', 'ファイル削除失敗', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      if (result.success) {
        // 更新成功フラグを立てる（ブラウザバック時のファイル削除を防ぐため）
        isUpdateSuccessful.current = true;
        clientLogger.info('テストケース編集画面', 'テストケース更新成功');
        setEditModalMessage('テストケースを更新しました');
        setEditIsModalOpen(true);
        setTimeout(() => {
          router.push(`/testGroup/${groupId}/testCase`);
        }, 1500);
        clearTimeout;
      } else {
        // エラーレスポンスを取得
        clientLogger.error('テストケース編集画面', 'テストケース更新失敗', { error: result.error });
        setEditModalMessage('テストケースの更新に失敗しました');
        setEditIsModalOpen(true);
      }
    } catch (error) {
      clientLogger.error('テストケース編集画面', 'テストケース更新エラー', { error });
      setEditModalMessage('テストケースの更新に失敗しました');
      setEditIsModalOpen(true);
    } finally {
      setEditIsLoading(false);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiDelete<any>('/api/files', {
          testGroupId: groupId,
          tid: formData.tid,
          fileNo: fileNo,
          fileType: FILE_TYPE.CONTROL_SPEC,
        })
      );
    }

    for (const fileNo of newDataFlowIds) {
      deletePromises.push(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiDelete<any>('/api/files', {
          testGroupId: groupId,
          tid: formData.tid,
          fileNo: fileNo,
          fileType: FILE_TYPE.DATA_FLOW,
        })
      );
    }

    for (const file of deletedFiles) {
      if (file.base64) {
        deletePromises.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          apiDelete<any>('/api/files', {
            testGroupId: groupId,
            tid: formData.tid,
            fileNo: file.fileNo,
            fileType: file.fileType,
          })
        );
      }
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

    router.push(`/testGroup/${groupId}/testCase`);
  }

  const buttons = [
    {
      label: editIsLoading ? '更新中...' : '更新',
      onClick: () => {
        clientLogger.info('テストケース編集画面', '更新ボタン押下');
        handleEditer();
      },
      disabled: editIsLoading,
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
      <div>
        <VerticalForm fields={fields} />
      </div>
      {/* ファイルアップロードセレクション */}
      <div className="pb-2 w-4/5 grid gap-4 grid-cols-1">
        <FileUploadField
          label="制御仕様書"
          name="controlSpecFile"
          value={formData.controlSpecFile}
          onChange={(e, controlSpecFile) => handleFileChange('controlSpecFile', e.target.value, controlSpecFile)}
          onFileUpload={(file) => handleFileUpload(file, FILE_TYPE.CONTROL_SPEC)}
          error={editError.controlSpecFile}
          isCopyable={true}
        />
        <FileUploadField
          label="データフロー"
          name="dataFlowFile"
          value={formData.dataFlowFile}
          onChange={(e, deletedFile) => handleFileChange('dataFlowFile', e.target.value, deletedFile)}
          onFileUpload={(file) => handleFileUpload(file, FILE_TYPE.DATA_FLOW)}
          error={editError.dataFlowFile}
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
            errors={editError}
          />
          {editError && (
            <div className="text-red-500 text-sm mt-2"></div>
          )}
        </div>
      </div>
      <div className="flex justify-center space-x-4">
        <ButtonGroup buttons={buttons} />
      </div>
      {/* 結果モーダル */}
      <Modal open={editIsModalOpen} onClose={() => setEditIsModalOpen(false)}>
        <p className="mb-8">{editModalMessage}</p>
        <div className="flex justify-center">
          <Button className="w-24" onClick={() => setEditIsModalOpen(false)}>閉じる</Button>
        </div>
      </Modal>
    </div>
  );
}