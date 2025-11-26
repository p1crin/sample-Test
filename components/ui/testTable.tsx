import React, { useState } from 'react';
import { Modal } from './modal';
import { DataGrid, Column, SortConfig } from '../datagrid/DataGrid';
import { Button } from './button';
import { TestCaseResultRow } from '@/app/(secure)/testGroup/[groupId]/testCase/[tid]/result/_components/types/testCase-result-list-row';
import { JUDGMENT_OPTIONS, JudgmentOption } from '@/constants/constants';

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
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const handleBulkInput = (column: string) => {
    setCurrentColumn(column);
    // TODO: ログインユーザIDをキーに氏名を取得する処理
    // const userId = getLoggedInUserId();
    // const userName = getUserNameById(userId);
    setInputValue('');
    setIsDialogOpen(true);
  };

  const handleBulkSubmit = () => {
    setData(data.map((row, index) => {
      if (row.judgment === JUDGMENT_OPTIONS.EXCLUDED || !selectedRows.has(index)) {
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

  const handleRowSelection = (index: number, isSelected: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (isSelected) {
      newSelectedRows.add(index);
    } else {
      newSelectedRows.delete(index);
    }
    setSelectedRows(newSelectedRows);
  };

  const columns: Column<TestCaseResultRow>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          onChange={(e) => {
            const isChecked = e.target.checked;
            const newSelectedRows = new Set<number>();
            if (isChecked) {
              data.forEach((_, index) => newSelectedRows.add(index));
            }
            setSelectedRows(newSelectedRows);
          }}
        />
      ),
      render: (_record: unknown, _index: unknown, index: number) => (
        <input
          type="checkbox"
          checked={selectedRows.has(index)}
          onChange={(e) => handleRowSelection(index, e.target.checked)}
        />
      ),
      width: "5%",
    },
    { key: 'testCase', header: 'テストケース' },
    { key: 'expectedValue', header: '期待値' },
    {
      key: 'result',
      header: '結果',
      width: "15%",
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].result = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 min-w-full"
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
      width: "15%",
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
      width: "10%",
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].softwareVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 min-w-full"
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
      width: "10%",
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].hardwareVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 min-w-full"
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
      width: "11%",
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].comparatorVersion = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 min-w-full"
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
          className="border border-gray-300 rounded p-1 min-w-full"
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
      width: "10%",
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
      width: "10%",
      render: (value: string, row: TestCaseResultRow) => (
        <div>
          <input
            type="file"
            multiple
            onChange={(e) => {
              const newData = [...data];
              newData[data.indexOf(row)].evidence = e.target.files ? e.target.files[0] : null;
              setData(newData);
            }}
            className="border border-gray-300 rounded p-1 min-w-full"
            disabled={row.judgment === JUDGMENT_OPTIONS.EXCLUDED}
          />
        </div>
      ),
    },
    {
      key: 'note',
      header: '備考欄',
      width: "5%",
      render: (value: string, row: TestCaseResultRow) => (
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const newData = [...data];
            newData[data.indexOf(row)].note = e.target.value;
            setData(newData);
          }}
          className="border border-gray-300 rounded p-1 min-w-full"
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
        <h2 className="mb-4">セットする値を選択してください</h2>
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