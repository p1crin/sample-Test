import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';
import TestCaseRegistrantion from './_components/TestCaseRegistrantion';

export default function TestCaseRegistrantionPage() {
  return (
    <>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース新規登録</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseRegistrantion />
    </>
  );
}