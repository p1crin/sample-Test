'use client';
import React, { useEffect, useState } from 'react';
import { VerticalForm } from '@/components/ui/verticalForm';
import ButtonGroup from '@/components/ui/buttonGroup';
import { getTagOptions } from '../action';
import { ROLE_OPTIONS } from '@/constants/constants';

const Resist: React.FC = () => {
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

  const fields = [
    {
      label: 'ID (メールアドレス)',
      type: 'text',
      name: 'email',
      value: '',
      onChange: () => { },
      placeholder: 'ID (メールアドレス)'
    },
    {
      label: '氏名',
      type: 'text',
      name: 'name',
      value: '',
      onChange: () => { },
      placeholder: '氏名'
    },
    {
      label: '部署',
      type: 'text',
      name: 'department',
      value: '',
      onChange: () => { },
      placeholder: '部署'
    },
    {
      label: '会社名',
      type: 'text',
      name: 'company',
      value: '',
      onChange: () => { },
      placeholder: '会社名'
    },
    {
      label: '権限',
      type: 'select',
      name: 'role',
      value: '',
      onChange: () => { },
      placeholder: '権限',
      options: Object.values(ROLE_OPTIONS).map(role => ({
        value: role,
        label: role
      }))
    },
    {
      label: 'パスワード',
      type: 'password',
      name: 'password',
      value: '',
      onChange: () => { },
      placeholder: 'パスワード'
    },
    {
      label: 'タグ',
      type: 'addableTag',
      name: 'tag',
      value: '',
      onChange: () => { },
      placeholder: 'タグ',
      options: tagOptions
    }
  ];

  const handleRegister = () => {
    // 登録処理をここに記述
    console.log('ユーザ登録');
  };

  const handleCancel = () => {
    console.log('キャンセルされました');
    window.location.href = "/user";
  };

  const buttons = [
    {
      label: '登録',
      onClick: handleRegister
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true
    }
  ];

  return (
    <div >
      <VerticalForm fields={fields} />
      <ButtonGroup buttons={buttons} />
    </div >
  );
};

export default Resist;