'use client';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-md p-8">
          <div className="flex flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold">404 Not Found</h2>
            <p>ページが見つかりませんでした。</p>
          </div>
        </div>
      </main>
    </div>
  );
}
