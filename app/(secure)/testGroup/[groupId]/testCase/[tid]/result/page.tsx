import { Suspense } from 'react';
import { TestCaseResultContainer } from './_components/TestCaseResultContainer';
import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';

type Props = {
  params: Promise<{ tid: number }>;
};

export default async function TestCaseResultPage({ params }: Props) {
  const { tid: tid } = await params;
  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース結果確認</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseResultContainer tid={tid} />
    </Suspense>
  );
}
