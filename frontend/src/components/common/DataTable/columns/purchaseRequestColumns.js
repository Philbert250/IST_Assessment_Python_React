import React from 'react';

/**
 * Format currency (Rwandan Francs)
 */
const formatCurrency = (amount) => {
  if (!amount) return '0 RWF';
  return new Intl.NumberFormat('en-RW', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount)) + ' RWF';
};

/**
 * Format date
 */
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Get status badge component
 */
const StatusBadge = ({ status, statusDisplay, isDark }) => {
  const getStatusClasses = (status) => {
    switch (status) {
      case 'pending':
        return isDark 
          ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700' 
          : 'bg-yellow-50 text-yellow-600 border border-yellow-200';
      case 'approved':
        return isDark 
          ? 'bg-green-900/30 text-green-400 border border-green-700' 
          : 'bg-green-50 text-green-600 border border-green-200';
      case 'rejected':
        return isDark 
          ? 'bg-red-900/30 text-red-400 border border-red-700' 
          : 'bg-red-50 text-red-600 border border-red-200';
      default:
        return '';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return 'fa-clock';
      case 'approved':
        return 'fa-check-circle';
      case 'rejected':
        return 'fa-times-circle';
      default:
        return 'fa-info-circle';
    }
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusClasses(status)}`}>
      <i className={`fas ${getStatusIcon(status)} mr-1`}></i>
      {statusDisplay || status}
    </span>
  );
};

/**
 * Purchase Request table columns configuration
 */
export const createPurchaseRequestColumns = (isDark = false) => [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="font-medium">{row.original.title || 'N/A'}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'request_type_name',
    header: 'Request Type',
    cell: ({ row }) => {
      const requestType = row.original.request_type_name || row.original.request_type?.name || 'N/A';
      return <span>{requestType}</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <span className="font-semibold">{formatCurrency(row.original.amount)}</span>
    ),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const amountA = parseFloat(rowA.original.amount || 0);
      const amountB = parseFloat(rowB.original.amount || 0);
      return amountA - amountB;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row, table }) => {
      // Get isDark from table meta or use default
      const isDark = table.options.meta?.isDark || false;
      return (
        <StatusBadge
          status={row.original.status}
          statusDisplay={row.original.status_display}
          isDark={isDark}
        />
      );
    },
    enableSorting: true,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: 'created_by_username',
    header: 'Created By',
    cell: ({ row }) => (
      <span>{row.original.created_by_username || 'N/A'}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    cell: ({ row }) => (
      <span>{formatDate(row.original.created_at)}</span>
    ),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const dateA = new Date(rowA.original.created_at);
      const dateB = new Date(rowB.original.created_at);
      return dateA - dateB;
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      const isDark = table.options.meta?.isDark || false;
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Action will be handled by parent component
          }}
          className={`transition-colors ${
            isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <i className="fas fa-ellipsis-h"></i>
        </button>
      );
    },
    enableSorting: false,
  },
];

