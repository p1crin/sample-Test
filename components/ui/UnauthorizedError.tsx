'use client';

import Link from 'next/link';

interface UnauthorizedErrorProps {
  message?: string;
  backLink?: string;
  backLinkLabel?: string;
}

export default function UnauthorizedError({
  message = 'このページにアクセスする権限がありません。',
  backLink = '/testGroup',
  backLinkLabel = 'テストグループ一覧に戻る',
}: UnauthorizedErrorProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-6xl font-bold text-gray-900 mb-2">403</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">アクセス権限がありません！</h2>
        </div>

        <p className="text-gray-600 mb-8 max-w-md mx-auto">{message}</p>

        <div className="flex gap-4 justify-center">
          <Link
            href={backLink}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
          >
            {backLinkLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
