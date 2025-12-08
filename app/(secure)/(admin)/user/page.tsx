import { UserListContainer } from './_components/UserListContainer';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { UserRole } from '@/types/database';

export default async function UserListPage() {
  // Get current user session
  const session = await getServerSession(authOptions);
  
  // Check if user is authenticated
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Check if user has admin role
  if (session.user.user_role !== UserRole.ADMIN) {
    throw new Error('Forbidden: Admin access required');
  }

  return (
    <>
      <h1 className="text-2xl font-bold mt-4 pb-3">ユーザ一覧</h1>
      <UserListContainer />
    </>
  );
}
