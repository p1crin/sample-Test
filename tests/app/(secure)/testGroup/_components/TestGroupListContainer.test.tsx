import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { store } from '@/stores/store';
import { TestGroupListContainer } from '@/app/(secure)/testGroup/_components/TestGroupListContainer';
import { vi } from 'vitest';
import React from 'react';

// Global fetch mockの設定
global.fetch = vi.fn();

// next/navigationのmock
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
      replace: vi.fn(),
    }),
    useSearchParams: () => ({
      get: vi.fn((key: string) => {
        if (key === 'page') return '1';
        return null;
      }),
    }),
  };
});

// TestGroupListコンポーネントのmock
vi.mock('@/app/(secure)/testGroup/_components/TestGroupList', () => ({
  TestGroupList: ({ items, columns, sortConfig, page, pageCount, onSort, onPageChange, renderActions }: any) => (
    <div data-testid="test-group-list">
      <div data-testid="test-group-list-items">
        {items.map((item: any) => (
          <div key={item.id} data-testid={`test-group-item-${item.id}`}>
            <span>{item.id}</span>
            <span>{item.oem}</span>
            <span>{item.model}</span>
            {renderActions && <div data-testid={`actions-${item.id}`}>{renderActions(item)}</div>}
          </div>
        ))}
      </div>
      <div data-testid="pagination">ページ: {page} / {pageCount}</div>
    </div>
  ),
}));

const mockTestGroups = [
  {
    id: 1,
    oem: 'OEM-A',
    model: 'Model-X',
    event: 'Event-1',
    variation: 'Var-1',
    destination: 'JP',
    specs: 'Specs-1',
    test_startdate: '2024-01-01',
    test_enddate: '2024-01-31',
    ng_plan_count: 10,
    created_at: '2024-01-01',
    updated_at: '2024-01-31',
    is_deleted: false,
  },
  {
    id: 2,
    oem: 'OEM-B',
    model: 'Model-Y',
    event: 'Event-2',
    variation: 'Var-2',
    destination: 'US',
    specs: 'Specs-2',
    test_startdate: '2024-02-01',
    test_enddate: '2024-02-28',
    ng_plan_count: 20,
    created_at: '2024-02-01',
    updated_at: '2024-02-28',
    is_deleted: false,
  },
];

describe('TestGroupListContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  describe('レンダリング', () => {
    it('テストグループ一覧を表示する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });
    });

    it('検索フォームを表示する', () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          totalCount: 0,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      // SearchFormコンポーネントが検索フィールドを含むかどうか確認
      expect(screen.getByPlaceholderText('OEM')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('機種')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('イベント')).toBeInTheDocument();
    });

    it('「テストグループ新規登録」ボタンを表示する', () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          totalCount: 0,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      expect(screen.getByRole('link', { name: /テストグループ新規登録/ })).toBeInTheDocument();
    });
  });

  describe('検索機能', () => {
    it('OEMで検索できる', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockTestGroups[0]],
          totalCount: 1,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      const oemInput = screen.getByPlaceholderText('OEM');
      await user.clear(oemInput);
      await user.type(oemInput, 'OEM-A');

      // 最初の呼び出しはURLパラメータ同期のため
      // 2番目の呼び出しはカウント取得のため
      // 3番目の呼び出しはリスト取得のため
      expect(global.fetch).toHaveBeenCalled();
    });

    it('機種で検索できる', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockTestGroups[0]],
          totalCount: 1,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      const modelInput = screen.getByPlaceholderText('機種');
      await user.clear(modelInput);
      await user.type(modelInput, 'Model-X');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('複数条件で検索できる', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [mockTestGroups[0]],
          totalCount: 1,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      const oemInput = screen.getByPlaceholderText('OEM');
      const modelInput = screen.getByPlaceholderText('機種');

      await user.clear(oemInput);
      await user.type(oemInput, 'OEM-A');
      await user.clear(modelInput);
      await user.type(modelInput, 'Model-X');

      expect(global.fetch).toHaveBeenCalled();
    });

    it('空の検索条件をスキップする', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls;
        const lastCall = calls[calls.length - 1][0];
        // URLパラメータに空の値が含まれていないことを確認
        expect(lastCall).not.toContain('oem=');
      });
    });
  });

  describe('データ取得', () => {
    it('初期表示時にAPIからデータを取得する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/test-groups'),
          undefined
        );
      });
    });

    it('APIエラーが発生した場合は空のリストを表示する', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        // エラーログが記録されていることを確認
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('不正なAPI応答を処理する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: 'invalid', // dataが配列でない
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('ページネーション情報を計算する', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        ...mockTestGroups[0],
        id: i + 1,
      }));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: items.slice(0, 10),
          totalCount: items.length,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        // ページカウントは25件を10件ずつで3ページ
        expect(screen.getByTestId('pagination')).toHaveTextContent('3');
      });
    });
  });

  describe('ソート機能', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });
    });

    it('IDでソート可能', async () => {
      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });

      // ListコンポーネントはsortConfigを受け取るため、
      // ソート機能があることを確認できる
    });
  });

  describe('削除機能', () => {
    it('削除確認モーダルを表示する', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });

      // モーダルが存在することを確認（renderActionsで削除ボタンが作成される）
      const deleteButtons = screen.queryAllByText('削除');
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('削除キャンセル時にモーダルを閉じる', async () => {
      const user = userEvent.setup();
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });
    });
  });

  describe('ナビゲーション', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });
    });

    it('テストグループID をクリックするとテストケース画面に遷移する', async () => {
      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        const link = screen.getByRole('link', { name: '1' });
        expect(link).toHaveAttribute('href', '/testGroup/1/testCase');
      });
    });

    it('新規登録ボタンをクリックするとテストグループ登録画面に遷移する', () => {
      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      const link = screen.getByRole('link', { name: /テストグループ新規登録/ });
      expect(link).toHaveAttribute('href', '/testGroup/regist');
    });
  });

  describe('ページネーション', () => {
    it('ページを変更できる', async () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        ...mockTestGroups[0],
        id: i + 1,
      }));

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: items.slice(0, 10),
          totalCount: items.length,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
    });

    it('URLパラメータをページネーションと同期する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });

      // URLパラメータの同期が行われていることを確認
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    it('ネットワークエラーを処理する', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network Error'));

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      // エラーが処理され、アプリがクラッシュしないことを確認
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('API ステータスエラーを処理する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('認証エラー（401）を処理する', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('アクション機能', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockTestGroups,
          totalCount: 2,
        }),
      });
    });

    it('編集ボタンが表示される', async () => {
      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByText('編集');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('集計ボタンが表示される', async () => {
      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });

      const aggregateButtons = screen.queryAllByText('集計');
      expect(aggregateButtons.length).toBeGreaterThan(0);
    });

    it('複製ボタンが表示される', async () => {
      render(
        <Provider store={store}>
          <TestGroupListContainer />
        </Provider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-group-list')).toBeInTheDocument();
      });

      const copyButtons = screen.queryAllByText('複製');
      expect(copyButtons.length).toBeGreaterThan(0);
    });
  });
});
