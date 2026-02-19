import { canEditTestCases } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/authOption';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import { getServerSession } from 'next-auth';
import { encode } from 'next-auth/jwt';
import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ groupId: string }>;
};

export default async function TestCaseAutoGeneratePage({ params }: Props) {
  const { groupId } = await params;
  const decodedGroupId = Number(decodeURIComponent(groupId));

  let session;

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

    // テスト設計者ロールを持つユーザのみ自動生成可能
    const isCreatable = await canEditTestCases(session.user, decodedGroupId);
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

  // 自動生成画面のCloudFront URLを環境変数から取得
  const autoGenerateUrl = process.env.AUTO_GENERATE_URL;
  if (!autoGenerateUrl) {
    return <InternalServerErrorUI />;
  }

  // 短命トークンを生成して現在のシステムの認証情報をCloudFront側に渡す
  // CloudFront側では同じNEXTAUTH_SECRETを使いnext-auth/jwtのdecodeで検証可能
  const token = await encode({
    token: {
      sub: String(session!.user.id),
      email: session!.user.email ?? '',
      groupId: decodedGroupId,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 300, // 5分間有効
  });

  redirect(
    `${autoGenerateUrl}?token=${encodeURIComponent(token)}&groupId=${decodedGroupId}`
  );
}
