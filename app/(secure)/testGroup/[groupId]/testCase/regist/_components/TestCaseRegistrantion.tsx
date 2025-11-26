'use client';
import React from 'react';
import { VerticalForm } from '@/components/ui/verticalForm';
import TestCaseForm from '@/components/ui/testCaseForm';
import { Button } from '@/components/ui/button';

const resist: React.FC = () => {
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

  const handleRegister = () => {
    // 登録処理をここに記述
    console.log('テストケース登録');
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  };

  return (
    <>
      <div>
        <h1 className="text-lg font-bold">テスト情報</h1>
        <div>
          <VerticalForm fields={fields} />
        </div>
        <div className="my-10"></div>
        <h1 className="text-lg font-bold">テスト内容</h1>
        <div className="flex justify-center item-center">
          <TestCaseForm />
        </div>
        <div className="flex justify-center space-x-4">
          <Button type="submit" >登録</Button>
          <Button type="button" onClick={handleCancel} className="bg-gray-500 hover:bg-gray-400">戻る</Button>
        </div>
      </div>
    </>
  );
};

export default resist;