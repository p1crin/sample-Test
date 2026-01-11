'use client';
import { Button } from './button';

export default function ForbiddenUI() {
  const handleToTestGroup = () => {
    window.location.href = '/testGroup';
  }
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">アクセス権限がありません</h1>
        </div>

        <p className="text-gray-600 mb-8 max-w-md mx-auto">このページにアクセスする権限がありません。</p>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleToTestGroup}
            className="px-6 py-2 bg-stnly text-white font-semibold rounded-md hover:bg-stnly-light transition-colors"
          >
            テストグループ一覧へ戻る
          </Button>
        </div>
      </div>
    </div>
  );
}