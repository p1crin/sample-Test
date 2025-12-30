import React, { useRef, useState } from 'react';
import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import { Column, DataGrid, SortConfig } from '@/components/datagrid/DataGrid';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

interface TestTableProps {
  data: TestCaseResultRow[];
  setData: React.Dispatch<React.SetStateAction<TestCaseResultRow[]>>;
  isPast: boolean;
}

const TestTable: React.FC<TestTableProps> = ({ data, setData, isPast }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentColumn, setCurrentColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<TestCaseResultRow>>(null);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleBulkInput = (column: string) => {
    setCurrentColumn(column);
    setInputValue('');
    setIsDialogOpen(true);
  };

  const handleBulkSubmit = () => {
    setData(data.map((row) => {
      if (row.judgment === JUDGMENT_OPTIONS.EXCLUDED) {
        return row;
      }
      return {
        ...row,
        [currentColumn!]: inputValue,
      };
    }));
    setIsDialogOpen(false);
  };

  const handleSort = (key: keyof TestCaseResultRow) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleInsertExecutor = (rowIndex: number) => {
    const userName = 'テスト 1郎'; // ダミーの氏名
    const newData = [...data];
    newData[rowIndex].executor = userName;
    setData(newData);
  };

  const handlePaste = async (pasteEvent: React.ClipboardEvent, rowIndex: number) => {
    const fileList = pasteEvent.clipboardData.items || [];
    if (fileList.length > 0 && fileList[0].kind !== 'file') return; // ファイル以外をペーストした場合は対象外

    const newFiles = await Promise.all(Array.from(fileList).map(async item => {
      const file = item.getAsFile();
      if (file && file.type.startsWith('image/')) {
        return { name: file.name, id: generateUniqueId(), type: file.type };
      }
      return null;
    })).then(files => files.filter(Boolean) as { name: string, id: string, type?: string }[]);

    const uniqueFiles = getUniqueFileNames([...(data[rowIndex].evidence || []), ...newFiles]);
    const newData = [...data];
    newData[rowIndex].evidence = uniqueFiles;
    setData(newData);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const fileList = e.target.files || [];
    const newFiles = await Promise.all(Array.from(fileList).map(async file => {
      return { name: file.name, id: generateUniqueId(), type: file.type };
    }));

    const uniqueFiles = getUniqueFileNames([...(data[rowIndex].evidence || []), ...newFiles]);
    const newData = [...data];
    newData[rowIndex].evidence = uniqueFiles;
    setData(newData);

    if (fileInputRefs.current[rowIndex]) {
      fileInputRefs.current[rowIndex]!.value = '';
    }
  };

  const getUniqueFileNames = (fileNames: { name: string, id: string, type?: string }[]) => {
    const nameCount: { [key: string]: number } = {};
    return fileNames.map(file => {
      const baseName = file.name.replace(/(\(\d+\))?(\.[^.]+)?$/, '');
      const extension = file.name.match(/(\.[^.]+)$/)?.[0] || '';
      const fullName = `${baseName}${extension}`;
      if (nameCount[fullName] === undefined) {
        nameCount[fullName] = 0;
      } else {
        nameCount[fullName]++;
      }
      return nameCount[fullName] === 0 ? file : { ...file, name: `${baseName}(${nameCount[fullName]})${extension}` };
    });
  };

  const generateUniqueId = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
  };

  const handleFileDelete = (fileId: string, rowIndex: number) => {
    const newData = [...data];
    newData[rowIndex].evidence = newData[rowIndex].evidence.filter(file => file.id !== fileId);
    setData(newData);
  };

  const truncateFileName = (name: string) => {
    return name.length > 30 ? name.slice(0, 30) + '...' : name;
  };

  const columns: Column<TestCaseResultRow>[] = [
    { key: 'testCase', header: 'テストケース' },
    { key: 'expectedValue', header: '期待値' },
    {
      key: 'result',
      header: '結果',
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].result = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-100"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
        />
      ),
    },
    {
      key: 'judgment',
      header: (
        <div>
          判定
          <button onClick={() => handleBulkInput('judgment')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => (
        row.judgment === JUDGMENT_OPTIONS.EXCLUDED ? (
          <input
            type="text"
            value={value}
            readOnly
            className="border border-gray-300 rounded p-1 min-w-full"
          />
        ) : (
          <select
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].judgment = e.target.value as JudgmentOption;
              setData(newData);
            }}
            className="border border-gray-300 rounded p-1 min-w-full"
          >
            {Object.entries(JUDGMENT_OPTIONS)
              .filter(([key, value]) => value !== JUDGMENT_OPTIONS.EXCLUDED && value !== JUDGMENT_OPTIONS.EMPTY)
              .map(([key, value]) => (
                <option key={key} value={value}>{value}</option>
              ))}
          </select>
        )
      ),
    },
    {
      key: 'softwareVersion',
      header: (
        <div>
          ソフトVer.
          <button onClick={() => handleBulkInput('softwareVersion')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].softwareVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-25"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
        />
      ),
    },
    {
      key: 'hardwareVersion',
      header: (
        <div>
          ハードVer.
          <button onClick={() => handleBulkInput('hardwareVersion')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].hardwareVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-25"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
        />
      ),
    },
    {
      key: 'comparatorVersion',
      header: (
        <div>
          コンパラVer.
          <button onClick={() => handleBulkInput('comparatorVersion')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].comparatorVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-25"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
        />
      ),
    },
    {
      key: 'executionDate',
      header: '実施日',
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="date"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].executionDate = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-30"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
        />
      ),
    },
    isPast && {
      key: 'executor',
      header: (
        <div>
          実施者
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => (
        <div className="flex items-center border border-gray-300 rounded p-1">
          <select
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].executor = e.target.value;
              setData(newData);
            }}
            className="flex-grow p-1"
            disabled={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
          >
            <option value=""></option>
            <option value="テスト 太郎">テスト 太郎</option>
            <option value="テスト 1郎">テスト 1郎</option>
          </select>
          <button onClick={() => handleInsertExecutor(data.indexOf(row))} className="ml-2 p-1" disabled={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}>
            👤
          </button>
        </div>
      ),
    },
    {
      key: 'evidence',
      header: 'エビデンス',
      render: (value: string, row: TestCaseResultRow) => (
        <div>
          <div className='flex flex-cols space-x-2 h-8'>
            <textarea
              id='content'
              name='content'
              value=''
              placeholder={'ファイルを選択またはキャプチャーを貼り付けてください。'}
              onPaste={(e) => handlePaste(e, data.indexOf(row))}
              className={'flex w-89 resize-none border border-gray-300 rounded px-2 py-1'}
              readOnly />
            <div className='flex justify-center'>
              <Button
                type="button"
                onClick={() => fileInputRefs.current[data.indexOf(row)]?.click()}
                className="whitespace-nowrap"
              >
                ファイルを選択
              </Button>
              <input
                type="file"
                multiple
                ref={(el) => { fileInputRefs.current[data.indexOf(row)] = el; }}
                onChange={(e) => handleFileChange(e, data.indexOf(row))}
                style={{ display: 'none' }} />
            </div>
          </div>
          <div className="flex flex-wrap w-90">
            {row.evidence?.map(file => (
              <div key={file.id} className="relative flex items-center justify-between border border-gray-300 p-1 m-1 rounded-sm">
                <span>{truncateFileName(file.name)}</span>
                <button
                  className="top-2 h-6 w-6 rounded-lg border bg-white text-red-500"
                  onClick={() => handleFileDelete(file.id, data.indexOf(row))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'note',
      header: '備考欄',
      render: (value: string, row: TestCaseResultRow) => (
        <textarea
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].note = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-100 h-8"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
        />
      ),
    },
  ].filter(Boolean) as Column<TestCaseResultRow>[];

  return (
    <div>
      <DataGrid
        items={data}
        columns={columns}
        sortConfig={sortConfig}
        page={page}
        pageCount={-1}
        onSort={handleSort}
        onPageChange={setPage}
      />
      <Modal open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <h2 className="mb-4">セットする値を入力してください</h2>
        {currentColumn === 'judgment' ? (
          <select
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border border-gray-300 rounded p-2 mb-4 w-full"
          >
            {Object.entries(JUDGMENT_OPTIONS)
              .filter(([key, value]) => value !== JUDGMENT_OPTIONS.EXCLUDED && value !== JUDGMENT_OPTIONS.EMPTY)
              .map(([key, value]) => (
                <option key={key} value={value}>{value}</option>
              ))}
          </select>
        ) : (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border border-gray-300 rounded p-2 mb-4 w-full"
          />
        )}
        <div className="flex justify-center space-x-4">
          <Button onClick={handleBulkSubmit}>一括入力</Button>
          <Button onClick={() => {
            setIsDialogOpen(false);
            setInputValue('');
          }} className="bg-gray-500 hover:bg-gray-400">閉じる</Button>
        </div>
      </Modal>
    </div>
  );
};

export default TestTable;