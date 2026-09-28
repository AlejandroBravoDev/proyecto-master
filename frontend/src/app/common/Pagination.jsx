import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const ITEMS_PER_PAGE = 15;

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = ITEMS_PER_PAGE,
  onPageChange,
}) {
  if (totalItems <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = (safePage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safePage * itemsPerPage, totalItems);

  // Build visible page numbers list with ellipsis for large page counts
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [1];
    if (safePage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, safePage - 1);
    const end = Math.min(totalPages - 1, safePage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safePage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 text-xs">
      {/* Range Counter */}
      <div className="text-slate-500 font-medium">
        Mostrando <span className="font-bold text-[#584235]">{startItem}</span>–
        <span className="font-bold text-[#584235]">{endItem}</span> de{' '}
        <span className="font-bold text-[#584235]">{totalItems}</span> registros
      </div>

      {/* Controls: Anterior, Números de página, Siguiente */}
      <div className="flex items-center space-x-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[#584235] font-bold hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Anterior</span>
        </button>

        <div className="flex items-center space-x-1">
          {pageNumbers.map((page, index) =>
            page === '...' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-2 py-1 text-slate-400 font-bold select-none"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`min-w-[30px] h-[30px] px-2 rounded-xl font-bold transition-all cursor-pointer ${
                  page === safePage
                    ? 'bg-[#E63946] text-white shadow-sm shadow-red-500/20'
                    : 'bg-white border border-slate-200 text-[#584235] hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[#584235] font-bold hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
