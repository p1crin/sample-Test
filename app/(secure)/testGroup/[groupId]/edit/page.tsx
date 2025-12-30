import { Suspense } from 'react';
import { TestGroupEditFormContainer } from './_components/TestGroupEditFormContainer';

export default async function TestGroupEditPage() {
  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ編集</h1>
      <TestGroupEditFormContainer />
    </Suspense>
  );
}
