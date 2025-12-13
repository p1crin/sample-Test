import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { canModifyTestGroup } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/auth-options';
import { TestGroupCopyFormContainer } from './_components/TestGroupCopyFormContainer';

type Props = {
  params: Promise<{ groupName: string }>;
};

export default async function TestGroupCopyPage({ params }: Props) {
  const { groupName } = await params;
  const decodedGroupName = Number(decodeURIComponent(groupName));

  // サーバー側で権限チェック
  const session = await getServerSession(authOptions);

  // 認証確認
  if (!session?.user) {
    throw new Error('Unauthorized: ログインが必要です');
  }

  // user.idが存在することを確認
  if (!session.user.id) {
    throw new Error('Unauthorized: ユーザ情報が不正です');
  }

  try {
    // 特定のテストグループへのアクセス権限チェック
    // ADMIN または テストグループ作成者のみが複製可能
    const canModify = await canModifyTestGroup(
      {
        id: session.user.id,
        email: session.user.email,
        user_role: session.user.user_role,
        department: session.user.department,
        company: session.user.company,
      },
      decodedGroupName
    );

    if (!canModify) {
      throw new Error('Forbidden: このテストグループを複製する権限がありません');
    }
  } catch (error) {
    // Forbiddenエラーはそのままスロー
    if (error instanceof Error && error.message.includes('Forbidden')) {
      throw error;
    }
    // その他のエラーもスロー（例：DB接続エラー）
    throw error;
  }

  return (
    <Suspense>
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ複製</h1>
      <TestGroupCopyFormContainer groupId={decodedGroupName} />
    </Suspense>
  );
}
