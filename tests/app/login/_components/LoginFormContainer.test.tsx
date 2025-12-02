import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { store } from '@/stores/store';
import { LoginFormContainer } from '@/app/login/_components/LoginFormContainer';
import { signIn, useSession } from 'next-auth/react';
import { vi } from 'vitest';
import React from 'react';

// next-authのmock
vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
  useSession: vi.fn(),
}));

// next/navigationのmock設定（useRouterを使用）
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
      get: vi.fn(),
    }),
  };
});

describe('LoginFormContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('レンダリング', () => {
    it('未認証時にログインフォームを表示する', () => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      } as any);

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument();
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument();
    });

    it('読込中状態でローディング画面を表示する', () => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'loading',
        update: vi.fn(),
      } as any);

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      expect(screen.getByText(/セッションを読み込み中/)).toBeInTheDocument();
    });
  });

  describe('ログイン処理', () => {
    beforeEach(() => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      } as any);
    });

    it('正しいメールアドレスとパスワードでログインできる', async () => {
      const user = userEvent.setup();
      vi.mocked(signIn).mockResolvedValue({
        error: null,
        status: 200,
        ok: true,
        url: '/testGroup',
      } as any);

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'ログイン' });

      await user.type(emailInput, 'admin@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(signIn).toHaveBeenCalledWith('credentials', {
          redirect: false,
          email: 'admin@example.com',
          password: 'password123',
        });
      });
    });

    it('不正なメールアドレスでログインを失敗させる', async () => {
      const user = userEvent.setup();
      vi.mocked(signIn).mockResolvedValue({
        error: 'CredentialsSignin',
        ok: false,
        url: null,
      } as any);

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'ログイン' });

      await user.type(emailInput, 'invalid@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/メールアドレスまたはパスワードが正しくありません/)).toBeInTheDocument();
      });
    });

    it('パスワードが空の場合はバリデーションエラーを表示する', async () => {
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const emailInput = screen.getByLabelText('メールアドレス');
      const submitButton = screen.getByRole('button', { name: 'ログイン' });

      await user.type(emailInput, 'admin@example.com');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/メールアドレスまたはパスワードが正しくありません/)).toBeInTheDocument();
      });
    });

    it('メールアドレスが空の場合はバリデーションエラーを表示する', async () => {
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'ログイン' });

      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/メールアドレスまたはパスワードが正しくありません/)).toBeInTheDocument();
      });
    });

    it('ネットワークエラー時にエラーメッセージを表示する', async () => {
      const user = userEvent.setup();
      vi.mocked(signIn).mockRejectedValue(new Error('Network error'));

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'ログイン' });

      await user.type(emailInput, 'admin@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/ログインに失敗しました/)).toBeInTheDocument();
      });
    });
  });

  describe('フォーム入力', () => {
    beforeEach(() => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      } as any);
    });

    it('メールアドレス入力フィールドに入力できる', async () => {
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const emailInput = screen.getByLabelText('メールアドレス') as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');

      expect(emailInput.value).toBe('test@example.com');
    });

    it('パスワード入力フィールドに入力できる', async () => {
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;
      await user.type(passwordInput, 'password123');

      expect(passwordInput.value).toBe('password123');
    });

    it('パスワード入力フィールドはtype="password"である', () => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      } as any);

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const passwordInput = screen.getByLabelText('パスワード') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('メールアドレス形式バリデーション', () => {
    beforeEach(() => {
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: vi.fn(),
      } as any);
    });

    it('不正なメールアドレス形式でバリデーションエラーを表示する', async () => {
      const user = userEvent.setup();

      render(
        <Provider store={store}>
          <LoginFormContainer />
        </Provider>
      );

      const emailInput = screen.getByLabelText('メールアドレス');
      const passwordInput = screen.getByLabelText('パスワード');
      const submitButton = screen.getByRole('button', { name: 'ログイン' });

      await user.type(emailInput, 'invalid-email');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/メールアドレスまたはパスワードが正しくありません/)).toBeInTheDocument();
      });
    });
  });
});
