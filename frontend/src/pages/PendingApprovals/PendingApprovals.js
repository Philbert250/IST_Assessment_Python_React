import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getPurchaseRequests } from '../../services/requests';
import DataTable from '../../components/common/DataTable/DataTable';
import { createPurchaseRequestColumns } from '../../components/common/DataTable/columns/purchaseRequestColumns';
import ApprovalModal from '../../components/requests/ApprovalModal/ApprovalModal';

const PendingApprovals = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalAction, setApprovalAction] = useState(null); // 'approve' or 'reject'

  // Fetch pending requests (approvers see all requests, but we filter for pending)
  const { data: requestsData, isLoading, isError, error } = useQuery({
    queryKey: ['pendingApprovals', statusFilter, user?.id],
    queryFn: () => getPurchaseRequests({ status: 'pending' }),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes (shorter for approvals)
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });

  const requests = useMemo(() => requestsData || [], [requestsData]);

  // Helper function to check if user has already acted on a request
  const getUserApprovalAction = (request) => {
    if (!request.approvals || !user) return null;
    
    // Find approval by current user
    const userApproval = request.approvals.find(
      approval => approval.approver === user.id || approval.approver_username === user.username
    );
    
    return userApproval ? userApproval.action : null;
  };

  // Create table columns with action buttons
  const columns = useMemo(() => {
    const baseColumns = createPurchaseRequestColumns(isDark);
    
    // Replace the actions column with approve/reject buttons
    const actionColumnIndex = baseColumns.findIndex(col => col.id === 'actions');
    if (actionColumnIndex !== -1) {
      baseColumns[actionColumnIndex] = {
        id: 'actions',
        header: 'Actions',
        cell: ({ row, table }) => {
          const isDark = table.options.meta?.isDark || false;
          const request = row.original;
          const userAction = getUserApprovalAction(request);
          
          // If user has already acted, show their action
          if (userAction) {
            const isApproved = userAction === 'approved';
            return (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  isApproved
                    ? isDark
                      ? 'bg-green-900/30 text-green-400 border border-green-700'
                      : 'bg-green-50 text-green-600 border border-green-200'
                    : isDark
                    ? 'bg-red-900/30 text-red-400 border border-red-700'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  <i className={`fas ${isApproved ? 'fa-check' : 'fa-times'} mr-1`}></i>
                  You {isApproved ? 'Approved' : 'Rejected'}
                </span>
              </div>
            );
          }
          
          // Otherwise, show approve/reject buttons
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRequest(request);
                  setApprovalAction('approve');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isDark
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
                title="Approve request"
              >
                <i className="fas fa-check mr-1"></i> Approve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRequest(request);
                  setApprovalAction('reject');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isDark
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
                title="Reject request"
              >
                <i className="fas fa-times mr-1"></i> Reject
              </button>
            </div>
          );
        },
        enableSorting: false,
      };
    }
    
    return baseColumns;
  }, [isDark, user]);

  // Handle row click
  const handleRowClick = (request) => {
    navigate(`/requests/${request.id}`);
  };

  // Handle modal close
  const handleModalClose = () => {
    setSelectedRequest(null);
    setApprovalAction(null);
  };

  // Handle approval success
  const handleApprovalSuccess = () => {
    handleModalClose();
    // Query will refetch automatically
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            Pending Approvals
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Review and approve or reject purchase requests awaiting your approval
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
            <option value="pending">Pending</option>
            <option value="all">All Status</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Info Banner */}
      {requests.length === 0 && !isLoading && (
        <div className={`mb-6 p-4 rounded-lg ${
          isDark ? 'bg-blue-900/30 border border-blue-700' : 'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`text-sm ${
            isDark ? 'text-blue-300' : 'text-blue-700'
          }`}>
            <i className="fas fa-info-circle mr-2"></i>
            No pending approvals at this time. All requests have been reviewed.
          </p>
        </div>
      )}

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
          emptyMessage="No pending approvals found"
          tableMeta={{ isDark }}
        />
      </div>

      {/* Approval Modal */}
      {selectedRequest && approvalAction && (
        <ApprovalModal
          key={`${selectedRequest.id}-${approvalAction}`}
          request={selectedRequest}
          action={approvalAction}
          onClose={handleModalClose}
          onSuccess={handleApprovalSuccess}
        />
      )}
    </div>
  );
};

export default PendingApprovals;

