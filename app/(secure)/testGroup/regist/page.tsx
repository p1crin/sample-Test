import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { isAdmin, isTestManager } from '@/app/lib/auth';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import { getServerSession } from 'next-auth';
import TestGroupRegistrantion from './_components/TestGroupRegistrantion';


export default async function TestGroupRegistrantionPage() {
  let session;
  let isCreatable = false;

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

    // ユーザロールがテストマネージャーまたは管理者のみが作成可能
    isCreatable = isTestManager(session.user) || isAdmin(session.user);

    if (!isCreatable) {
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
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ新規登録</h1>
      <TestGroupRegistrantion />
    </>
  );
}