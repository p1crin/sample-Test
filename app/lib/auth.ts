import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { UserRole, TestRole } from '@/types';
import { query, getSingleRow } from '@/app/lib/db';

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
  const groupResult = await query<{ created_by: string }>(
    `SELECT created_by FROM tt_test_groups
     WHERE id = $1 AND is_deleted = FALSE`,
    [testGroupId]
  );

  const group = getSingleRow<{ created_by: string }>(groupResult);
  if (!group) {
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
  const result = await query(
    `SELECT COUNT(*) as count
     FROM tt_test_group_tags tgt
     JOIN mt_user_tags ut ON tgt.tag_id = ut.tag_id
     WHERE tgt.test_group_id = $1 AND ut.user_id = $2`,
    [testGroupId, userId]
  );

  const row = getSingleRow<{ count: string }>(result);
  return row ? parseInt(row.count) > 0 : false;
}

// Check if user has specific test role on test group
export async function hasTestRole(
  userId: number,
  testGroupId: number,
  requiredRole: TestRole
): Promise<boolean> {
  const result = await query(
    `SELECT tgt.test_role
     FROM tt_test_group_tags tgt
     JOIN mt_user_tags ut ON tgt.tag_id = ut.tag_id
     WHERE tgt.test_group_id = $1 AND ut.user_id = $2`,
    [testGroupId, userId]
  );

  // Check if user has the required role or a higher privilege role
  // Designer (1) > Executor (2) > Viewer (3)
  for (const row of result.rows) {
    if (row.test_role <= requiredRole) {
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
  const groupResult = await query(
    `SELECT created_by FROM tt_test_groups
     WHERE id = $1 AND is_deleted = FALSE`,
    [testGroupId]
  );

  const group = getSingleRow<{ created_by: string }>(groupResult);
  if (!group) {
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
    const result = await query(
      `SELECT id FROM tt_test_groups WHERE is_deleted = FALSE`
    );
    return result.rows.map((row: { id: number }) => row.id);
  }

  // Test managers can access groups they created or are assigned to
  if (userRole === UserRole.TEST_MANAGER) {
    const result = await query(
      `SELECT DISTINCT tg.id
       FROM tt_test_groups tg
       LEFT JOIN tt_test_group_tags tgt ON tg.id = tgt.test_group_id
       LEFT JOIN mt_user_tags ut ON tgt.tag_id = ut.tag_id
       WHERE tg.is_deleted = FALSE
       AND (tg.created_by = $1 OR ut.user_id = $1)`,
      [userId.toString()]
    );
    return result.rows.map((row: { id: number }) => row.id);
  }

  // General users can only access groups they are assigned to
  const result = await query(
    `SELECT DISTINCT tgt.test_group_id
     FROM tt_test_group_tags tgt
     JOIN mt_user_tags ut ON tgt.tag_id = ut.tag_id
     WHERE ut.user_id = $1`,
    [userId]
  );

  return result.rows.map((row: { test_group_id: number }) => row.test_group_id);
}
