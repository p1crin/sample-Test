import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin, isTestManager } from '@/app/lib/auth';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import { TestGroupCopyFormContainer } from './_components/TestGroupCopyFormContainer';

export default async function TestGroupCopyPage() {
  let session;
  let isCreateOrCopy = false;

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

    // ユーザロールがテストマネージャーまたは管理者のみが複製可能
    isCreateOrCopy = isAdmin(session.user) || isTestManager(session.user);

    if (!isCreateOrCopy) {
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
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ複製</h1>
      <TestGroupCopyFormContainer />
    </Suspense>
  );
}
