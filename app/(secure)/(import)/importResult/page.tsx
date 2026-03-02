import { isAdmin, isTestDesignerUser, isTestManager } from "@/app/lib/auth";
import { authOptions } from "@/app/lib/authOption";
import { UserRole } from "@/types";
import ForbiddenUI from "@/components/ui/forbiddenUI";
import InternalServerErrorUI from "@/components/ui/internalServerErrorUI";
import UnauthorizedUI from "@/components/ui/unauthorizedUI";
import { getServerSession } from "next-auth";
import { ImportResultListContainer } from "./_components/importResultListContainer";

export default async function Page() {
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

    // 管理者またはテストマネージャーは閲覧可能
    // 一般ユーザーはテスト設計者タグを持つ場合のみ閲覧可能
    if (isAdmin(session.user) || isTestManager(session.user)) {
      isCanView = true;
    } else if (session.user.user_role === UserRole.GENERAL) {
      isCanView = await isTestDesignerUser(session.user.id);
    }

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
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">インポート結果一覧</h1>
      <ImportResultListContainer />
    </>
  );
}