import React, { useState, useEffect, useRef } from 'react';
import { Button } from './button';
import { Modal } from './modal';

type TestCase = {
  id: number;
  testCase: string;
  expectedValue: string;
  excluded: boolean;
  selected: boolean;
};

type TestCaseFormProps = {
  value?: { testCase: string; expectedValue: string; excluded: boolean }[];
  onChange?: (testCases: { testCase: string; expectedValue: string; excluded: boolean }[]) => void;
  errors?: Record<string, string>;
};

const formFieldStyle = "flex h-10 w-2/3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const TestCaseForm: React.FC<TestCaseFormProps> = ({ value, onChange, errors = {} }) => {
  const initialTestCases = value || [];
  const [testCases, setTestCases] = useState<TestCase[]>(initialTestCases.map((testCase, index) => ({
    id: Date.now() + index,
    ...testCase,
    selected: true
  })));
  const [allChecked, setAllChecked] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(!!value);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkField, setBulkField] = useState<'testCase' | 'expectedValue' | 'excluded'>('testCase');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTestCases(initialTestCases.map((testCase, index) => ({
      id: Date.now() + index,
      ...testCase,
      selected: true
    })));
    if (value) {
      setIsFormVisible(true);
    }
  }, [value]);

  // 親コンポーネントに変更を通知するヘルパー関数
  const notifyParent = (newTestCases: TestCase[]) => {
    if (onChange && isFormVisible) {
      const dataToReturn = newTestCases.map(tc => ({
        testCase: tc.testCase,
        expectedValue: tc.expectedValue,
        excluded: tc.excluded,
      }));
      onChange(dataToReturn);
    }
  };

  const handleAddRow = () => {
    const newTestCases = [
      ...testCases,
      { id: Date.now(), testCase: '', expectedValue: '', excluded: false, selected: true },
    ];
    setTestCases(newTestCases);
    notifyParent(newTestCases);
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleRemoveRow = (id: number) => {
    const newTestCases = testCases.filter((testCase) => testCase.id !== id);
    setTestCases(newTestCases);
    notifyParent(newTestCases);
  };

  const handleChange = (id: number, field: string, value: string | boolean) => {
    const newTestCases = testCases.map((testCase) =>
      testCase.id === id ? { ...testCase, [field]: value } : testCase
    );
    setTestCases(newTestCases);
    notifyParent(newTestCases);
  };

  const handleAllCheckedChange = (checked: boolean) => {
    setAllChecked(checked);
    const newTestCases = testCases.map(testCase => ({ ...testCase, selected: checked }));
    setTestCases(newTestCases);
    notifyParent(newTestCases);
  };

  const handleBulkInput = (field: 'testCase' | 'expectedValue' | 'excluded') => {
    setBulkField(field);
    setBulkValue(''); // モーダルを開く際にbulkValueをリセット
    setIsDialogOpen(true);
  };

  const handleBulkSubmit = () => {
    let newTestCases: TestCase[];
    if (bulkField === 'excluded') {
      const isExcluded = bulkValue === '対象外';
      newTestCases = testCases.map(testCase => testCase.selected ? { ...testCase, excluded: isExcluded } : testCase);
    } else {
      newTestCases = testCases.map(testCase => testCase.selected ? { ...testCase, [bulkField]: bulkValue } : testCase);
    }
    setTestCases(newTestCases);
    notifyParent(newTestCases);
    setIsDialogOpen(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(testCases);
  };

  const handleShowFormAndAddRow = () => {
    setIsFormVisible(true);
    handleAddRow();
  };

  return (
    <div className="flex flex-col items-center w-4/5">
      <div className="flex items-center mb-4 justify-center w-full">
        <label className="flex items-center w-1/12 mr-2">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => handleAllCheckedChange(e.target.checked)}
            className="accent-[#FF5611] mr-1"
            title="全選択/全解除"
          />
          <span>選択</span>
        </label>
        <span className="w-2/3 text-center mr-2">テストケース
          <button onClick={() => handleBulkInput('testCase')} className="ml-2 text-blue-500">
            ∨
          </button>
        </span>
        <span className="w-2/3 text-center">期待値
          <button onClick={() => handleBulkInput('expectedValue')} className="ml-2 text-blue-500">
            ∨
          </button>
        </span>
        <span className="w-1/12 text-center whitespace-nowrap">
          対象
          <button onClick={() => handleBulkInput('excluded')} className="ml-2 text-blue-500">
            ∨
          </button>
        </span>
        <span className="w-1/36 text-center"></span>
      </div>
      {isFormVisible && testCases.map((testCase, index) => {
        const testCaseError = errors[`testContents[${index}].testCase`];
        const expectedValueError = errors[`testContents[${index}].expectedValue`];

        return (
          <div key={testCase.id} className="w-full mb-6">
            <div className="flex items-start gap-2 w-full justify-center">
              <input
                type="checkbox"
                checked={testCase.selected}
                onChange={(e) => handleChange(testCase.id, 'selected', e.target.checked)}
                className="accent-[#FF5611] w-1/18 mt-2.5 flex-shrink-0"
              />
              <span className="w-1/18 text-center mt-2.5 flex-shrink-0">{index + 1}</span>
              <div className="flex flex-col flex-1">
                <input
                  type="text"
                  placeholder="テストケース"
                  value={testCase.testCase}
                  onChange={(e) => handleChange(testCase.id, 'testCase', e.target.value)}
                  className={`h-10 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${testCaseError ? 'border-red-500' : 'border-input'}`}
                />
                {testCaseError && (
                  <span className="text-red-500 text-sm mt-1">{testCaseError}</span>
                )}
              </div>
              <div className="flex flex-col flex-1">
                <input
                  type="text"
                  placeholder="期待値"
                  value={testCase.expectedValue}
                  onChange={(e) => handleChange(testCase.id, 'expectedValue', e.target.value)}
                  className={`h-10 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${expectedValueError ? 'border-red-500' : 'border-input'}`}
                />
                {expectedValueError && (
                  <span className="text-red-500 text-sm mt-1">{expectedValueError}</span>
                )}
              </div>
              <select
                value={testCase.excluded ? '対象外' : '対象'}
                onChange={(e) => handleChange(testCase.id, 'excluded', e.target.value === '対象外')}
                className="accent-[#FF5611] w-1/12 h-10 select-none rounded-lg border border-zinc-100 bg-white shadow-[0_-1px_0_0px_#d4d4d8_inset,0_0_0_1px_#f4f4f5_inset,0_0.5px_0_1.5px_#fff_inset] hover:bg-zinc-50 hover:via-zinc-900 hover:to-zinc-800 active:shadow-[-1px_0px_1px_0px_#e4e4e7_inset,1px_0px_1px_0px_#e4e4e7_inset,0px_0.125rem_1px_0px_#d4d4d8_inset] flex-shrink-0"
              >
                <option value="対象">対象</option>
                <option value="対象外">対象外</option>
              </select>
              <button
                type="button"
                onClick={() => handleRemoveRow(testCase.id)}
                className="group flex h-10 w-1/36 select-none items-center justify-center rounded-lg border border-zinc-100 bg-white leading-8 text-red-500 shadow-[0_-1px_0_0px_#d4d4d8_inset,0_0_0_1px_#f4f4f5_inset,0_0.5px_0_1.5px_#fff_inset] hover:bg-zinc-50 hover:via-zinc-900 hover:to-zinc-800 active:shadow-[-1px_0px_1px_0px_#e4e4e7_inset,1px_0px_1px_0px_#e4e4e7_inset,0px_0.125rem_1px_0px_#d4d4d8_inset] flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        onClick={handleShowFormAndAddRow}
        className="group flex h-10 w-10 select-none items-center justify-center rounded-lg border border-zinc-100 bg-white leading-8 text-green-500 shadow-[0_-1px_0_0px_#d4d4d8_inset,0_0_0_1px_#f4f4f5_inset,0_0.5px_0_1.5px_#fff_inset] hover:bg-zinc-50 hover:via-zinc-900 hover:to-zinc-800 active:shadow-[-1px_0px_1px_0px_#e4e4e7_inset,1px_0px_1px_0px_#e4e4e7_inset,0px_0.125rem_1px_0px_#d4d4d8_inset] mb-4"
      >
        ＋
      </Button>
      {/* ＋ボタン押下時にページ末尾までスクロールする */}
      <div ref={bottomRef}></div>
      <Modal open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <h2 >セットする値を入力してください。</h2>
        <h2 className="mb-4">※選択した項目にのみ適用されます。</h2>
        {bulkField === 'excluded' ? (
          <select
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            className="border border-gray-300 rounded p-2 mb-4 w-full"
          >
            <option value="対象">対象</option>
            <option value="対象外">対象外</option>
          </select>
        ) : (
          <input
            type="text"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            className="border border-gray-300 rounded p-2 mb-4 w-full"
          />
        )}
        <div className="flex justify-center space-x-4">
          <Button onClick={handleBulkSubmit}>一括入力</Button>
          <Button onClick={() => setIsDialogOpen(false)} className="bg-gray-500 hover:bg-gray-400">キャンセル</Button>
        </div>
      </Modal>
    </div>
  );
};

export default TestCaseForm;