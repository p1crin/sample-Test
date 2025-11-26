import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Toast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import Link from 'next/link';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import clientLogger from '@/utils/client-logger';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { format } from 'date-fns';
import { TestCaseListRow } from '../../../../_components/types/testCase-list-row';
import { VerticalForm } from '@/components/ui/verticalForm';
import { useRouter } from 'next/navigation';
import TestCaseForm from '@/components/ui/testCaseForm';

export type TestCaseEditFormState = TestCaseListRow;

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
  form: TestCaseEditFormState;
  errors: Record<string, string[]>;
  toastOpen: boolean;
  onChange: (e: TestCaseEditChangeData) => void;
  onClear: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onToastClose: () => void;
};

export function TestCaseEditForm({
  id,
  form,
  errors,
  toastOpen,
  onChange,
  onClear,
  onSubmit,
  onToastClose,
}: TestCaseEditFormProps) {
  const router = useRouter();

  // 更新ボタン押下時処理
  const handleEditer = () => {
    // 更新処理をここに記述
    console.log('テストグループ編集');
    router.push('/testCase', { scroll: false })

  }

  // キャンセルボタン押下時処理
  const handleCansel = () => {
    history.back();
  }

  const fields = [
    {
      label: 'TID',
      type: 'text',
      name: 'tid',
      value: '',
      onChange: () => { },
      placeholder: 'TID'
    },
    {
      label: '第1層',
      type: 'text',
      name: 'firstLayer',
      value: '',
      onChange: () => { },
      placeholder: '第1層'
    },
    {
      label: '第2層',
      type: 'text',
      name: 'secondLayer',
      value: '',
      onChange: () => { },
      placeholder: '第2層'
    },
    {
      label: '第3層',
      type: 'text',
      name: 'thirdLayer',
      value: '',
      onChange: () => { },
      placeholder: '第3層'
    },
    {
      label: '第4層',
      type: 'text',
      name: 'fourthLayer',
      value: '',
      onChange: () => { },
      placeholder: '第4層'
    },
    {
      label: '目的',
      type: 'text',
      name: 'purpose',
      value: '',
      onChange: () => { },
      placeholder: '目的'
    },
    {
      label: '要求ID',
      type: 'text',
      name: 'requestId',
      value: '',
      onChange: () => { },
      placeholder: '要求ID'
    },
    {
      label: '確認観点',
      type: 'textarea',
      name: 'checkItems',
      value: '',
      onChange: () => { },
      placeholder: '確認観点'
    },
    {
      label: '制御仕様',
      type: 'file',
      name: 'controlSpec',
      value: '',
      onChange: () => { },
      placeholder: '制御仕様'
    },
    {
      label: 'データフロー',
      type: 'file',
      name: 'dataFlow',
      value: '',
      onChange: () => { },
      placeholder: 'データフロー'
    },
    {
      label: 'テスト手順',
      type: 'textarea',
      name: 'testProcedure',
      value: '',
      onChange: () => { },
      placeholder: 'テスト手順'
    }
  ];

  const sampleValue = {
    tid: "1-1-1-1",
    firstLayer: "第1層-1",
    secondLayer: "第2層-1",
    thirdLayer: "第3層-1",
    fourthLayer: "第4層-1",
    checkItems: "確認観点サンプル",
    requestId: "要求ID1",
    purpose: "目的1",
    dataflow: "dataflow1",
    testProcedure: "テスト手順サンプル"
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  };

  return (
    <div>
      <h1 className="text-lg font-bold">テスト情報</h1>
      <div>
        <VerticalForm fields={fields} values={sampleValue} />
        <p>{sampleValue.dataflow}</p>
      </div>
      <div className="my-10"></div>
      <h1 className="text-lg font-bold">テスト内容</h1>
      <div className="flex justify-center space-x-4">
        <TestCaseForm value={[
          { testCase: 'テストケース1', expectedValue: '期待値1', excluded: true },
          { testCase: 'テストケース2', expectedValue: '期待値2', excluded: false },
          { testCase: 'テストケース3', expectedValue: '期待値3', excluded: true }
        ]} />
      </div>
      <div className="flex justify-center space-x-4">
        <Button type="submit" >更新</Button>
        <Button type="button" className="bg-gray-500 hover:bg-gray-400" onClick={handleCancel}>戻る</Button>
      </div>
    </div>
  );
}