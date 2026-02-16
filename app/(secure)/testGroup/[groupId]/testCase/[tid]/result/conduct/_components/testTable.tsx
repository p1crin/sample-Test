import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import { Column, DataGrid, SortConfig } from '@/components/datagrid/DataGrid';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import clientLogger from '@/utils/client-logger';
import { formatDateWithHyphen } from '@/utils/date-formatter';
import { FileInfo, getUniqueFileNames, processClipboardItems, processFileList, isImage } from '@/utils/fileUtils';
import React, { useCallback, useEffect, useRef, useState } from 'react';


interface TestTableProps {
  groupId: number;
  tid: string;
  data: TestCaseResultRow[];
  setData: React.Dispatch<React.SetStateAction<TestCaseResultRow[]>>;
  userName?: string;
  executorsList?: Array<{ id: number; name: string; }>;
  executorsPerRow?: Record<string, Array<{ id: number; name: string }>>;
}

// 行が編集不可かどうかを判定するヘルパー関数
const isRowDisabled = (row: TestCaseResultRow): boolean => {
  return row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.is_target === false;
};

const TestTable: React.FC<TestTableProps> = ({ groupId, tid, data, setData, userName = '', executorsList = [], executorsPerRow = {} as Record<string, Array<{ id: number; name: string }>> }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentColumn, setCurrentColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<TestCaseResultRow>>(null);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [allChecked, setAllChecked] = useState(true);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
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

  // エビデンスファイルをS3にアップロード
  const uploadEvidenceFile = useCallback(async (file: FileInfo, rowIndex: number): Promise<FileInfo> => {
    try {
      const row = data[rowIndex];
      const historyCount = row.historyCount ?? 0;

      const formData = new FormData();

      // Base64からBlobを作成してFormDataに追加
      if (!file.base64) {
        throw new Error(`ファイルデータが不正です: ${file.name} (base64データがありません)`);
      }

      // file.typeが空の場合はデフォルトのMIMEタイプを使用
      const fileType = file.type || 'application/octet-stream';

      const byteString = atob(file.base64);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([uint8Array], { type: fileType });
      const fileObject = new File([blob], file.name, { type: fileType });
      formData.append('file', fileObject);

      formData.append('testGroupId', String(groupId));
      formData.append('tid', tid);
      formData.append('testCaseNo', String(row.test_case_no));
      formData.append('historyCount', String(historyCount));

      // FormDataの場合はfetchを直接使用（Content-Typeは自動設定される）
      const fetchResponse = await fetch('/api/files/evidences', {
        method: 'POST',
        body: formData,
      });

      if (!fetchResponse.ok) {
        const responseText = await fetchResponse.text();
        throw new Error(`エビデンスのアップロードに失敗しました (status: ${fetchResponse.status}, response: ${responseText})`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await fetchResponse.json() as any;

      if (response.success) {
        clientLogger.info('TestTable', 'エビデンスアップロード成功', {
          fileNo: response.data.fileNo,
          evidencePath: response.data.evidencePath,
          fileName: file.name,
          fileType: file.type
        });

        // アップロード成功時、pathとfileNoを含むFileInfoを返す
        return {
          ...file,
          path: response.data.evidencePath,
          fileNo: response.data.fileNo,
        };
      } else {
        throw new Error(`エビデンスのアップロードに失敗しました: ${response.error || 'unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      clientLogger.error('TestTable', 'エビデンスアップロード失敗', {
        error: errorMessage,
        fileName: file.name,
        fileType: file.type,
        hasBase64: !!file.base64
      });
      throw error;
    }
  }, [groupId, tid, data]);

  // ペーストイベントハンドラー
  const handlePaste = useCallback(async (pasteEvent: React.ClipboardEvent, rowIndex: number) => {
    const items = pasteEvent.clipboardData.items;
    if (items.length === 0 || items[0].kind !== 'file') return;

    const newFiles = await processClipboardItems(items);

    // 各ファイルを順次アップロード
    let processedFiles = newFiles;
    if (newFiles.length > 0) {
      updateRowData(rowIndex, 'uploading', true);
      try {
        processedFiles = [];
        for (const file of newFiles) {
          const uploadedFile = await uploadEvidenceFile(file, rowIndex);
          processedFiles.push(uploadedFile);
        }
      } catch (error) {
        clientLogger.error('TestTable', 'ペーストしたファイルのアップロードに失敗しました', { error });
        return;
      } finally {
        updateRowData(rowIndex, 'uploading', false);
      }
    }

    setData(prevData => {
      const newData = [...prevData];
      const existingFiles = newData[rowIndex].evidence || [];
      const uniqueFiles = getUniqueFileNames([...existingFiles, ...processedFiles]);
      newData[rowIndex] = { ...newData[rowIndex], evidence: uniqueFiles };
      return newData;
    });
  }, [setData, uploadEvidenceFile, updateRowData]);

  // ファイル選択ハンドラー
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = await processFileList(fileList);

    // 各ファイルを順次アップロード
    let processedFiles = newFiles;
    if (newFiles.length > 0) {
      updateRowData(rowIndex, 'uploading', true);
      try {
        processedFiles = [];
        for (const file of newFiles) {
          const uploadedFile = await uploadEvidenceFile(file, rowIndex);
          processedFiles.push(uploadedFile);
        }
      } catch (error) {
        clientLogger.error('TestTable', '選択したファイルのアップロードに失敗しました', { error });
        return;
      } finally {
        updateRowData(rowIndex, 'uploading', false);
      }
    }

    setData(prevData => {
      const newData = [...prevData];
      const existingFiles = newData[rowIndex].evidence || [];
      const uniqueFiles = getUniqueFileNames([...existingFiles, ...processedFiles]);
      newData[rowIndex] = { ...newData[rowIndex], evidence: uniqueFiles };
      return newData;
    });

    // inputをリセット
    if (fileInputRefs.current[rowIndex]) {
      fileInputRefs.current[rowIndex]!.value = '';
    }
  }, [setData, uploadEvidenceFile]);

  // ファイル削除ハンドラー（削除リストに追加のみ）
  const handleFileDelete = useCallback((fileIndex: number, rowIndex: number) => {
    setData(prevData => {
      const newData = [...prevData];
      const deletedFile = newData[rowIndex]?.evidence?.[fileIndex];

      if (newData[rowIndex]?.evidence) {
        // エビデンス配列から削除
        newData[rowIndex] = {
          ...newData[rowIndex],
          evidence: newData[rowIndex].evidence!.filter((_, index) => index !== fileIndex)
        };

        // fileNoがある場合は削除リストに追加（物理削除はsubmit時）
        // fileNoがない場合はアップロード前のローカルファイルなので削除不要
        if (deletedFile && deletedFile.fileNo !== undefined) {
          const deletedEvidences = newData[rowIndex].deletedEvidences || [];
          newData[rowIndex] = {
            ...newData[rowIndex],
            deletedEvidences: [...deletedEvidences, deletedFile]
          };
        }
      }

      return newData;
    });
  }, [setData]);

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
            value={formatDateWithHyphen(value) || ''}
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
        // executorsList（API由来）と該当行・履歴回数の過去実施者をマージして重複排除
        const key = `${row.test_case_no}_${row.historyCount ?? 0}`;
        const rowPastExecutors = executorsPerRow[key] || [];
        const mergedExecutors: Array<{ id: number; name: string }> = [...(executorsList as Array<{ id: number; name: string }>)];
        rowPastExecutors.forEach((pe: { id: number; name: string }) => {
          if (!mergedExecutors.some(e => e.name === pe.name)) {
            mergedExecutors.push(pe);
          }
        });
        return (
          <div className={`flex items-center ${isReadOnly ? 'bg-gray-200' : ''}`}>
            <select
              value={value || ''}
              onChange={(e) => updateRowData(rowIndex, 'executor', e.target.value)}
              className="flex-grow border border-gray-300 rounded p-1"
              disabled={isReadOnly}
            >
              <option value=""></option>
              {mergedExecutors.map((executor) => (
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
      render: (_value: FileInfo[] | null, row: TestCaseResultRow) => {
        const rowIndex = getRowIndex(row);
        const isReadOnly = isRowDisabled(row);

        return (
          <div>
            {/* ファイル選択エリア */}
            <div className='flex flex-col space-y-2'>
              <div className='flex space-x-2 items-center'>
                <textarea
                  value=''
                  placeholder={'エビデンスを選択/貼付'}
                  onPaste={(e) => !isReadOnly && handlePaste(e, rowIndex)}
                  className='flex-1 h-8 resize-none border border-gray-300 rounded px-2 py-1 text-sm'
                  readOnly
                  disabled={isReadOnly || row.uploading}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRefs.current[rowIndex]?.click()}
                  className="whitespace-nowrap h-8 text-sm px-3"
                  disabled={isReadOnly || row.uploading}
                >
                  {row.uploading ? 'アップロード中...' : 'ファイルを選択'}
                </Button>
                <input
                  type="file"
                  multiple
                  ref={(el) => { fileInputRefs.current[rowIndex] = el; }}
                  onChange={(e) => handleFileChange(e, rowIndex)}
                  style={{ display: 'none' }}
                  disabled={isReadOnly}
                />
              </div>

              {/* ファイルプレビューエリア */}
              {row.evidence && row.evidence.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {row.evidence.map((file, fileIndex) => {
                    return (
                      <div
                        key={`${rowIndex}-${fileIndex}`}
                        className="relative flex items-center justify-between border border-gray-300 p-2 rounded-sm bg-white"
                        style={{ minHeight: '40px', maxWidth: '300px' }}
                      >
                        {file.path && isImage(file.path) ? (
                          <img
                            src={file.path}
                            alt={file.name}
                            className="object-contain h-8 max-w-120"
                          />
                        ) : file.base64 && file.type?.startsWith('image/') ? (
                          <img
                            src={`data:${file.type};base64,${file.base64}`}
                            alt={file.name}
                            className="object-contain h-8 max-w-120"
                          />
                        ) : (
                          <span className="text-xs truncate max-w-120">{file.name}</span>
                        )}

                        <button
                          type="button"
                          onClick={() => !isReadOnly && handleFileDelete(fileIndex, rowIndex)}
                          className="ml-2 h-5 w-5 rounded border bg-white text-red-500 hover:bg-red-50 text-xs"
                          disabled={isReadOnly}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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