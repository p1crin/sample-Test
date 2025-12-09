'use client';

import ErrorPage from '@/components/ui/ErrorPage';
import { usePathname } from 'next/navigation';

export default function TestConductErrorPage({
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
      backLink={`/testGroup/${groupId}/testCase/${tid}/result`}
      backLinkLabel="テスト結果に戻る"
    />
  );
}
