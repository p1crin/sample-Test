import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { compare } from 'bcryptjs';
import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(ERROR_MESSAGES.MISSING_CREDENTIALS);
        }

        // メールアドレスでユーザーを検索
        const user = await prisma.mt_users.findUnique({
          where: {
            email: credentials.email,
            is_deleted: false,
          },
        });

        if (!user) {
          throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        // パスワードを検証
        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        // ユーザーオブジェクトを返す（パスワードは含まない）
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          user_role: user.user_role,
          department: user.department ?? undefined,
          company: user.company ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30日（セッションの有効期限）
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30日（アクセストークンの有効期限）
  },
  callbacks: {
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);

      if (user) {
        // 新しいログイン - トークンを初期化
        token.sub = user.id.toString();
        token.email = user.email;
        token.name = user.name;
        token.user_role = user.user_role;
        token.department = user.department;
        token.company = user.company;
        token.iat = now;
        token.exp = now + 30 * 24 * 60 * 60; // 30日
      } else if (token) {
        // トークンのリフレッシュ - トークンの更新が必要か確認
        const exp = token.exp as number;
        const timeRemaining = exp - now;

        // 残り時間が1日未満の場合、トークンをリフレッシュ
        if (timeRemaining < 24 * 60 * 60) {
          token.iat = now;
          token.exp = now + 30 * 24 * 60 * 60; // 30日
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = parseInt(token.sub!);
        session.user.email = token.email!;
        session.user.name = token.name!;
        session.user.user_role = token.user_role;
        session.user.department = token.department;
        session.user.company = token.company;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};