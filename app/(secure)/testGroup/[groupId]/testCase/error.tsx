'use client';

import ErrorPage from '@/components/ui/ErrorPage';

export default function TestCaseErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      backLink="/testGroup"
      backLinkLabel="テストグループ一覧に戻る"
    />
  );
}
