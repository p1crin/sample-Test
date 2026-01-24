import { authOptions } from '@/app/lib/authOption';
import { UserRole } from '@/types/database';
import NextAuth from 'next-auth';

// Extend NextAuth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      email: string;
      name: string;
      user_role: UserRole;
      department?: string;
      company?: string;
    };
  }

  interface User {
    id: number;
    email: string;
    name: string;
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

const handler = NextAuth(authOptions);

// "authOptions"をexportから削除
export { handler as GET, handler as POST };
