import { Suspense } from 'react';
import { TestGroupEditFormContainer } from './_components/TestGroupEditFormContainer';

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function TestGroupEditPage({ params }: Props) {
  const { groupId } = await params;
  const decodedGroupId = Number(decodeURIComponent(groupId));
  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ編集</h1>
      <TestGroupEditFormContainer groupId={decodedGroupId} />
    </Suspense>
  );
}
