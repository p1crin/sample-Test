import { prisma } from '@/app/lib/prisma';
import { ERROR_MESSAGES } from '@/constants/errorMessages';
import { compare } from 'bcryptjs';
import { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

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
        const user = await prisma.mt_users.findUnique({
          where: {
            email: credentials.email,
            is_deleted: false,
          },
        });
        if (!user) {
          throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }
        const isPasswordValid = await compare(credentials.password, user.password);
        if (!isPasswordValid) {
          throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }
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
    // 1. セッションの最大期間を30日に設定
    maxAge: THIRTY_DAYS_IN_SECONDS,
  },
  jwt: {
    maxAge: THIRTY_DAYS_IN_SECONDS,
  },
  callbacks: {
    async jwt({ token, user }) {
      // ログイン直後 (userオブジェクトが存在する)
      if (user) {
        token.sub = user.id.toString();
        token.email = user.email;
        token.name = user.name;
        token.user_role = user.user_role;
        token.department = user.department;
        token.company = user.company;
        return token;
      }

      // 既存セッションの更新時
      // DBから最新のユーザ情報を取得するロジックは素晴らしいので、そのまま維持
      try {
        const currentUser = await prisma.mt_users.findUnique({
          where: {
            id: parseInt(token.sub!),
            is_deleted: false,
          },
          select: {
            user_role: true,
            name: true,
            email: true,
            department: true,
            company: true,
          },
        });
        if (!currentUser) {
          // ユーザーが存在しない場合、空のオブジェクトを返してセッションを無効化
          return {};
        }
        // 最新のユーザー情報をトークンに反映
        token.user_role = currentUser.user_role;
        token.name = currentUser.name;
        token.email = currentUser.email;
        token.department = currentUser.department;
        token.company = currentUser.company;
      } catch {
        // DBエラー時は何もしない（既存のトークンを返す）
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.sub && session.user) {
        session.user.id = parseInt(token.sub);
        session.user.email = token.email!;
        session.user.name = token.name!;
        session.user.user_role = token.user_role!;
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
