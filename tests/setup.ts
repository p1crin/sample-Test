import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// react-day-pickerのCSSをテスト時はmock
vi.mock('react-day-picker/dist/style.css', () => ({}));

// next/navigationのuseRouter, useSearchParamsをvitestのvi.fn()でモック
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    basePath: '',
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => {
      if (key === 'id') return '1';
      return null;
    }),
  }),
}));

// app/globals.css をテスト時はmock（Vite/VitestでCSS import error回避）
vi.mock('@/app/globals.css', () => ({}));

afterAll(() => {
  vi.restoreAllMocks();
});
