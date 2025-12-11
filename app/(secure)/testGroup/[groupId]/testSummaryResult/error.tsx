'use client';

import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TestSummaryResultErrorPage({
  error,
  reset,
}: ErrorPageProps) {
  const isForbidden = error.message.includes('Forbidden');
  const isUnauthorized = error.message.includes('Unauthorized');

  const statusCode = isForbidden ? 403 : isUnauthorized ? 401 : 500;
  const statusMessage = isForbidden
    ? 'アクセス権限がありません'
    : isUnauthorized
    ? 'ログインが必要です'
    : 'エラーが発生しました';

  const description = isForbidden
    ? 'このテストグループの集計結果を表示する権限がありません。'
    : isUnauthorized
    ? 'ログインし直してください。'
    : '申し訳ございませんが、エラーが発生しました。';

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-6xl font-bold text-gray-900 mb-2">{statusCode}</h1>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">{statusMessage}</h2>
        </div>

        <p className="text-gray-600 mb-8 max-w-md mx-auto">{description}</p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/testGroup"
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors"
          >
            テストグループ一覧に戻る
          </Link>
          <button
            onClick={reset}
            className="px-6 py-2 bg-gray-300 text-gray-900 font-semibold rounded-md hover:bg-gray-400 transition-colors"
          >
            やり直す
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mt-8 text-left bg-gray-100 p-4 rounded-md max-w-md mx-auto">
            <p className="text-xs font-semibold text-gray-700 mb-2">エラー詳細（開発環境のみ）:</p>
            <p className="text-xs text-gray-600 font-mono break-words">{error.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
