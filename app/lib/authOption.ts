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

        // Find user by email
        const user = await prisma.mt_users.findUnique({
          where: {
            email: credentials.email,
            is_deleted: false,
          },
        });

        if (!user) {
          throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        // Verify password
        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        // Return user object (without password)
        return {
          id: user.id,
          email: user.email,
          user_role: user.user_role,
          department: user.department ?? undefined,
          company: user.company ?? undefined,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days (session lifetime)
  },
  jwt: {
    maxAge: 30, // 30 seconds (for testing token refresh)
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // New login - initialize token
        token.sub = user.id.toString();
        token.email = user.email;
        token.user_role = user.user_role;
        token.department = user.department;
        token.company = user.company;
        token.iat = Math.floor(Date.now() / 1000);
        token.exp = Math.floor(Date.now() / 1000) + 30; // 30 seconds for testing
      } else if (token) {
        // Token refresh - check if token needs to be refreshed
        const now = Math.floor(Date.now() / 1000);
        const exp = token.exp as number;
        const timeRemaining = exp - now;

        // If less than 10 seconds remaining (or already expired), refresh the token
        if (timeRemaining < 10) {
          token.iat = now;
          token.exp = now + 30; // Refresh to 30 seconds
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = parseInt(token.sub!);
        session.user.email = token.email!;
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
