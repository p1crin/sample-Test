'use client';

import ErrorPage from '@/components/ui/errorPage';

export default function TestCaseRegistErrorPage({
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
      backLink={`/testGroup`}
      backLinkLabel="戻る"
    />
  );
}