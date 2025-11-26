'use client';
import { cn } from '@/utils/utils';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  return (
    <nav className={cn('flex items-center gap-2', className)} aria-label="pagination">
      <button
        className="px-3 py-1 rounded border text-white bg-[#FF5611] disabled:opacity-50 transition-transform duration-150 hover:scale-105 active:scale-95"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
      >
        前へ
      </button>
      {Array.from({ length: pageCount }, (_, i) => (
        <button
          key={i + 1}
          className={cn(
            'px-3 py-1 rounded border',
            page === i + 1 ? 'text-white bg-[#FF5611]' : 'bg-white text-[#FF5611]',
            'transition-transform duration-150 hover:scale-105 active:scale-95'
          )}
          onClick={() => onPageChange(i + 1)}
        >
          {i + 1}
        </button>
      ))}
      <button
        className="px-3 py-1 rounded border bg-white text-[#FF5611] disabled:opacity-50 transition-transform duration-150 hover:scale-105 active:scale-95"
        onClick={() => onPageChange(page + 1)}
        disabled={page === pageCount}
      >
        次へ
      </button>
    </nav>
  );
}
