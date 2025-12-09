'use client';

import ErrorPage from '@/components/ui/ErrorPage';
import { usePathname } from 'next/navigation';

export default function TestCaseRegistErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const groupId = pathname.split('/')[2];

  return (
    <ErrorPage
      error={error}
      reset={reset}
      backLink={`/testGroup/${groupId}/testCase`}
      backLinkLabel="テストケース一覧に戻る"
    />
  );
}
