import TestCaseForm from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/_components/testCaseForm';
import ButtonGroup from '@/components/ui/buttonGroup';
import FileUploadField from '@/components/ui/FileUploadField';
import { VerticalForm } from '@/components/ui/verticalForm';
import { apiFetch } from '@/utils/apiClient';
import clientLogger from '@/utils/client-logger';
import { FileInfo } from '@/utils/fileUtils';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UpdateTestCaseListRow } from '../../../../_components/types/testCase-list-row';

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

export function TestCaseEditForm({
  id,
  form,
  contents,
}: TestCaseEditFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(form);
  const [testContents, setTestContents] = useState<[] | TestCase[]>([]);
  const [editError, setEditErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // テストケースのフォーマットの各値取得
  useEffect(() => {
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

  const handleFileChange = (fieldName: string, files: FileInfo[]) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: files
    }));
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
    // 更新処理をここに記述
    console.log('テストグループ編集');
    const validationData = {
      ...formData,
      testContents
    }

    // const validationResult = testCaseEditSchema.safeParse(validationData);
    // if (!validationResult.success) {
    //   const newErrors: Record<string, string> = {};
    //   validationResult.error.errors.forEach(err => {
    //     const fieldPath = err.path[0] as string;
    //     newErrors[fieldPath] = err.message;
    //   });
    //   setEditErrors(newErrors);
    //   return;
    // }

    // // バリデーション成功時にエラークリア
    // setEditErrors({});

    clientLogger.info('テストケース編集画面', 'テストケース更新開始', { formData, testContents });

    try {
      const formDataObj = new FormData();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await apiFetch(`/api/test-groups/${id}/cases/${encodeURIComponent(formData.tid)}`, {
        method: 'PUT',
        body: formDataObj
      });

      if (response.ok) {
        setTimeout(() => {
          router.push(`/testGroup/${id}/testCase`);
        }, 1500);
      }
    } catch (error) {

    }
  }

  // キャンセルボタン押下時処理
  const handleCansel = () => {
    console.log('キャンセルされました');
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
      <div>
        <VerticalForm fields={fields} />
      </div>
      {/* ファイルアップロードセレクション */}
      <div className="pb-2 w-4/5 grid gap-4 grid-cols-1">
        <FileUploadField
          label="制御仕様書"
          name="controlSpecFile"
          value={formData.controlSpecFile}
          onChange={(e) => handleFileChange('controlSpecFile', e.target.value)}
          error={''}
          isCopyable={true}
        />
        <FileUploadField
          label="データフロー"
          name="dataFlowFile"
          value={formData.dataFlowFile}
          onChange={(e) => handleFileChange('dataFlowFile', e.target.value)}
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

          />
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <ButtonGroup buttons={buttons} />
      </div>
    </div>
  );
}