'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { VerticalForm } from '@/components/ui/verticalForm';
import TestGroupInfoTableModal from '../../../../_components/testGroupInfoTableModal';
import Papa from 'papaparse';
import ButtonGroup from '@/components/ui/buttonGroup';

interface CsvData {
  [key: string]: string;
}

export default function ImportExecute() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get('type');
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
      label: "テストファイル（zip形式）",
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
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">{"テストインポート実施"}</h1>
        <TestGroupInfoTableModal />
      </div>
      <div className='flex mt-4 pb-3 flex-col justify-start'>
        <VerticalForm fields={fields} />
        <ButtonGroup buttons={buttons} />
      </div>
    </>
  );
}