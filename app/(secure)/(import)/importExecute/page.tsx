'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { VerticalForm } from '@/components/ui/verticalForm';
import TestGroupInfoTableModal from '../../_components/testGroupInfoTableModal';
import Papa from 'papaparse';
import ButtonGroup from '@/components/ui/buttonGroup';

interface CsvData {
  [key: string]: string;
}

export default function ImportExecute() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get('type');
  const title = type === "test" ? "テストインポート実施" : "ユーザインポート実施";
  const label = type === "test" ? "テストファイル（zip形式）" : "ユーザファイル（csv形式）";
  const [csvContent, setCsvContent] = useState<CsvData[]>([]);

  const handleCancel = () => {
    console.log('キャンセルされました');
    history.back();
  }

  const handleSubmit = () => {
    console.log('インポートされました');
    if (csvContent.length > 0) {
      // インポート処理を実行
      router.push('/importResult');
    } else {
      console.log('CSVファイルの内容が読み込まれていません');
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[] } }) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvContent(results.data as CsvData[]);
        },
        encoding: 'shift-jis'
      });
      console.log(file || "ファイルが選択されていません");
    }
  }

  const fields = [
    {
      label: label,
      type: 'file',
      name: 'file',
      value: '',
      onChange: handleFileChange,
      placeholder: ''
    },
  ]

  const buttons = [
    {
      label: 'インポート',
      onClick: handleSubmit
    },
    {
      label: '戻る',
      onClick: handleCancel,
      isCancel: true
    }
  ];

  return (
    <>
      {type === "test" ? (
        <div className="flex items-center mt-4 pb-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          <TestGroupInfoTableModal />
        </div>
      ) : (
        <h1 className="text-2xl font-bold mt-4 pb-3">{title}</h1>
      )}
      <div className='flex mt-4 pb-3 flex-col justify-start'>
        <VerticalForm fields={fields} />
        <ButtonGroup buttons={buttons} />
      </div>
    </>
  );
}