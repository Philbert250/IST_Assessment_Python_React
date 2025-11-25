import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getPurchaseRequests, getRequestTypes } from '../../services/requests';
import DataTable from '../../components/common/DataTable/DataTable';
import { createPurchaseRequestColumns } from '../../components/common/DataTable/columns/purchaseRequestColumns';

const ApprovedRequests = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('approved');
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month

  // Fetch request types for filter
  const { data: requestTypesData } = useQuery({
    queryKey: ['requestTypes'],
    queryFn: getRequestTypes,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const requestTypes = useMemo(() => requestTypesData || [], [requestTypesData]);

  // Fetch approved requests
  const { data: requestsData, isLoading, isError, error } = useQuery({
    queryKey: ['approvedRequests', statusFilter, requestTypeFilter, dateFilter, user?.id],
    queryFn: () => {
      const params = { status: 'approved' };
      
      // Add request type filter
      if (requestTypeFilter !== 'all') {
        params.request_type = requestTypeFilter;
      }
      
      return getPurchaseRequests(params);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for finance)
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const requests = useMemo(() => {
    let filtered = requestsData || [];
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(request => {
        const requestDate = new Date(request.created_at);
        switch (dateFilter) {
          case 'today':
            return requestDate.toDateString() === now.toDateString();
          case 'week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return requestDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return requestDate >= monthAgo;
          default:
            return true;
        }
      });
    }
    
    return filtered;
  }, [requestsData, dateFilter]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalAmount = requests.reduce((sum, req) => sum + parseFloat(req.amount || 0), 0);
    const totalCount = requests.length;
    const withPO = requests.filter(req => req.purchase_order).length;
    const withReceipt = requests.filter(req => req.receipt).length;
    
    return {
      totalAmount,
      totalCount,
      withPO,
      withReceipt,
    };
  }, [requests]);

  // Create table columns with download PO action
  const columns = useMemo(() => {
    const baseColumns = createPurchaseRequestColumns(isDark);
    
    // Add download PO button to actions column
    const actionColumnIndex = baseColumns.findIndex(col => col.id === 'actions');
    if (actionColumnIndex !== -1) {
      baseColumns[actionColumnIndex] = {
        id: 'actions',
        header: 'Actions',
        cell: ({ row, table }) => {
          const isDark = table.options.meta?.isDark || false;
          const request = row.original;
          
          const getFileUrl = (filePath) => {
            if (!filePath) return null;
            if (filePath.startsWith('http')) return filePath;
            // Use same logic as api.js - detect localhost for local development
            const isLocalhost = window.location.hostname === 'localhost' || 
                                window.location.hostname === '127.0.0.1' ||
                                window.location.hostname === '';
            let baseURL;
            if (isLocalhost) {
              baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            } else {
              baseURL = window.APP_CONFIG?.API_BASE_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            }
            return `${baseURL}${filePath}`;
          };
          
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/requests/${request.id}`);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
                title="View details"
              >
                <i className="fas fa-eye mr-1"></i> View
              </button>
              {request.purchase_order && (
                <a
                  href={getFileUrl(request.purchase_order)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    isDark
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                  title="Download Purchase Order"
                >
                  <i className="fas fa-download mr-1"></i> PO
                </a>
              )}
            </div>
          );
        },
        enableSorting: false,
      };
    }
    
    return baseColumns;
  }, [isDark, navigate]);

  // Handle row click
  const handleRowClick = (request) => {
    navigate(`/requests/${request.id}`);
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0 RWF';
    return new Intl.NumberFormat('en-RW', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount)) + ' RWF';
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            Approved Requests
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            View and manage approved purchase requests
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Total Approved
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                {statistics.totalCount}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              isDark ? 'bg-blue-900/30' : 'bg-blue-100'
            }`}>
              <i className={`fas fa-check-circle text-2xl ${
                isDark ? 'text-blue-400' : 'text-blue-600'
              }`}></i>
            </div>
          </div>
        </div>

        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Total Amount
              </p>
              <p className={`text-xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                {formatCurrency(statistics.totalAmount)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              isDark ? 'bg-green-900/30' : 'bg-green-100'
            }`}>
              <i className={`fas fa-money-bill-wave text-2xl ${
                isDark ? 'text-green-400' : 'text-green-600'
              }`}></i>
            </div>
          </div>
        </div>

        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                With PO
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                {statistics.withPO}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              isDark ? 'bg-purple-900/30' : 'bg-purple-100'
            }`}>
              <i className={`fas fa-file-pdf text-2xl ${
                isDark ? 'text-purple-400' : 'text-purple-600'
              }`}></i>
            </div>
          </div>
        </div>

        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                With Receipt
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                {statistics.withReceipt}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${
              isDark ? 'bg-yellow-900/30' : 'bg-yellow-100'
            }`}>
              <i className={`fas fa-receipt text-2xl ${
                isDark ? 'text-yellow-400' : 'text-yellow-600'
              }`}></i>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
      }`}>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Request Type
            </label>
            <select
              className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-gray-300'
                  : 'border-gray-300 text-gray-600 bg-white'
              }`}
              value={requestTypeFilter}
              onChange={(e) => setRequestTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {requestTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Date Range
            </label>
            <select
              className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${
                isDark
                  ? 'bg-gray-800 border-gray-700 text-gray-300'
                  : 'border-gray-300 text-gray-600 bg-white'
              }`}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
      }`}>
        <DataTable
          data={requests}
          columns={columns}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRowClick={handleRowClick}
          enableSorting={true}
          enableFiltering={true}
          enablePagination={true}
          pageSize={10}
          emptyMessage="No approved requests found"
          tableMeta={{ isDark }}
        />
      </div>
    </div>
  );
};

export default ApprovedRequests;

