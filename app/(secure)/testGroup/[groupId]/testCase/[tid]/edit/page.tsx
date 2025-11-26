import { Suspense } from 'react';
import { TestCaseEditFormContainer } from './_components/TestCaseEditFormContainer';
import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';

type Props = {
  params: Promise<{ id: number }>;
};

export default async function TestCaseEditPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース編集</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseEditFormContainer id={id} />
    </Suspense>
  );
}
