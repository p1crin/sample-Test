import { prisma } from '@/app/lib/prisma';
import { TestRole, UserRole } from '@/types';
import { runWithContextAsync } from '@/utils/request-context';
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

// セッションユーザーのインターフェース
export interface SessionUser {
  id: number;
  email: string;
  name: string;
  user_role: UserRole;
  department?: string;
  company?: string;
}

// リクエストから認証されたユーザーを取得
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
    name: token.name as string,
    user_role: token.user_role as UserRole,
    department: token.department as string | undefined,
    company: token.company as string | undefined,
  };
}

// 認証が必要なミドルウェア
export async function requireAuth(
  req: NextRequest
): Promise<SessionUser> {
  const user = await getAuthUser(req);

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

// ユーザーが管理者かどうかをチェック
export function isAdmin(user: SessionUser): boolean {
  return user.user_role === UserRole.ADMIN;
}

// ユーザーがテストマネージャーまたは管理者かどうかをチェック
export function isTestManager(user: SessionUser): boolean {
  return user.user_role === UserRole.TEST_MANAGER;
}

// 管理者ロールが必要
export async function requireAdmin(req: NextRequest): Promise<SessionUser> {
  const user = await requireAuth(req);

  if (!isAdmin(user)) {
    throw new Error('Forbidden: Admin access required');
  }

  return user;
}

// APIハンドラータイプ
type ApiHandler<T = NextResponse> = (
  req: NextRequest,
  user: SessionUser,
  context?: { params: Promise<Record<string, string>> }
) => Promise<T>;

/**
 * 認証付きAPIハンドラーラッパー
 * ユーザーIDがリクエストコンテキストに自動設定され、すべてのログに含まれる
 */
export function withAuth<T = NextResponse>(handler: ApiHandler<T>) {
  return async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<T | NextResponse> => {
    const user = await getAuthUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return runWithContextAsync({ userId: user.id }, () =>
      handler(req, user, context)
    );
  };
}

/**
 * 管理者認証付きAPIハンドラーラッパー
 * ユーザーIDがリクエストコンテキストに自動設定され、すべてのログに含まれる
 */
export function withAdmin<T = NextResponse>(handler: ApiHandler<T>) {
  return async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<T | NextResponse> => {
    const user = await getAuthUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    return runWithContextAsync({ userId: user.id }, () =>
      handler(req, user, context)
    );
  };
}

/**
 * 管理者またはテスト管理者認証付きAPIハンドラーラッパー
 * ユーザーIDがリクエストコンテキストに自動設定され、すべてのログに含まれる
 */
export function withAdminOrTestManager<T = NextResponse>(handler: ApiHandler<T>) {
  return async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<T | NextResponse> => {
    const user = await getAuthUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdmin(user) && !isTestManager(user)) {
      return NextResponse.json({ error: 'Forbidden: Admin or Test Manager access required' }, { status: 403 });
    }

    return runWithContextAsync({ userId: user.id }, () =>
      handler(req, user, context)
    );
  };
}

// 管理者ロールまたはテスト管理者ロールが必要
export async function requireAdminOrTestManager(req: NextRequest): Promise<SessionUser> {
  const user = await requireAuth(req);

  if (!isAdmin(user) && !isTestManager(user)) {
    throw new Error('Forbidden: Test Manager or higher access required');
  }

  return user;
}

// ユーザーがテストグループを閲覧する権限があるかどうかをチェック
export async function canViewTestGroup(
  userId: number,
  userRole: UserRole,
  testGroupId: number
): Promise<boolean> {
  // 管理者はすべて閲覧可能
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // ユーザーがグループを作成または更新したかどうかをチェック
  const group = await prisma.tt_test_groups.findUnique({
    where: { id: testGroupId },
    select: { created_by: true, updated_by: true, is_deleted: true },
  });

  if (!group || group.is_deleted) {
    return false;
  }

  // ユーザーがグループを作成または更新した場合
  if (group.created_by === userId || group.updated_by === userId) {
    return true;
  }

  // ユーザーがタグを通じてテストロールを持っているかどうかをチェック
  const hasPermission = await hasTestGroupPermission(userId, testGroupId);
  return hasPermission;
}

// ユーザーがテストグループに対して何らかの権限を持っているかどうかをチェック（タグを通じて）
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

// ユーザーが特定のテストロールを持っているかどうかをチェック
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

  // ユーザーが必要なロールまたはそれ以上の権限を持っているかどうかをチェック
  // 設計者 (0) > 実施者 (1) > 閲覧者 (2)
  for (const tag of tags) {
    if (tag.test_role <= requiredRole) {
      return true;
    }
  }

  return false;
}

// ユーザーがテストケースを編集できるかどうかをチェック（設計者ロールが必要）
export async function canEditTestCases(
  user: SessionUser,
  testGroupId: number
): Promise<boolean> {
  // 管理者は常に編集可能
  if (isAdmin(user)) {
    return true;
  }

  // ユーザーがグループを作成または更新したかどうかをチェック
  const group = await prisma.tt_test_groups.findUnique({
    where: { id: testGroupId },
    select: { created_by: true, updated_by: true, is_deleted: true },
  });

  if (!group || group.is_deleted) {
    return false;
  }

  // ユーザーがグループを作成または更新した場合
  if (group.created_by === user.id || group.updated_by === user.id) {
    return true;
  }

  // ユーザーが設計者ロールを持っているかどうかをチェック
  return await hasTestRole(user.id, testGroupId, TestRole.DESIGNER);
}

// ユーザーがテストを実行できるかどうかをチェック（実施者ロールが必要）
export async function canExecuteTests(
  user: SessionUser,
  testGroupId: number
): Promise<boolean> {
  // 管理者は常に実行可能
  if (isAdmin(user)) {
    return true;
  }

  // ユーザーが実施者ロールを持っているかどうかをチェック
  return await hasTestRole(user.id, testGroupId, TestRole.EXECUTOR);
}

// ユーザーがテストグループを変更できるかどうかをチェック
export async function canModifyTestGroup(
  user: SessionUser,
  testGroupId: number
): Promise<boolean> {
  // 管理者は常に変更可能
  if (isAdmin(user)) {
    return true;
  }

  // ユーザーがグループを作成または更新したかどうかをチェック
  const group = await prisma.tt_test_groups.findUnique({
    where: { id: testGroupId },
    select: { created_by: true, updated_by: true, is_deleted: true },
  });

  if (!group || group.is_deleted) {
    return false;
  }

  return group.created_by === user.id || group.updated_by === user.id;
}

// ユーザーがアクセス可能なすべてのテストグループを取得
export async function getAccessibleTestGroups(
  userId: number,
  userRole: UserRole
): Promise<number[]> {
  // 管理者はすべてアクセス可能
  if (userRole === UserRole.ADMIN) {
    const groups = await prisma.tt_test_groups.findMany({
      where: { is_deleted: false },
      select: { id: true },
    });
    return groups.map((group) => group.id);
  }

  // テスト管理者は自分が作成/更新したグループまたは割り当てられたグループにアクセス可能
  if (userRole === UserRole.TEST_MANAGER) {
    const groups = await prisma.tt_test_groups.findMany({
      where: {
        is_deleted: false,
        OR: [
          { created_by: userId },
          { updated_by: userId },
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

  // 一般ユーザーは割り当てられたグループにのみアクセス可能
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