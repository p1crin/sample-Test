import { canViewTestGroup } from '@/app/lib/auth';
import { authOptions } from "@/app/lib/authOption";
import { getServerSession } from 'next-auth';
import { Suspense } from "react";
import TestGroupInfoTableModal from "../../../_components/testGroupInfoTableModal";
import TestSummaryResultContainer from "./_componets/TestSummaryResultContainer";

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function TestSummaryResultPage({ params }: Props) {
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
    const canView = await canViewTestGroup(
      session.user.id,
      session.user.user_role,
      decodedGroupId
    );

    if (!canView) {
      throw new Error('Forbidden: このテストグループを表示する権限がありません');
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
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テスト集計結果表示</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestSummaryResultContainer groupId={decodedGroupId} />
    </Suspense>
  );
}