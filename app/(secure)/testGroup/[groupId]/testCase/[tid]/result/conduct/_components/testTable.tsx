import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import { Column, DataGrid, SortConfig } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { generateUniqueId } from '@/utils/fileUtils';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface TestTableProps {
  groupId: number;
  tid: string,
  data: TestCaseResultRow[];
  setData: React.Dispatch<React.SetStateAction<TestCaseResultRow[]>>;
  userName?: string;
  executorsList?: Array<{ id: number; name: string; }>;
}

// 行が編集不可かどうかを判定するヘルパー関数
const isRowDisabled = (row: TestCaseResultRow): boolean => {
  return row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false;
};

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
        checked: !isRowDisabled(row) ? true : false,
      }));
      setData(updatedData);
      setIsInitialRender(false);
    }
  }, [data, isInitialRender, setData]);

  // 行のインデックスを取得するメモ化された関数（パフォーマンス最適化）
  const getRowIndex = useCallback((row: TestCaseResultRow): number => {
    // test_case_noが一意であることを前提に、それを使ってインデックスを取得
    return data.findIndex(r => r.test_case_no === row.test_case_no);
  }, [data]);

  const handleBulkInput = (column: string) => {
    setCurrentColumn(column);
    setInputValue('');
    setIsDialogOpen(true);
  };

  const handleBulkSubmit = () => {
    const newData = data.map((row) => {
      if (!row.checked || isRowDisabled(row)) {
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

  // 行のデータを更新する汎用ハンドラー（メモ化）
  const updateRowData = useCallback((rowIndex: number, field: keyof TestCaseResultRow, value: any) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[rowIndex] = { ...newData[rowIndex], [field]: value };
      return newData;
    });
  }, [setData]);

  const handleInsertSelf = useCallback((rowIndex: number) => {
    updateRowData(rowIndex, 'executor', userName);
  }, [userName, updateRowData]);

  const handleSort = (key: keyof TestCaseResultRow) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handlePaste = useCallback(async (pasteEvent: React.ClipboardEvent, rowIndex: number) => {
    const fileList = pasteEvent.clipboardData.items || [];
    if (fileList.length > 0 && fileList[0].kind !== 'file') return; // ファイル以外をペーストした場合は対象外

    const newFiles = await Promise.all(Array.from(fileList).map(async item => {
      const file = item.getAsFile();
      if (file && file.type.startsWith('image/')) {
        return file.name;
      }
      return null;
    })).then(files => files.filter(Boolean) as string[]);

    setData(prevData => {
      const existingFiles = (prevData[rowIndex].evidence || []).map(file => file);
      const uniqueFiles = getUniqueFileNames([...existingFiles, ...newFiles]);
      const newData = [...prevData];
      newData[rowIndex] = { ...newData[rowIndex], evidence: uniqueFiles };
      return newData;
    });
  }, [setData]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const fileList = e.target.files || [];
    const newFiles = await Promise.all(Array.from(fileList).map(async file => {
      return file.name;
    }));

    setData(prevData => {
      const existingFiles = (prevData[rowIndex].evidence || []).map(file => file);
      const uniqueFiles = getUniqueFileNames([...existingFiles, ...newFiles]);
      const newData = [...prevData];
      newData[rowIndex] = { ...newData[rowIndex], evidence: uniqueFiles };
      return newData;
    });

    if (fileInputRefs.current[rowIndex]) {
      fileInputRefs.current[rowIndex]!.value = '';
    }
  }, [setData]);

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

  const handleFileDelete = useCallback((fileIndex: number, rowIndex: number) => {
    setData(prevData => {
      const newData = [...prevData];
      if (newData[rowIndex].evidence) {
        newData[rowIndex] = {
          ...newData[rowIndex],
          evidence: newData[rowIndex].evidence.filter((_, index) => index !== fileIndex)
        };
      }
      return newData;
    });
  }, [setData]);

  const truncateFileName = (name: string) => {
    return name.length > 30 ? name.slice(0, 30) + '...' : name;
  };

  const handleAllCheckboxChange = (checked: boolean) => {
    setAllChecked(checked);
    const newData = data.map(row => ({
      ...row,
      checked: !isRowDisabled(row) ? checked : false,
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
      render: (value: boolean, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <input
            type="checkbox"
            className='accent-[#FF5611]'
            checked={(!isRowDisabled(row) ? value : false) || false}
            onChange={(e) => {
              updateRowData(rowIndex, 'checked', !isRowDisabled(row) ? e.target.checked : false);
            }}
          />
        );
      },
    },
    { key: 'index', header: 'No' },
    { key: 'test_case', header: 'テストケース' },
    { key: 'expected_value', header: '期待値' },
    {
      key: 'result',
      header: '結果',
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateRowData(rowIndex, 'result', e.target.value)}
            className="border border-gray-300 rounded p-1 w-100"
            readOnly={isRowDisabled(row)}
          />
        );
      },
    },
    {
      key: 'judgment',
      header: (
        <div>
          判定
          <button onClick={() => handleBulkInput('judgment')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return isRowDisabled(row) ? (
          <input
            type="text"
            value={value || JUDGMENT_OPTIONS.EXCLUDED}
            readOnly
            className="border border-gray-300 rounded p-1 min-w-full"
          />
        ) : (
          <select
            value={value || JUDGMENT_OPTIONS.UNTOUCHED}
            onChange={(e) => updateRowData(rowIndex, 'judgment', e.target.value as JudgmentOption)}
            className="border border-gray-300 rounded p-1 min-w-full"
          >
            {Object.entries(JUDGMENT_OPTIONS)
              .filter(([_, value]) => value !== JUDGMENT_OPTIONS.EXCLUDED && value !== JUDGMENT_OPTIONS.EMPTY)
              .map(([key, value]) => (
                <option key={key} value={value}>{value}</option>
              ))}
          </select>
        );
      },
    },
    {
      key: 'softwareVersion',
      header: (
        <div>
          ソフトVer.
          <button onClick={() => handleBulkInput('softwareVersion')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateRowData(rowIndex, 'softwareVersion', e.target.value)}
            className="border border-gray-300 rounded p-1 w-25"
            readOnly={isRowDisabled(row)}
          />
        );
      },
    },
    {
      key: 'hardwareVersion',
      header: (
        <div>
          ハードVer.
          <button onClick={() => handleBulkInput('hardwareVersion')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateRowData(rowIndex, 'hardwareVersion', e.target.value)}
            className="border border-gray-300 rounded p-1 w-25"
            readOnly={isRowDisabled(row)}
          />
        );
      },
    },
    {
      key: 'comparatorVersion',
      header: (
        <div>
          コンパラVer.
          <button onClick={() => handleBulkInput('comparatorVersion')} className="ml-2 text-blue-500 float-right">∨</button>
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateRowData(rowIndex, 'comparatorVersion', e.target.value)}
            className="border border-gray-300 rounded p-1 w-25"
            readOnly={isRowDisabled(row)}
          />
        );
      },
    },
    {
      key: 'executionDate',
      header: '実施日',
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => updateRowData(rowIndex, 'executionDate', e.target.value)}
            className="border border-gray-300 rounded p-1 w-30"
            readOnly={isRowDisabled(row)}
          />
        );
      },
    },
    {
      key: 'executor',
      header: (
        <div>
          実施者
        </div>
      ),
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        const isReadOnly = isRowDisabled(row);
        return (
          <div className={`flex items-center ${isReadOnly ? 'bg-gray-200' : ''}`}>
            <select
              value={value || ''}
              onChange={(e) => updateRowData(rowIndex, 'executor', e.target.value)}
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
            <button onClick={() => handleInsertSelf(rowIndex)} className="ml-2 p-1" disabled={isReadOnly}>
              👤
            </button>
          </div>
        );
      },
    },
    {
      key: 'evidence',
      header: 'エビデンス',
      render: (_value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <div>
            <div className='flex flex-cols space-x-2 h-8'>
              <textarea
                id='content'
                name='content'
                value=''
                placeholder={'ファイルを選択またはキャプチャーを貼り付けてください。'}
                onPaste={(e) => handlePaste(e, rowIndex)}
                className={'flex w-89 resize-none border border-gray-300 rounded px-2 py-1'}
                readOnly />
              <div className='flex justify-center'>
                <Button
                  type="button"
                  onClick={() => fileInputRefs.current[rowIndex]?.click()}
                  className="whitespace-nowrap"
                >
                  ファイルを選択
                </Button>
                <input
                  type="file"
                  multiple
                  ref={(el) => { fileInputRefs.current[rowIndex] = el; }}
                  onChange={(e) => handleFileChange(e, rowIndex)}
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
                      onClick={() => handleFileDelete(fileIndex, rowIndex)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      },
    },
    {
      key: 'note',
      header: '備考欄',
      render: (value: string, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        return (
          <textarea
            value={value || ''}
            onChange={(e) => updateRowData(rowIndex, 'note', e.target.value)}
            className="border border-gray-300 rounded p-1 w-100 h-8"
            readOnly={isRowDisabled(row)}
          />
        );
      },
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
                .filter(([_, value]) => value !== JUDGMENT_OPTIONS.EXCLUDED && value !== JUDGMENT_OPTIONS.EMPTY)
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