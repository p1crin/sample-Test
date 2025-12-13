import { getServerSession } from 'next-auth';
import UnauthorizedError from '@/components/ui/UnauthorizedError';
import TestGroupRegistrantion from './_components/TestGroupRegistrantion';
import { authOptions } from '@/app/lib/auth-options';

export default async function TestGroupRegistrantionPage() {
  const session = await getServerSession(authOptions);

  // 認証確認
  if (!session?.user) {
    return <UnauthorizedError message="ログインが必要です。" backLink="/login" backLinkLabel="ログインページへ" />;
  }

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ新規登録</h1>
      <TestGroupRegistrantion />
    </>
  );
}