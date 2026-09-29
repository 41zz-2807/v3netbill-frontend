import ProgressBar from './ProgressBar.tsx'
import type { HTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => ReactNode
  className?: string
  headerClassName?: string
  sortable?: boolean
  width?: string
}

export interface TableProps<T> extends HTMLAttributes<HTMLTableElement> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  striped?: boolean
  hoverable?: boolean
  bordered?: boolean
  emptyMessage?: string
  loading?: boolean
  onRowClick?: (row: T) => void
}

export const Table = forwardRef<HTMLTableElement, TableProps<any>>(
  (
    {
      columns,
      data,
      keyExtractor,
      striped = true,
      hoverable = true,
      bordered = true,
      emptyMessage = 'Tidak ada data',
      loading = false,
      onRowClick,
      className = '',
      ...props
    },
    ref
  ) => {
    if (loading) {
      return (
        <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white" role="status" aria-label="Loading data">
          <div className="min-w-full">
            <table className="w-full" ref={ref} {...props}>
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={`px-4 py-3 text-left text-sm font-medium ${col.headerClassName || ''}`} style={{ width: col.width }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-neutral-400">
                    <div className="mx-auto max-w-xs">
                      <ProgressBar label="Memuat data" value={null} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (data.length === 0) {
      return (
        <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <div className="min-w-full p-8 text-center text-neutral-400">{emptyMessage}</div>
        </div>
      )
    }

    return (
      <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table ref={ref} className="w-full min-w-max" {...props}>
          <thead className="bg-neutral-50 text-neutral-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`
                    px-4 py-3 text-left text-sm font-medium
                    ${bordered ? 'border-b border-neutral-200' : ''}
                    ${col.headerClassName || ''}
                  `}
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((row, rowIndex) => (
              <tr
                key={keyExtractor(row)}
                className={`
                  ${hoverable ? 'hover:bg-neutral-50' : ''}
                  ${striped && rowIndex % 2 === 1 ? 'bg-neutral-50/50' : ''}
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      px-4 py-3 text-sm text-neutral-900
                      ${col.className || ''}
                    `}
                  >
                    {col.render ? col.render(row, rowIndex) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
)

Table.displayName = 'Table'

export interface TableSkeletonProps {
  columns: number
  rows?: number
}

export function TableSkeleton({ columns, rows = 5 }: TableSkeletonProps) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full min-w-max">
        <thead className="bg-neutral-50 text-neutral-500">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left text-sm font-medium">
                <div className="h-4 w-3/4 bg-neutral-200 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3 text-sm">
                  <div className="h-4 w-full bg-neutral-100 rounded animate-pulse" style={{ width: '60%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}