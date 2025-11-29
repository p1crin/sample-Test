import NextAuth, { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { query, getSingleRow } from '@/app/lib/db';
import { User, UserRole } from '@/types/database';

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      email: string;
      user_role: UserRole;
      department?: string;
      company?: string;
    };
  }

  interface User {
    id: number;
    email: string;
    user_role: UserRole;
    department?: string;
    company?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user_role: UserRole;
    department?: string;
    company?: string;
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('メールアドレスとパスワードを入力してください');
        }

        // Find user by email
        const result = await query<User>(
          `SELECT id, email, user_role, department, company, password
           FROM mt_users
           WHERE email = $1 AND is_deleted = FALSE`,
          [credentials.email]
        );

        const user = getSingleRow<User>(result);

        if (!user) {
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }

        // Verify password
        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('メールアドレスまたはパスワードが正しくありません');
        }

        // Return user object (without password)
        return {
          id: user.id,
          email: user.email,
          user_role: user.user_role,
          department: user.department,
          company: user.company,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      // Add user info to token on sign in
      if (user) {
        token.sub = user.id.toString();
        token.email = user.email;
        token.user_role = user.user_role;
        token.department = user.department;
        token.company = user.company;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user info to session
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
