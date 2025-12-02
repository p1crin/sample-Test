import { GET, POST } from '@/app/api/test-groups/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { vi } from 'vitest';

// Prisma のモック
vi.mock('@/app/lib/prisma', () => ({
  prisma: {
    tt_test_groups: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    mt_tags: {
      findFirst: vi.fn(),
    },
    tt_test_group_tags: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// next-auth のモック
vi.mock('next-auth/react', () => ({
  getToken: vi.fn(),
}));

// app/lib/auth のモック
vi.mock('@/app/lib/auth', () => ({
  requireAuth: vi.fn(),
  isAdmin: vi.fn(),
  isTestManager: vi.fn(),
  getAccessibleTestGroups: vi.fn(),
}));

// ユーティリティのモック
vi.mock('@/utils/server-logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/database-logger', () => ({
  logDatabaseQuery: vi.fn(),
  logAPIEndpoint: vi.fn(),
  QueryTimer: class {
    elapsed() {
      return 10;
    }
  },
}));

vi.mock('@/utils/date-formatter', () => ({
  formatDate: vi.fn((date) => date),
}));

const mockUser = {
  id: 1,
  email: 'admin@example.com',
  user_role: 0, // ADMIN
  department: 'IT',
  company: 'Test Co.',
};

const mockTestGroup = {
  id: 1,
  oem: 'OEM-A',
  model: 'Model-X',
  event: 'Event-1',
  variation: 'Var-1',
  destination: 'JP',
  specs: 'Specs-1',
  test_startdate: new Date('2024-01-01'),
  test_enddate: new Date('2024-01-31'),
  ng_plan_count: 10,
  created_by: '1',
  updated_by: '1',
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-31'),
  is_deleted: false,
};

describe('GET /api/test-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('アクセス可能なテストグループを取得できる', async () => {
      const { requireAuth, getAccessibleTestGroups } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(getAccessibleTestGroups).mockResolvedValue([1, 2]);
      vi.mocked(prisma.tt_test_groups.count).mockResolvedValue(2);
      vi.mocked(prisma.tt_test_groups.findMany).mockResolvedValue([
        mockTestGroup,
        { ...mockTestGroup, id: 2, oem: 'OEM-B' },
      ] as any);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.totalCount).toBe(2);
    });

    it('検索パラメータでフィルタリングできる', async () => {
      const { requireAuth, getAccessibleTestGroups } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(getAccessibleTestGroups).mockResolvedValue([1]);
      vi.mocked(prisma.tt_test_groups.count).mockResolvedValue(1);
      vi.mocked(prisma.tt_test_groups.findMany).mockResolvedValue([mockTestGroup] as any);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups?oem=OEM-A&model=Model-X')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });

    it('ページネーションで結果を制限できる', async () => {
      const { requireAuth, getAccessibleTestGroups } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(getAccessibleTestGroups).mockResolvedValue([1, 2, 3]);
      vi.mocked(prisma.tt_test_groups.count).mockResolvedValue(30);
      vi.mocked(prisma.tt_test_groups.findMany).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          ...mockTestGroup,
          id: i + 1,
        })) as any
      );

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups?page=1&limit=10')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(10);
      expect(data.totalCount).toBe(30);
    });

    it('アクセス可能なグループがない場合は空の配列を返す', async () => {
      const { requireAuth, getAccessibleTestGroups } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(getAccessibleTestGroups).mockResolvedValue([]);

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
      expect(data.totalCount).toBe(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('未認証時に 401 エラーを返す', async () => {
      const { requireAuth } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('認証が必要です');
    });

    it('データベースエラー時に 500 エラーを返す', async () => {
      const { requireAuth, getAccessibleTestGroups } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(getAccessibleTestGroups).mockResolvedValue([1]);
      vi.mocked(prisma.tt_test_groups.count).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups')
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('テストグループの取得に失敗しました');
    });
  });
});

describe('POST /api/test-groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('管理者が新しいテストグループを作成できる', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);

      const transactionMock = vi.fn().mockResolvedValue(mockTestGroup);
      vi.mocked(prisma.$transaction).mockImplementation(transactionMock);

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
        tag_names: [],
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('テスト管理者も新しいテストグループを作成できる', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      const testManagerUser = { ...mockUser, user_role: 1 };
      vi.mocked(requireAuth).mockResolvedValue(testManagerUser as any);
      vi.mocked(isAdmin).mockReturnValue(false);
      vi.mocked(isTestManager).mockReturnValue(true);

      const transactionMock = vi.fn().mockResolvedValue(mockTestGroup);
      vi.mocked(prisma.$transaction).mockImplementation(transactionMock);

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
        tag_names: [],
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('タグを指定してテストグループを作成できる', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);

      const mockTag = { id: 1, name: 'tag1', is_deleted: false };
      vi.mocked(prisma.mt_tags.findFirst).mockResolvedValue(mockTag as any);

      const transactionMock = vi.fn().mockImplementation(async (callback) => {
        return callback({
          tt_test_groups: {
            create: vi.fn().mockResolvedValue(mockTestGroup),
          },
          mt_tags: {
            findFirst: vi.fn().mockResolvedValue(mockTag),
          },
          tt_test_group_tags: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });
      vi.mocked(prisma.$transaction).mockImplementation(transactionMock);

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
        tag_names: [{ tag_name: 'tag1', test_role: 1 }],
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe('バリデーション', () => {
    it('必須フィールドが空の場合に 400 エラーを返す', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);

      const requestBody = {
        oem: '',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('フィールドの長さが上限を超える場合に 400 エラーを返す', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);

      const longString = 'a'.repeat(300);
      const requestBody = {
        oem: longString,
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('ng_plan_count が範囲外の場合に 400 エラーを返す', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10000, // 上限は 9999
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('開始日が終了日より後の場合に 400 エラーを返す', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-31',
        test_enddate: '2024-01-01', // 開始日より前
        ng_plan_count: 10,
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('権限チェック', () => {
    it('一般ユーザーは作成できない', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      const generalUser = { ...mockUser, user_role: 2 };
      vi.mocked(requireAuth).mockResolvedValue(generalUser as any);
      vi.mocked(isAdmin).mockReturnValue(false);
      vi.mocked(isTestManager).mockReturnValue(false);

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('テストグループを作成する権限がありません');
    });
  });

  describe('エラーハンドリング', () => {
    it('未認証時に 401 エラーを返す', async () => {
      const { requireAuth } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'));

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('認証が必要です');
    });

    it('データベースエラー時に 500 エラーを返す', async () => {
      const { requireAuth, isAdmin, isTestManager } = await import('@/app/lib/auth');

      vi.mocked(requireAuth).mockResolvedValue(mockUser as any);
      vi.mocked(isAdmin).mockReturnValue(true);
      vi.mocked(isTestManager).mockReturnValue(false);
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error('Database error')
      );

      const requestBody = {
        oem: 'OEM-A',
        model: 'Model-X',
        event: 'Event-1',
        variation: 'Var-1',
        destination: 'JP',
        specs: 'Specs-1',
        test_startdate: '2024-01-01',
        test_enddate: '2024-01-31',
        ng_plan_count: 10,
      };

      const request = new NextRequest(
        new URL('http://localhost:3000/api/test-groups'),
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('テストグループの作成に失敗しました');
    });
  });
});
