import { Suspense } from "react";
import { ImportInfoContainer } from "../_components/ImportInfoContainer";
import { isAdmin, isTestManager } from "@/app/lib/auth";
import { authOptions } from "@/app/lib/authOption";
import ForbiddenUI from "@/components/ui/forbiddenUI";
import InternalServerErrorUI from "@/components/ui/internalServerErrorUI";
import UnauthorizedUI from "@/components/ui/unauthorizedUI";
import { getServerSession } from "next-auth";

type Props = {
  params: Promise<{ id: number }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
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

    // ユーザロールがテストマネージャーまたは管理者のみが作成可能
    isCanView = isAdmin(session.user) || isTestManager(session.user);

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
      <h1 className="text-2xl font-bold mt-4 pb-3">インポート内容確認</h1>
      <ImportInfoContainer id={id} />
    </Suspense>
  )
}