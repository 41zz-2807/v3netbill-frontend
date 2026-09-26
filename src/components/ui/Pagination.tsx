export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showTotal?: boolean
  totalItems?: number
  itemsPerPage?: number
  siblingCount?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showTotal = true,
  totalItems,
  itemsPerPage,
  siblingCount = 1,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | 'ellipsis')[] = []
  const leftBound = Math.max(1, currentPage - siblingCount)
  const rightBound = Math.min(totalPages, currentPage + siblingCount)

  // First page
  pages.push(1)

  // Ellipsis after first
  if (leftBound > 2) {
    pages.push('ellipsis')
  } else if (leftBound === 2) {
    pages.push(2)
  }

  // Middle pages
  for (let i = Math.max(2, leftBound); i <= Math.min(totalPages - 1, rightBound); i++) {
    if (i !== 1 && i !== totalPages) {
      pages.push(i)
    }
  }

  // Ellipsis before last
  if (rightBound < totalPages - 1) {
    pages.push('ellipsis')
  } else if (rightBound === totalPages - 1) {
    pages.push(totalPages - 1)
  }

  // Last page
  if (totalPages > 1) {
    pages.push(totalPages)
  }

  return (
    <nav className="flex items-center justify-between px-4 py-3 border-t border-neutral-200" aria-label="Pagination">
      {showTotal && totalItems && (
        <div className="text-sm text-neutral-500">
          Menampilkan {Math.min((currentPage - 1) * (itemsPerPage || 10) + 1, totalItems)}–
            {Math.min(currentPage * (itemsPerPage || 10), totalItems)} dari {totalItems}
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="First page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {pages.map((page, i) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-neutral-400">…</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-primary text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Last page"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7m-8 14l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  )
}