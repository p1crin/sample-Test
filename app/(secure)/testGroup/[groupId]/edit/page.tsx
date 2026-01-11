import { canModifyTestGroup } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/authOption';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import { TestGroupEditFormContainer } from './_components/TestGroupEditFormContainer';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function TestGroupEditPage({ params }: Props) {
  const { groupId } = await params;
  const decodedGroupId = Number(decodeURIComponent(groupId));

  // サーバー側で権限チェック
  const session = await getServerSession(authOptions);

  // 認証確認
  if (!session?.user) {
    return <UnauthorizedUI />;
  }

  // user.idが存在することを確認
  if (!session.user.id) {
    return <UnauthorizedUI />;
  }

  try {
    // 特定のテストグループへのアクセス権限チェック
    // ADMIN または テストグループ作成者のみが編集可能
    const canModify = await canModifyTestGroup(
      {
        id: session.user.id,
        email: session.user.email,
        user_role: session.user.user_role,
        department: session.user.department,
        company: session.user.company,
        name: session.user.name,
      },
      decodedGroupId
    );

    if (!canModify) {
      return <ForbiddenUI />;
    }
  } catch (error) {
    // Forbiddenエラーはそのままスロー
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return <ForbiddenUI />;
    }
    // その他のエラーもスロー（例：DB接続エラー）
    return <InternalServerErrorUI />;
  }

  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ編集</h1>
      <TestGroupEditFormContainer />
    </Suspense>
  );
}