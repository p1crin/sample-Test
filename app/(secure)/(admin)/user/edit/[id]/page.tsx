import { Suspense } from 'react';
import { UserEditFormContainer } from '../_components/UserEditFormContainer';

type Props = {
  params: Promise<{ id: number }>;
};

export default async function UserEditPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">ユーザ編集</h1>
      <UserEditFormContainer id={id} />
    </Suspense>
  );
}
