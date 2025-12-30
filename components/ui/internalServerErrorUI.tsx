'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function InternalServerErrorUI() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">エラーが発生しました</h1>
        </div>

        <p className="text-gray-600 mb-8 max-w-md mx-auto">申し訳ございませんが、エラーが発生しました。</p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-2 bg-stnly text-white font-semibold rounded-md hover:bg-stnly-light transition-colors"
          >
            テストグループ一覧へ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}