import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { canModifyTestGroup } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/auth-options';
import { TestGroupEditFormContainer } from './_components/TestGroupEditFormContainer';

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
    throw new Error('Unauthorized: ログインが必要です');
  }

  // user.idが存在することを確認
  if (!session.user.id) {
    throw new Error('Unauthorized: ユーザ情報が不正です');
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
      },
      decodedGroupId
    );

    if (!canModify) {
      throw new Error('Forbidden: このテストグループを編集する権限がありません');
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
      <h1 className="text-2xl font-bold mt-4 pb-3">テストグループ編集</h1>
      <TestGroupEditFormContainer groupId={decodedGroupId} />
    </Suspense>
  );
}
