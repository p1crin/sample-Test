import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import { Column, DataGrid, SortConfig } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { FileInfo, generateUniqueId } from '@/utils/fileUtils';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import React, { useEffect, useRef, useState } from 'react';

interface TestTableProps {
  groupId: number;
  tid: string,
  data: TestCaseResultRow[];
  setData: React.Dispatch<React.SetStateAction<TestCaseResultRow[]>>;
  userName?: string;
  executorsList?: Array<{ id: number; name: string; }>;
}

const TestTable: React.FC<TestTableProps> = ({ data, setData, userName = '', executorsList = [] }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentColumn, setCurrentColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<TestCaseResultRow>>(null);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [allChecked, setAllChecked] = useState(true);
  const [isInitialRender, setIsInitialRender] = useState(true);
  useEffect(() => {
    if (isInitialRender && data) {
      const updatedData = data.map((row, index) => ({
        index: index + 1,
        ...row,
        checked: row.judgment !== JUDGMENT_OPTIONS.EXCLUDED || row.is_target ? true : false,
      }));
      setData(updatedData);
      setIsInitialRender(false);
    }
  }, [data, isInitialRender, setData]);

  const handleBulkInput = (column: string) => {
    setCurrentColumn(column);
    setInputValue('');
    setIsDialogOpen(true);
  };

  const handleBulkSubmit = () => {
    const newData = data.map((row) => {
      if (!row.checked || row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false) {
        return row;
      }
      return {
        ...row,
        [currentColumn!]: inputValue,
      };
    });

    setData(newData);
    setIsDialogOpen(false);
    setIsInitialRender(false);
  };

  const handleInsertSelf = (rowIndex: number) => {
    const newData = [...data];
    newData[rowIndex].executor = userName;
    setData(newData);
  };

  const handleSort = (key: keyof TestCaseResultRow) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handlePaste = async (pasteEvent: React.ClipboardEvent, rowIndex: number) => {
    const fileList = pasteEvent.clipboardData.items || [];
    if (fileList.length > 0 && fileList[0].kind !== 'file') return; // ファイル以外をペーストした場合は対象外

    const newFiles = await Promise.all(Array.from(fileList).map(async item => {
      const file = item.getAsFile();
      if (file && file.type.startsWith('image/')) {
        return file.name;
      }
      return null;
    })).then(files => files.filter(Boolean) as string[]);

    const existingFiles = (data[rowIndex].evidence || []).map(file => {
      return file;
    });

    const uniqueFiles = getUniqueFileNames([...existingFiles, ...newFiles]);
    const newData = [...data];
    newData[rowIndex].evidence = uniqueFiles;
    setData(newData);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const fileList = e.target.files || [];
    const newFiles = await Promise.all(Array.from(fileList).map(async file => {
      return file.name;
    }));

    const existingFiles = (data[rowIndex].evidence || []).map(file => {
      return file;
    });

    const uniqueFiles = getUniqueFileNames([...existingFiles, ...newFiles]);
    const newData = [...data];
    newData[rowIndex].evidence = uniqueFiles;
    setData(newData);

    if (fileInputRefs.current[rowIndex]) {
      fileInputRefs.current[rowIndex]!.value = '';
    }
  };

  const getUniqueFileNames = (fileNames: string[]) => {
    const nameCount: { [key: string]: number } = {};
    return fileNames.map(file => {
      const baseName = file.replace(/(\(\d+\))?(\.[^.]+)?$/, '');
      const extension = file.match(/(\.[^.]+)$/)?.[0] || '';
      const fullName = `${baseName}${extension}`;
      if (nameCount[fullName] === undefined) {
        nameCount[fullName] = 0;
      } else {
        nameCount[fullName]++;
      }
      return nameCount[fullName] === 0 ? file : `${baseName}(${nameCount[fullName]})${extension}`;
    });
  };

  const convertStringToEvidenceObject = (evidenceString: string) => {
    return { name: evidenceString, id: generateUniqueId() };
  };

  const handleFileDelete = (fileIndex: number, rowIndex: number) => {
    const newData = [...data];
    if (newData[rowIndex].evidence) {
      newData[rowIndex].evidence = newData[rowIndex].evidence.filter((_, index) => index !== fileIndex);
    }
    setData(newData);
  };

  const truncateFileName = (name: string) => {
    return name.length > 30 ? name.slice(0, 30) + '...' : name;
  };

  const handleAllCheckboxChange = (checked: boolean) => {
    setAllChecked(checked);
    const newData = data.map(row => ({
      ...row,
      checked: row.judgment !== JUDGMENT_OPTIONS.EXCLUDED || row.is_target ? checked : false,
    }));
    setData(newData);
  };

  const columns: Column<TestCaseResultRow>[] = [
    {
      key: 'checked',
      header: (
        <div className='flex space-x-2'>
          <input
            type="checkbox"
            checked={allChecked}
            className='accent-[#FF5611]'
            onChange={(e) => handleAllCheckboxChange(e.target.checked)}
          />
          <p>
            全選択/全解除
          </p>
        </div>
      ),
      render: (value: boolean, row: TestCaseResultRow) => (
        <input
          type="checkbox"
          className='accent-[#FF5611]'
          checked={(row.judgment !== JUDGMENT_OPTIONS.EXCLUDED && row.is_target !== false ? value : false) || false}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].checked = row.judgment !== JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false ? e.target.checked : false;
            setData(newData);
          }}
        />
      ),
    },
    { key: 'index', header: 'No' },
    { key: 'test_case', header: 'テストケース' },
    { key: 'expected_value', header: '期待値' },
    {
      key: 'result',
      header: '結果',
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].result = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-100"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false}
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
        row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false ? (
          <input
            type="text"
            value={value || JUDGMENT_OPTIONS.EXCLUDED}
            readOnly
            className="border border-gray-300 rounded p-1 min-w-full"
          />
        ) : (
          <select
            value={value || JUDGMENT_OPTIONS.UNTOUCHED}
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
          value={value || ''}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].softwareVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-25"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false}
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
          value={value || ''}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].hardwareVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-25"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false}
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
          value={value || ''}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].comparatorVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-25"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false}
        />
      ),
    },
    {
      key: 'executionDate',
      header: '実施日',
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="date"
          value={value || ''}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].executionDate = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-30"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false}
        />
      ),
    },
    {
      key: 'executor',
      header: (
        <div>
          実施者
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => {
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false
        return (
          <div className={`flex items-center ${isReadOnly ? 'bg-gray-200' : ''}`}>
            <select
              value={value || ''}
              onChange={(e) => {
                const newData = [...data];
                newData[data.indexOf(row)].executor = e.target.value;
                setData(newData);
              }}
              className="flex-grow border border-gray-300 rounded p-1"
              disabled={isReadOnly}
            >
              <option value=""></option>
              {executorsList.map((executor) => (
                <option key={executor.id} value={executor.name}>
                  {executor.name}
                </option>
              ))}
            </select>
            <button onClick={() => handleInsertSelf(data.indexOf(row))} className="ml-2 p-1" disabled={isReadOnly}>
              👤
            </button>
          </div>
        );
      },
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
            {row.evidence?.map((file, fileIndex) => {
              const fileObject = typeof file === 'string' ? convertStringToEvidenceObject(file) : file;
              return (
                <div key={fileObject.id} className="relative flex items-center justify-between border border-gray-300 p-1 m-1 rounded-sm">
                  <span>{truncateFileName(fileObject.name.split('/').pop() || '')}</span>
                  <button
                    className="top-2 h-6 w-6 rounded-lg border bg-white text-red-500"
                    onClick={() => handleFileDelete(fileIndex, data.indexOf(row))}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'note',
      header: '備考欄',
      render: (value: string, row: TestCaseResultRow) => (
        <textarea
          value={value || ''}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].note = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 w-100 h-8"
          readOnly={row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false}
        />
      ),
    },
  ].filter(Boolean) as Column<TestCaseResultRow>[];

  return (
    <>
      <div>
        <DataGrid
          items={data}
          columns={columns}
          sortConfig={sortConfig}
          page={page}
          pageCount={-1}
          onSort={handleSort}
          onPageChange={setPage} />
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
              className="border border-gray-300 rounded p-2 mb-4 w-full" />
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
    </>
  );
};

export default TestTable;