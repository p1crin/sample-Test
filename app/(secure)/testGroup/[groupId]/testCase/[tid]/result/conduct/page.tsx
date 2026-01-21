import { Suspense } from 'react';
import { TestCaseConductContainer } from './_components/TestCaseConductContainer';
import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';
import { canExecuteTests } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/authOption';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import { getServerSession } from 'next-auth';

type Props = {
  params: Promise<{ groupId: string, tid: string }>;
};

export default async function TestCaseConductPage({ params }: Props) {
  const { groupId: groupId } = await params
  const { tid: tid } = await params;
  let session;
  let isCanView = false;
  try {
    // サーバー側で権限チェック
    session = await getServerSession(authOptions);

    // 認証確認
    if (!session?.user) {
      return <UnauthorizedUI />;
    }

    // user.idが存在することを確認
    if (!session.user.id) {
      return <UnauthorizedUI />;
    }
    // 閲覧可能なテストグループかを確認
    isCanView = await canExecuteTests(session.user, parseInt(groupId, 10));
    if (!isCanView) {
      return <ForbiddenUI />;
    }

  } catch (error) {
    // エラーハンドリング
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return <ForbiddenUI />;
    }
    return <InternalServerErrorUI />;
  }
  return (
    <Suspense>
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース結果登録</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseConductContainer groupId={parseInt(groupId, 10)} tid={tid} />
    </Suspense>
  );
}
