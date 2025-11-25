import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getPurchaseRequests } from '../../services/requests';
import DataTable from '../../components/common/DataTable/DataTable';
import { createPurchaseRequestColumns } from '../../components/common/DataTable/columns/purchaseRequestColumns';

const MyRequests = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch purchase requests (filtered by creator for staff)
  const { data: requestsData, isLoading, isError, error } = useQuery({
    queryKey: ['myPurchaseRequests', statusFilter, user?.id],
    queryFn: () => getPurchaseRequests(statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const requests = requestsData || [];

  // Create table columns
  const columns = useMemo(() => createPurchaseRequestColumns(isDark), [isDark]);

  // Handle row click
  const handleRowClick = (request) => {
    navigate(`/requests/${request.id}`);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            My Purchase Requests
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            View and manage all your purchase requests
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            className={`border rounded-lg px-3 py-2 text-sm transition-colors ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-gray-300'
                : 'border-gray-300 text-gray-600 bg-white'
            }`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            onClick={() => navigate('/requests/create')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
          >
            <i className="fas fa-plus"></i> New Request
          </button>
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
          emptyMessage="No purchase requests found. Create your first request!"
          tableMeta={{ isDark }}
        />
      </div>
    </div>
  );
};

export default MyRequests;

