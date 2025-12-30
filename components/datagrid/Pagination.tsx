'use client';
import { cn } from '@/utils/utils';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  const maxButtonsToShow = 7;
  const halfButtons = Math.floor(maxButtonsToShow / 2);

  let startPage = Math.max(1, page - halfButtons);
  let endPage = Math.min(pageCount, page + halfButtons);

  if (endPage - startPage + 1 < maxButtonsToShow) {
    if (startPage === 1) {
      endPage = Math.min(pageCount, startPage + maxButtonsToShow - 1);
    } else if (endPage === pageCount) {
      startPage = Math.max(1, endPage - maxButtonsToShow + 1);
    }
  }

  const pageButtons = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  return (
    <nav className={cn('flex items-center gap-2', className)} aria-label="pagination">
      <button
        className="px-3 py-1 rounded border text-white bg-stnly disabled:opacity-50 transition-transform duration-150 hover:scale-105 active:scale-95"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        前へ
      </button>

      {startPage > 1 && (
        <>
          <button
            className="px-3 py-1 rounded border bg-white text-stnly transition-transform duration-150 hover:scale-105 active:scale-95"
            onClick={() => onPageChange(1)}
          >
            1
          </button>
          {startPage > 2 && <span className="px-2">...</span>}
        </>
      )}

      {pageButtons.map((pageNum) => (
        <button
          key={pageNum}
          className={cn(
            'px-3 py-1 rounded border',
            page === pageNum ? 'text-white bg-stnly' : 'bg-white text-stnly',
            'transition-transform duration-150 hover:scale-105 active:scale-95'
          )}
          onClick={() => onPageChange(pageNum)}
        >
          {pageNum}
        </button>
      ))}

      {endPage < pageCount && (
        <>
          {endPage < pageCount - 1 && <span className="px-2">...</span>}
          <button
            className="px-3 py-1 rounded border bg-white text-stnly transition-transform duration-150 hover:scale-105 active:scale-95"
            onClick={() => onPageChange(pageCount)}
          >
            {pageCount}
          </button>
        </>
      )}

      <button
        className="px-3 py-1 rounded border bg-white text-stnly disabled:opacity-50 transition-transform duration-150 hover:scale-105 active:scale-95"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
      >
        次へ
      </button>
    </nav>
  );
}