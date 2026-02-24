'use client';

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";


export default function NotFound() {
  const router = useRouter();
  const handleToTestGroup = () => {
    router.push('/testGroup');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4 pb-2">ページが見つかりませんでした</h1>
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleToTestGroup}
            className="px-6 py-2 bg-stnly text-white font-semibold rounded-md hover:bg-stnly-light transition-colors"
          >
            テストグループ一覧へ戻る
          </Button>
        </div>
      </div>
    </div >
  );
}
