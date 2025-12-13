import { Suspense } from 'react';
import { TestCaseConductContainer } from './_components/TestCaseConductContainer';
import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';

type Props = {
  params: Promise<{ groupId: string; tid: string }>;
};

export default async function TestCaseConductPage({ params }: Props) {
  const { groupId: groupIdParam, tid } = await params;
  const groupId = parseInt(groupIdParam, 10);

  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース結果登録</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseConductContainer groupId={groupId} tid={tid} />
    </Suspense>
  );
}
