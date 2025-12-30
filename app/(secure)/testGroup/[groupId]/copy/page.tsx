import { Suspense } from 'react';
import { TestGroupCopyFormContainer } from './_components/TestGroupCopyFormContainer';

type Props = {
  params: Promise<{ groupName: string }>;
};

export default async function TestGroupCopyPage({ params }: Props) {
  const { groupName } = await params;
  const decodedGroupName = Number(decodeURIComponent(groupName));
  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ複製</h1>
      <TestGroupCopyFormContainer testGroupId={decodedGroupName} />
    </Suspense>
  );
}
