import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useTheme } from '../../../context/ThemeContext';

const DataTable = ({
  data = [],
  columns = [],
  isLoading = false,
  isError = false,
  error = null,
  onRowClick = null,
  enableSorting = true,
  enableFiltering = true,
  enablePagination = true,
  pageSize = 10,
  emptyMessage = 'No data available',
  tableMeta = {},
}) => {
  const { isDark } = useTheme();
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState([]);

  // Memoize table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    initialState: {
      pagination: {
        pageSize: pageSize,
      },
    },
    enableSorting,
    enableFiltering,
    meta: {
      isDark,
      ...tableMeta,
    },
  });

  return (
    <div className="w-full">
      {/* Search/Filter Bar */}
      {enableFiltering && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search..."
              className={`w-full px-4 py-2 pl-10 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}></i>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <i className="fas fa-spinner fa-spin text-3xl mb-2"></i>
            <p>Loading data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className={`p-4 rounded-lg mb-4 ${
          isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            <i className="fas fa-exclamation-circle mr-2"></i>
            Error loading data: {error?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr
                    key={headerGroup.id}
                    className={`border-b ${
                      isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className={`py-3 px-4 text-left ${
                          isDark ? 'text-gray-400' : 'text-gray-500'
                        } ${
                          enableSorting && header.column.getCanSort()
                            ? 'cursor-pointer select-none hover:bg-opacity-50'
                            : ''
                        } ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        } transition-colors`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {enableSorting && header.column.getCanSort() && (
                            <span className="text-xs">
                              {{
                                asc: <i className="fas fa-sort-up"></i>,
                                desc: <i className="fas fa-sort-down"></i>,
                              }[header.column.getIsSorted()] ?? (
                                <i className={`fas fa-sort ${isDark ? 'text-gray-600' : 'text-gray-400'}`}></i>
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className={`py-12 text-center ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      <i className="fas fa-inbox text-3xl mb-2 block"></i>
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b transition-colors ${
                        isDark
                          ? 'border-gray-700 hover:bg-gray-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      } ${
                        onRowClick ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => onRowClick && onRowClick(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`py-3 px-4 ${
                            isDark ? 'text-gray-300' : 'text-gray-800'
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {enablePagination && table.getPageCount() > 1 && (
            <div className={`flex items-center justify-between mt-4 pt-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length
                )}{' '}
                of {table.getFilteredRowModel().rows.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    !table.getCanPreviousPage()
                      ? isDark
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-angle-double-left"></i>
                </button>
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    !table.getCanPreviousPage()
                      ? isDark
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-angle-left"></i>
                </button>
                <span className={`px-3 py-1 text-sm ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </span>
                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    !table.getCanNextPage()
                      ? isDark
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-angle-right"></i>
                </button>
                <button
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    !table.getCanNextPage()
                      ? isDark
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <i className="fas fa-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DataTable;

