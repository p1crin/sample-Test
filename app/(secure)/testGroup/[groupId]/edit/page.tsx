import { Suspense } from 'react';
import { TestGroupEditFormContainer } from './_components/TestGroupEditFormContainer';

type Props = {
  params: Promise<{ groupName: string }>;
};

export default async function TestGroupEditPage({ params }: Props) {
  const { groupName } = await params;
  const decodedGroupName = Number(decodeURIComponent(groupName));
  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ編集</h1>
      <TestGroupEditFormContainer groupId={decodedGroupName} />
    </Suspense>
  );
}
