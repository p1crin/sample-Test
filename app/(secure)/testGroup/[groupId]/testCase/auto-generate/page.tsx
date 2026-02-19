import { canEditTestCases } from '@/app/lib/auth';
import { authOptions } from '@/app/lib/authOption';
import ForbiddenUI from '@/components/ui/forbiddenUI';
import InternalServerErrorUI from '@/components/ui/internalServerErrorUI';
import UnauthorizedUI from '@/components/ui/unauthorizedUI';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { encode } from 'next-auth/jwt';
import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ groupId: string }>;
};

/**
 * CloudFront カスタムポリシー署名付き URL を生成する。
 *
 * CloudFront 側で「署名付き URL のみ許可」設定をすることで、
 * URL を直接知っていてもアクセスできなくなる。
 *
 * @param baseUrl  CloudFront ディストリビューションのベース URL（クエリなし）
 * @param privateKey  PEM 形式の RSA 秘密鍵（CLOUDFRONT_PRIVATE_KEY 環境変数）
 * @param keyPairId  CloudFront キーペア ID（CLOUDFRONT_KEY_PAIR_ID 環境変数）
 * @param expiresInSeconds  有効秒数（デフォルト 300 秒）
 * @returns CloudFront 署名付き URL のクエリパラメータ（Policy, Signature, Key-Pair-Id）
 */
function buildCloudFrontSignedParams(
  baseUrl: string,
  privateKey: string,
  keyPairId: string,
  expiresInSeconds = 300
): { Policy: string; Signature: string; 'Key-Pair-Id': string } {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // ワイルドカード Resource にすることで、後から追加するクエリパラメータを許容する
  const policy = JSON.stringify({
    Statement: [
      {
        Resource: `${baseUrl}*`,
        Condition: {
          DateLessThan: { 'AWS:EpochTime': expires },
        },
      },
    ],
  });

  // CloudFront の URL-safe base64 エンコード（+→-, =→_, /→~）
  const encodeBase64 = (data: string | Buffer) =>
    Buffer.from(data)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/=/g, '_')
      .replace(/\//g, '~');

  const encodedPolicy = encodeBase64(policy);

  const sign = crypto.createSign('SHA1');
  sign.update(policy);
  const signature = encodeBase64(sign.sign(privateKey));

  return {
    Policy: encodedPolicy,
    Signature: signature,
    'Key-Pair-Id': keyPairId,
  };
}

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

  // ユーザー識別用トークン（HTMX アプリが userId / groupId を参照するために使用）
  // CloudFront 側では next-auth/jwt の decode で検証可能
  const userToken = await encode({
    token: {
      sub: String(session!.user.id),
      email: session!.user.email ?? '',
      groupId: decodedGroupId,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 300, // 5分間有効
  });

  const cfPrivateKey = process.env.CLOUDFRONT_PRIVATE_KEY;
  const cfKeyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;

  // --- CloudFront 署名付き URL モード ---
  // CLOUDFRONT_PRIVATE_KEY / CLOUDFRONT_KEY_PAIR_ID が設定されている場合:
  //   CloudFront ディストリビューションで「署名付き URL のみ許可」を有効にすることで、
  //   URL を直接知っているだけではアクセスできなくなる（AWS 側で署名検証）
  if (cfPrivateKey && cfKeyPairId) {
    const signedParams = buildCloudFrontSignedParams(
      autoGenerateUrl,
      cfPrivateKey,
      cfKeyPairId
    );

    const query = new URLSearchParams({
      groupId: String(decodedGroupId),
      token: userToken,
      ...signedParams,
    });

    redirect(`${autoGenerateUrl}?${query.toString()}`);
  }

  // --- フォールバック: トークンのみモード（開発環境 / CloudFront 未設定時）---
  // この場合、HTMX アプリ側で token パラメータを next-auth/jwt decode で検証すること
  redirect(
    `${autoGenerateUrl}?token=${encodeURIComponent(userToken)}&groupId=${decodedGroupId}`
  );
}
