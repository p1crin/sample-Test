import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/authOption";
import { canViewTestGroup } from "@/app/lib/auth";
import ForbiddenUI from "@/components/ui/forbiddenUI";
import InternalServerErrorUI from "@/components/ui/internalServerErrorUI";
import UnauthorizedUI from "@/components/ui/unauthorizedUI";
import { useParams } from "next/navigation";
import TestGroupInfoTableModal from "@/app/(secure)/_components/testGroupInfoTableModal";
import { TestCaseListContainer } from "../_components/TestCaseListContainer";

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function TestCasePage({ params }: Props) {
  let session;
  let isCanView = false;
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

    // 閲覧可能なテストグループかを確認
    isCanView = await canViewTestGroup(session.user.id, session.user.user_role, decodedGroupId)
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
      <div className="flex items-center mt-4 pb-3">
        <h1 className="text-2xl font-bold">テストケース一覧</h1>
        <TestGroupInfoTableModal />
      </div>
      <TestCaseListContainer />
    </>
  );
}