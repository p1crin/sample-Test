'use client';
import { apiGet } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { generateUniqueId } from '@/utils/fileUtils';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateTestCaseListRow } from '../../../../_components/types/testCase-list-row';
import { saveData } from '../action';
import { testCaseEditSchema } from './schemas/testCase-edit-schema';
import type { TestCase, TestCaseEditChangeData } from './TestCaseEditForm';
import { TestCaseEditForm } from './TestCaseEditForm';

export function TestCaseEditFormContainer() {
  const [toastOpen, setToastOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(true);
  const params = useParams();
  const groupId = parseInt(params.groupId as string, 10);
  const tid = params.tid;
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateTestCaseListRow>({
    tid: '',
    firstLayer: '',
    secondLayer: '',
    thirdLayer: '',
    fourthLayer: '',
    purpose: '',
    requestId: '',
    checkItems: '',
    testProcedure: '',
    controlSpecFile: [],
    dataFlowFile: [],
  });
  const [testContents, setTestContents] = useState<[] | TestCase[]>([]);

  const handleChange = (e: TestCaseEditChangeData) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    try {
      const result = testCaseEditSchema.safeParse(form);
      if (!result.success) {
        // Zodのエラーを各フィールドごとにまとめる
        const fieldErrors: Record<string, string[]> = {};
        result.error.errors.forEach((err) => {
          const key = err.path[0] as string;
          if (!fieldErrors[key]) fieldErrors[key] = [];
          fieldErrors[key].push(err.message);
        });
        setErrors(fieldErrors);
        setToastOpen(false);
        return;
      }

      const saveDataFunc = async () => {
        try {
          const testCaseData = await saveData(form);
          if (!testCaseData.success || !testCaseData.data) {
            throw new Error('データの取得に失敗しました' + ` (error: ${testCaseData.error})`);
          }
          clientLogger.info('TestCaseEditFormContainer', 'データ保存成功');
        } catch (err) {
          clientLogger.error('TestCaseEditFormContainer', 'データ保存失敗', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      };
      saveDataFunc();

      setToastOpen(true);
    } catch {
      setLoadError('送信時に予期せぬエラーが発生しました');
    }
  };

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
        let change_key_control_spec = [];
        for (const file of testCaseEditData.data[0].control_spec) {
          change_key_control_spec.push({
            name: file.file_name,
            id: generateUniqueId(),
            path: file.file_path,
            fileType: file.file_type,
            fileNo: file.file_no
          })
        }
        let change_key_data_flow = [];
        for (const file of testCaseEditData.data[0].data_flow) {
          change_key_data_flow.push({
            name: file.file_name,
            id: generateUniqueId(),
            path: file.file_path,
            fileType: file.file_type,
            fileNo: file.file_no
          })
        }
        // データをフォーマット
        const fomatTestGroupEditData: UpdateTestCaseListRow = {
          tid: editData.tid,
          firstLayer: editData.first_layer,
          secondLayer: editData.second_layer,
          thirdLayer: editData.third_layer,
          fourthLayer: editData.fourth_layer,
          purpose: editData.purpose,
          requestId: editData.request_id,
          checkItems: editData.check_items,
          testProcedure: editData.test_procedure,
          controlSpecFile: change_key_control_spec,
          dataFlowFile: change_key_data_flow
        }
        setForm(fomatTestGroupEditData);
        setTestContents(editData.contents);
        setEditLoading(false);

        clientLogger.info('TestCaseEditFormContainer', 'データ取得成功', { tid: editData.tid });
      } catch (err) {
        clientLogger.error('TestCaseEditFormContainer', 'データ取得失敗', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };
    getTestCaseDataFunc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空の依存配列で、マウント時に一度だけ実行

  return (
    <>
      <TestCaseEditForm
        id={groupId}
        form={form}
        contents={testContents}
      />
      {loadError && (
        <div className="text-red-500 mt-4" role="alert">
          {loadError}
        </div>
      )}
    </>
  );
}
