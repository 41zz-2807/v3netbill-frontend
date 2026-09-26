export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showTotal?: boolean
  totalItems?: number
  itemsPerPage?: number
  siblingCount?: number
}

/** Nomor halaman yang ditampilkan: pertama, terakhir, dan jendela di sekitar
 *  halaman aktif. Set dipakai agar tidak ada nomor yang dobel. */
function nomorTampil(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): Set<number> {
  const hasil = new Set<number>()
  const mulai = Math.max(1, currentPage - siblingCount)
  const selesai = Math.min(totalPages, currentPage + siblingCount)
  for (let n = mulai; n <= selesai; n++) hasil.add(n)
  hasil.add(1)
  hasil.add(totalPages)
  return hasil
}

/** Sisipkan 'ellipsis' pada celah antar nomor. Celah selisih 1 ditampilkan
 *  penuh, selisih 2 cukup menampilkan satu nomor di antaranya, selisih lebih
 *  besar memakai ellipsis. */
function denganEllipsis(nomor: number[]): (number | 'ellipsis')[] {
  const urut = [...nomor].sort((a, b) => a - b)
  const hasil: (number | 'ellipsis')[] = []
  for (let i = 0; i < urut.length; i++) {
    if (i > 0) {
      const selisih = urut[i] - urut[i - 1]
      if (selisih === 1) {
        hasil.push(urut[i])
      } else if (selisih === 2) {
        hasil.push(urut[i - 1] + 1, urut[i])
      } else {
        hasil.push('ellipsis', urut[i])
      }
    } else {
      hasil.push(urut[i])
    }
  }
  return hasil
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

  const pages = denganEllipsis([
    ...nomorTampil(currentPage, totalPages, siblingCount),
  ])

  return (
    <nav className="flex items-center justify-between px-4 py-3 border-t border-neutral-200" aria-label="Pagination">
      {showTotal && totalItems !== undefined && (
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
              aria-current={currentPage === page ? 'page' : undefined}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-slate-900 text-white'
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
