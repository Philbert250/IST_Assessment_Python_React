import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getPurchaseRequests } from '../../services/requests';
import DataTable from '../../components/common/DataTable/DataTable';
import { createPurchaseRequestColumns } from '../../components/common/DataTable/columns/purchaseRequestColumns';

const AllRequests = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch all requests (approvers and finance can see all)
  const { data: requestsData, isLoading, isError, error } = useQuery({
    queryKey: ['allPurchaseRequests', statusFilter, user?.id],
    queryFn: () => getPurchaseRequests(statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  const requests = useMemo(() => requestsData || [], [requestsData]);

  // Create table columns
  const columns = useMemo(() => createPurchaseRequestColumns(isDark), [isDark]);

  // Handle row click
  const handleRowClick = (request) => {
    navigate(`/requests/${request.id}`);
  };

  // Determine page title based on user role
  const getPageTitle = () => {
    const role = user?.role || 'staff';
    if (role === 'approver_level_1' || role === 'approver_level_2' || 
        role === 'approver-level-1' || role === 'approver-level-2') {
      return 'All Requests';
    } else if (role === 'finance') {
      return 'All Requests';
    } else if (role === 'admin' || user?.is_superuser) {
      return 'All Requests';
    }
    return 'All Requests';
  };

  const getPageDescription = () => {
    const role = user?.role || 'staff';
    if (role === 'approver_level_1' || role === 'approver_level_2' || 
        role === 'approver-level-1' || role === 'approver-level-2') {
      return 'View all purchase requests in the system';
    } else if (role === 'finance') {
      return 'View all purchase requests for financial review';
    } else if (role === 'admin' || user?.is_superuser) {
      return 'View and manage all purchase requests in the system';
    }
    return 'View all purchase requests';
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            {getPageTitle()}
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {getPageDescription()}
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
          emptyMessage="No purchase requests found"
          tableMeta={{ isDark }}
        />
      </div>
    </div>
  );
};

export default AllRequests;

