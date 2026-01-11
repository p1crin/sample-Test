import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';
import { Suspense } from 'react';
import { TestCaseEditFormContainer } from './_components/TestCaseEditFormContainer';

export default async function TestCaseEditPage() {

  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース編集</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseEditFormContainer />
    </Suspense>
  );
}
