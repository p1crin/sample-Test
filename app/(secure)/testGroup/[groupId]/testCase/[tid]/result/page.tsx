import { Suspense } from 'react';
import { TestCaseResultContainer } from './_components/TestCaseResultContainer';
import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';

type Props = {
  params: Promise<{ groupId: string; tid: string }>;
};

export default async function TestCaseResultPage({ params }: Props) {
  const { groupId, tid } = await params;
  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース結果確認</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseResultContainer groupId={parseInt(groupId, 10)} tid={tid} />
    </Suspense>
  );
}
