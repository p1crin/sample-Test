'use client';
import Loading from '@/components/ui/loading';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { generateUniqueId } from '@/utils/fileUtils';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateTestCaseListRow } from '../../../../_components/types/testCase-list-row';
import type { TestCase } from './TestCaseEditForm';
import { TestCaseEditForm } from './TestCaseEditForm';

export function TestCaseEditFormContainer() {
  const [editLoading, setEditLoading] = useState(true);
  const [testContents, setTestContents] = useState<[] | TestCase[]>([]);
  const [apiError, setApiError] = useState<Error | null>(null);
  const [form, setForm] = useState<UpdateTestCaseListRow>({
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

  const params = useParams();
  const groupId = parseInt(params.groupId as string, 10);
  const tid = params.tid;
  if (apiError) throw apiError;

  useEffect(() => {
    const getTestCaseDataFunc = async () => {
      try {
        setEditLoading(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const testCaseEditData = await apiGet<any>(`/api/test-groups/${groupId}/cases/${tid}`);

        if (!testCaseEditData.success || !testCaseEditData.data) {
          throw new Error('データの取得に失敗しました' + ` (error: ${testCaseEditData.error})`);
        }

        const editData = testCaseEditData.data[0];
        // 制御仕様書のフォーマット
        const change_key_control_spec = [];
        for (const file of testCaseEditData.data[0].control_spec) {
          change_key_control_spec.push({
            name: file.file_name,
            id: generateUniqueId(),
            path: file.file_path,
            fileType: file.file_type,
            fileNo: file.file_no
          })
        }
        // データフローのフォーマット
        const change_key_data_flow = [];
        for (const file of testCaseEditData.data[0].data_flow) {
          change_key_data_flow.push({
            name: file.file_name,
            id: generateUniqueId(),
            path: file.file_path,
            fileType: file.file_type,
            fileNo: file.file_no
          })
        }
        // テストケース情報のフォーマット
        const fomatTestGroupEditData: UpdateTestCaseListRow = {
          ...editData,
          checkItems: editData.check_items,
          testProcedure: editData.test_procedure,
          controlSpecFile: change_key_control_spec,
          dataFlowFile: change_key_data_flow
        }
        setForm(fomatTestGroupEditData);
        setTestContents(editData.contents);
        setEditLoading(false);

        clientLogger.info('テストケース編集画面', 'データ取得成功', { testGroupId: groupId, tid: editData.tid });
      } catch (err) {
        clientLogger.error('テストケース編集画面', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
        setApiError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setEditLoading(false);
      }
    };
    getTestCaseDataFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      {/* テストグループデータ読み込み中の表示 */}
      <Loading
        isLoading={editLoading}
        message="データ読み込み中..."
        size="md"
      />

      {!editLoading && (
        <TestCaseEditForm
          id={groupId}
          form={form}
          contents={testContents}
        />
      )}
    </>
  );
}