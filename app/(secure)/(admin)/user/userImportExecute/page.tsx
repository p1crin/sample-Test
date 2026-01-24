'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { VerticalForm } from '@/components/ui/verticalForm';
import Papa from 'papaparse';
import ButtonGroup from '@/components/ui/buttonGroup';

interface CsvData {
  [key: string]: string;
}

export default function ImportExecute() {
  const router = useRouter();
  const label = "ユーザファイル（csv形式）";
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | { target: { name: string; value: string | string[]; }; }) => {
    if ('files' in e.target) {
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
    } else {
      console.log("Unexpected event target");
    }
  }
  const fields = [
    {
      label: label,
      type: 'file',
      name: 'file',
      value: '',
      onChange: handleFileChange,
      placeholder: '',
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
      <h1 className="text-2xl font-bold mt-4 pb-3">ユーザインポート実施</h1>
      <div className='flex mt-4 pb-3 flex-col justify-start'>
        <VerticalForm fields={fields} />
        <ButtonGroup buttons={buttons} />
      </div>
    </>
  );
}