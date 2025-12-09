'use client';

import ErrorPage from '@/components/ui/ErrorPage';
import { usePathname } from 'next/navigation';

export default function TestCaseEditErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const groupId = pathname.split('/')[2];
  const tid = pathname.split('/')[4];

  return (
    <ErrorPage
      error={error}
      reset={reset}
      backLink={`/testGroup/${groupId}/testCase/${tid}`}
      backLinkLabel="テストケース詳細に戻る"
    />
  );
}
