import React, { useRef, useState } from 'react';
import { TestCaseResultRow, EvidenceFile } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';
import { Column, DataGrid, SortConfig } from '@/components/datagrid/DataGrid';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import clientLogger from '@/utils/client-logger';

interface TestTableProps {
  data: TestCaseResultRow[];
  setData: React.Dispatch<React.SetStateAction<TestCaseResultRow[]>>;
  isPast: boolean;
  groupId: number;
  tid: string;
  onEvidenceDeleted?: (deletedEvidence: { testCaseNo: number; historyCount: number; evidenceNo: number }) => void;
  userRole?: string;
  userId?: number;
  userName?: string;
  executorsList?: Array<{ id: number; name: string; email: string }>;
}

const TestTable: React.FC<TestTableProps> = ({
  data,
  setData,
  isPast,
  groupId,
  tid,
  onEvidenceDeleted,
  userRole = '一般',
  userId = 0,
  userName = '',
  executorsList = [],
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentColumn, setCurrentColumn] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig<TestCaseResultRow>>(null);
  const [page, setPage] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
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

  const handleInsertSelf = (rowIndex: number) => {
    const newData = [...data];
    newData[rowIndex].executor = userName;
    setData(newData);
  };

  const uploadEvidenceFile = async (file: File, testCaseNo: number, historyCount: number): Promise<EvidenceFile | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('testGroupId', groupId.toString());
      formData.append('tid', tid);
      formData.append('testCaseNo', testCaseNo.toString());
      formData.append('historyCount', historyCount.toString());

      clientLogger.info('TestTable', 'Uploading evidence file', { fileName: file.name, testCaseNo });

      const response = await fetch('/api/evidences', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload evidence file');
      }

      const result = await response.json();
      clientLogger.info('TestTable', 'Evidence file uploaded successfully', { evidenceId: result.data.evidenceId });

      return {
        id: result.data.evidenceId ? result.data.evidenceId.toString() : generateUniqueId(),
        name: result.data.evidenceName,
        type: file.type,
        evidenceId: result.data.evidenceId || undefined,
        evidencePath: result.data.evidencePath,
        testCaseNo: testCaseNo,
        historyCount: historyCount,
        evidenceNo: result.data.evidenceNo,
      };
    } catch (error) {
      clientLogger.error('TestTable', 'Failed to upload evidence file', { error: error instanceof Error ? error.message : String(error) });
      alert('ファイルのアップロードに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
      return null;
    }
  };

  const handlePaste = async (pasteEvent: React.ClipboardEvent, rowIndex: number) => {
    const fileList = pasteEvent.clipboardData.items || [];
    if (fileList.length > 0 && fileList[0].kind !== 'file') return; // ファイル以外をペーストした場合は対象外

    const row = data[rowIndex];
    const testCaseNo = row.testCaseNo;
    const historyCount = row.historyCount || 0;

    // ファイルを抽出
    const files = await Promise.all(
      Array.from(fileList).map(async item => {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) {
          return file;
        }
        return null;
      })
    ).then(files => files.filter(Boolean) as File[]);

    if (files.length === 0) return;

    // 一時的にローカルファイルとして追加（アップロード中の表示用）
    const tempFiles: EvidenceFile[] = files.map(file => ({
      id: generateUniqueId(),
      name: file.name,
      type: file.type,
      file: file,
    }));

    const currentEvidence = row.evidence || [];
    const uniqueFiles = getUniqueFileNames([...currentEvidence, ...tempFiles]);
    const newData = [...data];
    newData[rowIndex].evidence = uniqueFiles;
    setData(newData);

    // バックグラウンドでファイルをアップロード
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempFile = tempFiles[i];

      setUploadingFiles(prev => new Set(prev).add(tempFile.id));

      const uploadedFile = await uploadEvidenceFile(file, testCaseNo, historyCount);

      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempFile.id);
        return newSet;
      });

      if (uploadedFile) {
        // アップロード成功：一時ファイルを実際のファイルに置き換え
        setData(prevData => {
          const updatedData = [...prevData];
          const currentRow = updatedData[rowIndex];
          if (currentRow.evidence) {
            const evidenceIndex = currentRow.evidence.findIndex(e => e.id === tempFile.id);
            if (evidenceIndex !== -1) {
              currentRow.evidence[evidenceIndex] = uploadedFile;
            }
          }
          return updatedData;
        });
      } else {
        // アップロード失敗：一時ファイルを削除
        setData(prevData => {
          const updatedData = [...prevData];
          const currentRow = updatedData[rowIndex];
          if (currentRow.evidence) {
            currentRow.evidence = currentRow.evidence.filter(e => e.id !== tempFile.id);
          }
          return updatedData;
        });
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, rowIndex: number) => {
    const fileList = e.target.files || [];
    if (fileList.length === 0) return;

    const row = data[rowIndex];
    const testCaseNo = row.testCaseNo;
    const historyCount = row.historyCount || 0;

    const files = Array.from(fileList);

    // 一時的にローカルファイルとして追加（アップロード中の表示用）
    const tempFiles: EvidenceFile[] = files.map(file => ({
      id: generateUniqueId(),
      name: file.name,
      type: file.type,
      file: file,
    }));

    const currentEvidence = row.evidence || [];
    const uniqueFiles = getUniqueFileNames([...currentEvidence, ...tempFiles]);
    const newData = [...data];
    newData[rowIndex].evidence = uniqueFiles;
    setData(newData);

    // ファイル入力をリセット
    if (fileInputRefs.current[rowIndex]) {
      fileInputRefs.current[rowIndex]!.value = '';
    }

    // バックグラウンドでファイルをアップロード
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempFile = tempFiles[i];

      setUploadingFiles(prev => new Set(prev).add(tempFile.id));

      const uploadedFile = await uploadEvidenceFile(file, testCaseNo, historyCount);

      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(tempFile.id);
        return newSet;
      });

      if (uploadedFile) {
        // アップロード成功：一時ファイルを実際のファイルに置き換え
        setData(prevData => {
          const updatedData = [...prevData];
          const currentRow = updatedData[rowIndex];
          if (currentRow.evidence) {
            const evidenceIndex = currentRow.evidence.findIndex(e => e.id === tempFile.id);
            if (evidenceIndex !== -1) {
              currentRow.evidence[evidenceIndex] = uploadedFile;
            }
          }
          return updatedData;
        });
      } else {
        // アップロード失敗：一時ファイルを削除
        setData(prevData => {
          const updatedData = [...prevData];
          const currentRow = updatedData[rowIndex];
          if (currentRow.evidence) {
            currentRow.evidence = currentRow.evidence.filter(e => e.id !== tempFile.id);
          }
          return updatedData;
        });
      }
    }
  };

  const getUniqueFileNames = (fileNames: EvidenceFile[]): EvidenceFile[] => {
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

  const handleFileDelete = async (fileId: string, rowIndex: number) => {
    const row = data[rowIndex];
    const evidence = row.evidence?.find(e => e.id === fileId);

    if (!evidence) return;

    // アップロード済みのファイルの場合、サーバー側のファイルも削除
    if (evidence.evidenceId && evidence.testCaseNo !== undefined && evidence.historyCount !== undefined && evidence.evidenceNo !== undefined) {
      try {
        clientLogger.info('TestTable', 'Deleting evidence file', { evidenceId: evidence.evidenceId });

        const response = await fetch('/api/evidences', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            testGroupId: groupId,
            tid: tid,
            testCaseNo: evidence.testCaseNo,
            historyCount: evidence.historyCount,
            evidenceNo: evidence.evidenceNo,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete evidence file');
        }

        clientLogger.info('TestTable', 'Evidence file deleted successfully', { evidenceId: evidence.evidenceId });

        // 削除されたエビデンスを親コンポーネントに通知
        if (onEvidenceDeleted) {
          onEvidenceDeleted({
            testCaseNo: evidence.testCaseNo,
            historyCount: evidence.historyCount,
            evidenceNo: evidence.evidenceNo,
          });
        }
      } catch (error) {
        clientLogger.error('TestTable', 'Failed to delete evidence file', { error: error instanceof Error ? error.message : String(error) });
        alert('ファイルの削除に失敗しました: ' + (error instanceof Error ? error.message : String(error)));
        return;
      }
    }

    // ローカルの状態から削除
    const newData = [...data];
    newData[rowIndex].evidence = newData[rowIndex].evidence?.filter(file => file.id !== fileId) || null;
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
      render: (value: string, row: TestCaseResultRow) => {
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].result = e.target.value;
              setData(newData);
            }}
            className={`border border-gray-300 rounded p-1 w-100 ${isReadOnly ? 'bg-gray-200' : ''}`}
            readOnly={isReadOnly}
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
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return isReadOnly ? (
          <input
            type="text"
            value={value}
            readOnly
            className="border border-gray-300 rounded p-1 min-w-full bg-gray-200"
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
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].softwareVersion = e.target.value;
              setData(newData);
            }}
            className={`border border-gray-300 rounded p-1 w-25 ${isReadOnly ? 'bg-gray-200' : ''}`}
            readOnly={isReadOnly}
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
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].hardwareVersion = e.target.value;
              setData(newData);
            }}
            className={`border border-gray-300 rounded p-1 w-25 ${isReadOnly ? 'bg-gray-200' : ''}`}
            readOnly={isReadOnly}
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
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].comparatorVersion = e.target.value;
              setData(newData);
            }}
            className={`border border-gray-300 rounded p-1 w-25 ${isReadOnly ? 'bg-gray-200' : ''}`}
            readOnly={isReadOnly}
          />
        );
      },
    },
    {
      key: 'executionDate',
      header: '実施日',
      render: (value: string, row: TestCaseResultRow) => {
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].executionDate = e.target.value;
              setData(newData);
            }}
            className={`border border-gray-300 rounded p-1 w-30 ${isReadOnly ? 'bg-gray-200' : ''}`}
            readOnly={isReadOnly}
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
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <div className={`flex items-center ${isReadOnly ? 'bg-gray-200' : ''}`}>
            <select
              value={value}
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
            <button onClick={() => handleInsertSelf(data.indexOf(row))} className="ml-2 p-1" disabled={isReadOnly} title="自分自身を設定">
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
      render: (value: string, row: TestCaseResultRow) => {
        const isReadOnly = row.judgment === JUDGMENT_OPTIONS.EXCLUDED || row.isTarget === false;
        return (
          <textarea
            value={value}
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].note = e.target.value;
              setData(newData);
            }}
            className={`border border-gray-300 rounded p-1 w-100 h-8 ${isReadOnly ? 'bg-gray-200' : ''}`}
            readOnly={isReadOnly}
          />
        );
      },
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