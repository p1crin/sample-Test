import TestGroupInfoTableModal from '@/app/(secure)/_components/testGroupInfoTableModal';
import TestCaseRegistrantion from './_components/TestCaseRegistrantion';
import { canEditTestCases, isTestManager } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/authOption';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import { getServerSession } from 'next-auth';
import { useParams } from 'next/navigation';

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function TestCaseRegistrantionPage({ params }: Props) {
  let session;
  let isCreatable = false;
  const { groupId } = await params;
  const decodedGroupId = Number(decodeURIComponent(groupId));

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
    isCreatable = await canEditTestCases(session.user, decodedGroupId);

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
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース新規登録</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseRegistrantion/>
    </>
  );
}