import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';
import { authOptions } from '@/app/lib/authOption';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import { TestCaseResultContainer } from './_components/TestCaseResultContainer';
import { canViewTestGroup } from '@/app/lib/auth';

type Props = {
  params: Promise<{ groupId: string; tid: string }>;
};

export default async function TestCaseResultPage({ params }: Props) {
  const { groupId, tid } = await params;
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
    isCanView = await canViewTestGroup(session.user.id, session.user.user_role, parseInt(groupId, 10))
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
        <h1 className="text-2xl font-bold">テストケース結果確認</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseResultContainer groupId={parseInt(groupId, 10)} tid={tid} />
    </Suspense>
  );
}