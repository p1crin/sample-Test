import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole, TestRole } from '@/types';
import { prisma } from '@/app/lib/prisma';

// Session user interface
export interface SessionUser {
  id: number;
  email: string;
  user_role: UserRole;
  department?: string;
  company?: string;
}

// Get authenticated user from request
export async function getAuthUser(
  req: NextRequest
): Promise<SessionUser | null> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token || !token.sub) {
    return null;
  }

  return {
    id: parseInt(token.sub),
    email: token.email as string,
    user_role: token.user_role as UserRole,
    department: token.department as string | undefined,
    company: token.company as string | undefined,
  };
}

// Require authentication middleware
export async function requireAuth(
  req: NextRequest
): Promise<SessionUser> {
  const user = await getAuthUser(req);

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// Check if user is admin
export function isAdmin(user: SessionUser): boolean {
  return user.user_role === UserRole.ADMIN;
}

// Check if user is test manager or admin
export function isTestManager(user: SessionUser): boolean {
  return user.user_role === UserRole.TEST_MANAGER || user.user_role === UserRole.ADMIN;
}

// Require admin role
export async function requireAdmin(req: NextRequest): Promise<SessionUser> {
  const user = await requireAuth(req);

  if (!isAdmin(user)) {
    throw new Error('Forbidden: Admin access required');
  }

  return user;
}

// Require test manager or admin role
export async function requireTestManager(req: NextRequest): Promise<SessionUser> {
  const user = await requireAuth(req);

  if (!isTestManager(user)) {
    throw new Error('Forbidden: Test Manager access required');
  }

  return user;
}

// Check if user has permission to view a test group
export async function canViewTestGroup(
  userId: number,
  userRole: UserRole,
  testGroupId: number
): Promise<boolean> {
  // Admins can view all
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Check if user created the group
  const group = await prisma.tt_test_groups.findUnique({
    where: { id: testGroupId },
    select: { created_by: true, is_deleted: true },
  });

  if (!group || group.is_deleted) {
    return false;
  }

  // If user created it
  if (group.created_by === userId.toString()) {
    return true;
  }

  // Check if user has any test_role assigned via tags
  const hasPermission = await hasTestGroupPermission(userId, testGroupId);
  return hasPermission;
}

// Check if user has any permission on test group (via tags)
export async function hasTestGroupPermission(
  userId: number,
  testGroupId: number
): Promise<boolean> {
  const count = await prisma.tt_test_group_tags.count({
    where: {
      test_group_id: testGroupId,
      mt_tags: {
        mt_user_tags: {
          some: {
            user_id: userId,
          },
        },
      },
    },
  });

  return count > 0;
}

// Check if user has specific test role on test group
export async function hasTestRole(
  userId: number,
  testGroupId: number,
  requiredRole: TestRole
): Promise<boolean> {
  const tags = await prisma.tt_test_group_tags.findMany({
    where: {
      test_group_id: testGroupId,
      mt_tags: {
        mt_user_tags: {
          some: {
            user_id: userId,
          },
        },
      },
    },
    select: {
      test_role: true,
    },
  });

  // Check if user has the required role or a higher privilege role
  // Designer (1) > Executor (2) > Viewer (3)
  for (const tag of tags) {
    if (tag.test_role <= requiredRole) {
      return true;
    }
  }

  return false;
}

// Check if user can edit test cases (requires Designer role)
export async function canEditTestCases(
  user: SessionUser,
  testGroupId: number
): Promise<boolean> {
  // Admins can always edit
  if (isAdmin(user)) {
    return true;
  }

  // Check if user has Designer role
  return await hasTestRole(user.id, testGroupId, TestRole.DESIGNER);
}

// Check if user can execute tests (requires Executor role)
export async function canExecuteTests(
  user: SessionUser,
  testGroupId: number
): Promise<boolean> {
  // Admins can always execute
  if (isAdmin(user)) {
    return true;
  }

  // Check if user has Executor role
  return await hasTestRole(user.id, testGroupId, TestRole.EXECUTOR);
}

// Check if user can modify test group
export async function canModifyTestGroup(
  user: SessionUser,
  testGroupId: number
): Promise<boolean> {
  // Admins can always modify
  if (isAdmin(user)) {
    return true;
  }

  // Check if user created the group
  const group = await prisma.tt_test_groups.findUnique({
    where: { id: testGroupId },
    select: { created_by: true, is_deleted: true },
  });

  if (!group || group.is_deleted) {
    return false;
  }

  return group.created_by === user.id.toString();
}

// Get all test groups accessible by user
export async function getAccessibleTestGroups(
  userId: number,
  userRole: UserRole
): Promise<number[]> {
  // Admins can access all
  if (userRole === UserRole.ADMIN) {
    const groups = await prisma.tt_test_groups.findMany({
      where: { is_deleted: false },
      select: { id: true },
    });
    return groups.map((group) => group.id);
  }

  // Test managers can access groups they created or are assigned to
  if (userRole === UserRole.TEST_MANAGER) {
    const groups = await prisma.tt_test_groups.findMany({
      where: {
        is_deleted: false,
        OR: [
          { created_by: userId.toString() },
          {
            tt_test_group_tags: {
              some: {
                mt_tags: {
                  mt_user_tags: {
                    some: {
                      user_id: userId,
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
      distinct: ['id'],
    });
    return groups.map((group) => group.id);
  }

  // General users can only access groups they are assigned to
  const tags = await prisma.tt_test_group_tags.findMany({
    where: {
      mt_tags: {
        mt_user_tags: {
          some: {
            user_id: userId,
          },
        },
      },
    },
    select: { test_group_id: true },
    distinct: ['test_group_id'],
  });

  return tags.map((tag) => tag.test_group_id);
}

// Check if user can access a specific test group
export async function checkTestGroupAccess(
  userId: number,
  userRole: UserRole,
  testGroupId: number
): Promise<boolean> {
  return await canViewTestGroup(userId, userRole, testGroupId);
}
