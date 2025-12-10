import { getServerSession } from 'next-auth';
import UnauthorizedError from '@/components/ui/UnauthorizedError';
import { TestGroupListContainer } from './_components/TestGroupListContainer';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export default async function TestGroupListPage() {
  const session = await getServerSession(authOptions);

  // 認証確認
  if (!session?.user) {
    return <UnauthorizedError message="ログインが必要です。" backLink="/login" backLinkLabel="ログインページへ" />;
  }

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ一覧</h1>
      <TestGroupListContainer />
    </>
  );
}
