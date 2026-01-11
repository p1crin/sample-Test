'use client';

import ErrorPage from '@/components/ui/errorPage';
import { usePathname } from 'next/navigation';
export default function ProofLinkErrorPage({
  error,
}: {
  error: Error & { digest?: string };
}) {
  // 現在の画面のパスを取得
  const pathname = usePathname();
  return (
    <ErrorPage
      error={error}
      pathname={pathname}
    />
  );
}