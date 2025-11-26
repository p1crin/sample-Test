import { useEffect, useState } from 'react';
import ButtonGroup from '@/components/ui/buttonGroup';
import { CreateTestGroupListRow, TestGroupListRow } from '../../../../_components/types/testGroup-list-row';
import { VerticalForm } from '@/components/ui/verticalForm';
import { useRouter } from 'next/navigation';
import { getTagOptions } from '../action';

export type TestGroupCopyFormState = CreateTestGroupListRow;

export type TestGroupCopyChangeData = {
  target: {
    name: string;
    value: string;
    type: string;
  };
};

export type TestGroupCopyFormProps = {
  groupName?: string;
  form: TestGroupCopyFormState;
  errors: Record<string, string[]>;
  toastOpen: boolean;
  onChange: (e: TestGroupCopyChangeData) => void;
  onClear: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onToastClose: () => void;
};

export function TestGroupCopyForm({
  groupName,
  form,
  errors,
  toastOpen,
  onChange,
  onClear,
  onSubmit,
  onToastClose,
}: TestGroupCopyFormProps) {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<TestGroupListRow[]>([]);
  const [tagOptions, setTagOptions] = useState<{ value: string, label: string }[]>([]);

  useEffect(() => {
    async function fetchTagOptions() {
      const result = await getTagOptions();
      if (result.success && result.data) {
        setTagOptions(result.data);
      }
    }
    fetchTagOptions();
  }, []);

  const testGroupCopy = () => {
    console.log('テストグループ複製');
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      return `${year}/${month}/${day}`;
    };
    const newTestGroup = {
      id: 1,
      oem: `OEM1`,
      model: `機種1`,
      destination: `仕向1`,
      event: `イベント1`,
      variation: `バリエーション1`,
      specs: `制御仕様名1`,
      testDatespan: `2025-09-09～2025-09-12`,
      ngPlanCount: `30`,
      created_at: formatDate(new Date()),
      updated_at: formatDate(new Date())
    };
    setMenuItems([...menuItems, newTestGroup]);
    router.push('/testGroup', { scroll: false });
  };

  // キャンセルボタン押下時処理
  const handleCansel = () => {
    router.push('/testGroup', { scroll: false });
  };

  const fields = [
    {
      label: 'OEM',
      type: 'text',
      name: 'oem',
      value: '',
      onChange: () => { },
      placeholder: 'OEM'
    },
    {
      label: '機種',
      type: 'text',
      name: 'model',
      value: '',
      onChange: () => { },
      placeholder: '機種'
    },
    {
      label: 'イベント',
      type: 'text',
      name: 'event',
      value: '',
      onChange: () => { },
      placeholder: 'イベント'
    },
    {
      label: 'バリエーション',
      type: 'text',
      name: 'variation',
      value: '',
      onChange: () => { },
      placeholder: 'バリエーション'
    },
    {
      label: '仕向',
      type: 'text',
      name: 'destination',
      value: '',
      onChange: () => { },
      placeholder: '仕向'
    },
    {
      label: '制御仕様名',
      type: 'text',
      name: 'specs',
      value: '',
      onChange: () => { },
      placeholder: '制御仕様名'
    },
    {
      label: '試験予定期間',
      type: 'date',
      name: 'testDatespan',
      value: '',
      onChange: () => { },
      placeholder: ''
    },
    {
      label: '不具合摘出予定数',
      type: 'number',
      name: 'ngPlanCount',
      value: '',
      onChange: () => { },
      placeholder: ''
    },
    {
      label: 'テスト設計者',
      type: 'tag',
      name: 'designerTag',
      value: '',
      onChange: () => { },
      placeholder: 'タグを選択してください。',
      options: tagOptions
    },
    {
      label: 'テスト実施者',
      type: 'tag',
      name: 'executerTag',
      value: '',
      onChange: () => { },
      placeholder: 'タグを選択してください。',
      options: tagOptions
    },
    {
      label: 'テスト閲覧者',
      type: 'tag',
      name: 'viewerTag',
      value: '',
      onChange: () => { },
      placeholder: 'タグを選択してください。',
      options: tagOptions
    },
  ];

  const buttons = [
    {
      label: '登録',
      onClick: testGroupCopy
    },
    {
      label: '戻る',
      onClick: handleCansel,
      isCancel: true
    },
  ];

  const sampleValue = {
    oem: "OEM1",
    model: "機種1",
    variation: "バリエーション1",
    destination: "仕向1",
    event: "イベント1",
    specs: "制御仕様名1",
    createdAt: "2025/09/09",
    updateAt: "2025/09/09",
    editorTag: "test1",
    testDatespan: "2025-09-09～2025-09-12",
    ngPlanCount: "30",
    designerTag: ["タグA", "タグB", "タグC"],
    executerTag: ["タグA", "タグB", "タグC"],
    viewerTag: ["タグA", "タグB", "タグC"]
  };

  return (
    <div>
      <VerticalForm fields={fields} values={sampleValue} />
      <ButtonGroup buttons={buttons} />
    </div>
  );
}