import { isAdmin } from "@/app/lib/auth";
import { authOptions } from "@/app/lib/authOption";
import ForbiddenUI from "@/components/ui/forbiddenUI";
import InternalServerErrorUI from "@/components/ui/internalServerErrorUI";
import UnauthorizedUI from "@/components/ui/unauthorizedUI";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { UserImportExecuteContainer } from "./_components/UserImportExecuteContainer";

export default async function UserImportPage() {
  try {
    // サーバー側で権限チェック
    const session = await getServerSession(authOptions);

    // 認証確認
    if (!session?.user?.id) {
      return <UnauthorizedUI />;
    }

    // ユーザロールが管理者のみがアクセス可能
    const isCanView = isAdmin(session.user);
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
      <h1 className="text-2xl font-bold mt-4 pb-3">ユーザインポート実施</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <UserImportExecuteContainer />
      </Suspense>
    </>
  );
}
