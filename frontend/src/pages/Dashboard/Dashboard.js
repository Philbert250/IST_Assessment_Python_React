import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getPurchaseRequests } from '../../services/requests';
import DataTable from '../../components/common/DataTable/DataTable';
import { createPurchaseRequestColumns } from '../../components/common/DataTable/columns/purchaseRequestColumns';

const Dashboard = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('all');
  const currentDate = new Date().toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  // Fetch purchase requests based on user role
  const { data: requestsData, isLoading, isError, error } = useQuery({
    queryKey: ['purchaseRequests', statusFilter],
    queryFn: () => getPurchaseRequests(statusFilter !== 'all' ? { status: statusFilter } : {}),
    enabled: !!user, // Only fetch when user is available
  });

  const requests = useMemo(() => requestsData || [], [requestsData]);

  // Calculate statistics from real data
  const statistics = useMemo(() => {
    const totalRequests = requests.length;
    const pendingRequests = requests.filter(r => r.status === 'pending').length;
    const approvedRequests = requests.filter(r => r.status === 'approved').length;
    const rejectedRequests = requests.filter(r => r.status === 'rejected').length;
    
    // Calculate total amount (sum of all approved requests)
    const totalAmount = requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    // Get current month's approved requests
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const approvedThisMonth = requests.filter(r => {
      if (r.status !== 'approved' || !r.updated_at) return false;
      const updatedDate = new Date(r.updated_at);
      return updatedDate.getMonth() === currentMonth && updatedDate.getFullYear() === currentYear;
    }).length;

    // Calculate total amount for current month
    const totalAmountThisMonth = requests
      .filter(r => {
        if (r.status !== 'approved' || !r.updated_at) return false;
        const updatedDate = new Date(r.updated_at);
        return updatedDate.getMonth() === currentMonth && updatedDate.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      totalAmount,
      approvedThisMonth,
      totalAmountThisMonth,
    };
  }, [requests]);

  // Format currency (Rwandan Francs) - for statistics
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-RW', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' RWF';
  };

  // Format date - for recent activity
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get recent requests (last 3 for activity sidebar)
  const recentRequests = useMemo(() => {
    return [...requests]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3);
  }, [requests]);

  // Get latest approver activities from all requests
  const latestApproverActivities = useMemo(() => {
    const activities = [];
    
    // Extract all approvals from all requests
    requests.forEach(request => {
      if (request.approvals && Array.isArray(request.approvals)) {
        request.approvals.forEach(approval => {
          activities.push({
            id: approval.id,
            requestId: request.id,
            requestTitle: request.title,
            approverUsername: approval.approver_username || 'Unknown',
            action: approval.action, // 'approved' or 'rejected'
            actionDisplay: approval.action_display || approval.action,
            approvalLevel: approval.approval_level_display || 'N/A',
            createdAt: approval.created_at || approval.approved_at || approval.rejected_at,
            comments: approval.comments,
          });
        });
      }
    });
    
    // Sort by date (most recent first) and take latest 5
    return activities
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [requests]);

  // Create table columns
  const columns = useMemo(() => createPurchaseRequestColumns(isDark), [isDark]);

  // Handle row click
  const handleRowClick = (request) => {
    navigate(`/requests/${request.id}`);
  };

  // Role-based dashboard title and description
  const getDashboardInfo = () => {
    const role = user?.role || 'staff';
    if (role === 'admin' || user?.is_superuser) {
      return {
        title: 'Admin Dashboard',
        description: 'System overview and all purchase requests'
      };
    } else if (role === 'approver_level_1' || role === 'approver_level_2' || 
               role === 'approver-level-1' || role === 'approver-level-2') {
      return {
        title: 'Approver Dashboard',
        description: 'Pending approvals and request overview'
      };
    } else if (role === 'finance') {
      return {
        title: 'Finance Dashboard',
        description: 'Approved requests and financial overview'
      };
    } else {
      return {
        title: 'My Dashboard',
        description: 'Manage your purchase requests and approvals'
      };
    }
  };

  const dashboardInfo = getDashboardInfo();

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full text-[14px]">
      {/* Content Area */}
      <main className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start lg:items-start w-full">
        {/* Left Column */}
        <div className="flex flex-col gap-6 lg:gap-8 w-full lg:w-2/3">
          {/* Welcome Header */}
          <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className={`text-xl sm:text-2xl font-bold ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                Welcome{user?.username ? `, ${user.username}` : ''} to {dashboardInfo.title}
              </h1>
              <p className={`text-sm mt-1 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {dashboardInfo.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
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
              <span className={`text-sm font-medium ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {currentDate}
              </span>
              {(user?.role === 'staff' || user?.is_superuser) && (
                <button 
                  onClick={() => navigate('/requests/create')}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
                >
                  <i className="fas fa-plus"></i> New Request
                </button>
              )}
            </div>
          </section>

          {/* Summary Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className={`rounded-xl p-4 sm:p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`font-semibold text-sm ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Total Requests
                </h3>
                <div className={`p-2 rounded-lg ${
                  isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                }`}>
                  <i className="fas fa-shopping-cart text-sm"></i>
                </div>
              </div>
              {isLoading ? (
                <div className={`text-2xl sm:text-3xl font-bold ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  ...
                </div>
              ) : (
                <>
                  <p className={`text-2xl sm:text-3xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>
                    {statistics.totalRequests}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    All purchase requests
                  </p>
                </>
              )}
            </div>

            <div className={`rounded-xl p-4 sm:p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`font-semibold text-sm ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Pending
                </h3>
                <div className={`p-2 rounded-lg ${
                  isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'
                }`}>
                  <i className="fas fa-clock text-sm"></i>
                </div>
              </div>
              {isLoading ? (
                <div className={`text-2xl sm:text-3xl font-bold ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  ...
                </div>
              ) : (
                <>
                  <p className={`text-2xl sm:text-3xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>
                    {statistics.pendingRequests}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    Awaiting approval
                  </p>
                </>
              )}
            </div>

            <div className={`rounded-xl p-4 sm:p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`font-semibold text-sm ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Approved
                </h3>
                <div className={`p-2 rounded-lg ${
                  isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-600'
                }`}>
                  <i className="fas fa-check-circle text-sm"></i>
                </div>
              </div>
              {isLoading ? (
                <div className={`text-2xl sm:text-3xl font-bold ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  ...
                </div>
              ) : (
                <>
                  <p className={`text-2xl sm:text-3xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>
                    {statistics.approvedRequests}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    Successfully approved
                  </p>
                </>
              )}
            </div>

            <div className={`rounded-xl p-4 sm:p-6 shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className={`font-semibold text-sm ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Total Amount
                </h3>
                <div className={`p-2 rounded-lg ${
                  isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'
                }`}>
                  <i className="fas fa-coins text-sm"></i>
                </div>
              </div>
              {isLoading ? (
                <div className={`text-2xl sm:text-3xl font-bold ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  ...
                </div>
              ) : (
                <>
                  <p className={`text-2xl sm:text-3xl font-bold ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}>
                    {formatCurrency(statistics.totalAmountThisMonth)}
                  </p>
                  <p className={`text-sm mt-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`}>
                    This month
                  </p>
                </>
              )}
            </div>
          </section>

          {/* Purchase Requests Table */}
          <section className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 mb-4">
              <div>
                <h3 className={`font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Purchase Requests
                </h3>
                <p className={`text-sm mt-1 ${
                  isDark ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  All purchase requests with sorting and filtering
                </p>
              </div>
            </div>

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
          </section>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6 lg:gap-8 w-full lg:w-1/3 lg:max-w-sm">
          {/* Latest Approver Activity */}
          <section className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Latest Approver Activity
                </h3>
                <p className={`text-sm mt-1 ${
                  isDark ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Recent approval actions
                </p>
              </div>
            </div>

            {/* Scrollable container with fixed height */}
            <div className="h-[290px] overflow-y-auto pr-2">
              <div className="space-y-3">
                {isLoading ? (
                  <div className={`text-center py-4 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Loading...
                  </div>
                ) : latestApproverActivities.length === 0 ? (
                  <div className={`text-center py-4 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No approval activity yet
                  </div>
                ) : (
                  latestApproverActivities.map((activity) => (
                    <div 
                      key={activity.id} 
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        activity.action === 'approved'
                          ? isDark 
                            ? 'bg-green-900/10 border-green-700/30 hover:bg-green-900/20' 
                            : 'bg-green-50 border-green-200 hover:bg-green-100'
                          : isDark 
                          ? 'bg-red-900/10 border-red-700/30 hover:bg-red-900/20' 
                          : 'bg-red-50 border-red-200 hover:bg-red-100'
                      }`}
                      onClick={() => navigate(`/requests/${activity.requestId}`)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-full flex-shrink-0 ${
                          activity.action === 'approved'
                            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-200 text-green-600'
                            : isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-200 text-red-600'
                        }`}>
                          <i className={`fas ${activity.action === 'approved' ? 'fa-check' : 'fa-times'} text-xs`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium mb-1 ${
                            isDark ? 'text-gray-300' : 'text-gray-800'
                          }`}>
                            {activity.requestTitle}
                          </p>
                          <p className={`text-xs ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            <span className={`font-semibold capitalize ${
                              activity.action === 'approved'
                                ? isDark ? 'text-green-400' : 'text-green-600'
                                : isDark ? 'text-red-400' : 'text-red-600'
                            }`}>
                              {activity.action}
                            </span>
                            {' by '}
                            <span className="font-medium">{activity.approverUsername}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className={`font-semibold ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Recent Activity
                </h3>
                <p className={`text-sm mt-1 ${
                  isDark ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Latest updates
                </p>
              </div>
            </div>

            {/* Scrollable container with fixed height */}
            <div className="h-[290px] overflow-y-auto pr-2">
              <div className="space-y-3">
                {isLoading ? (
                  <div className={`text-center py-4 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Loading...
                  </div>
                ) : recentRequests.length === 0 ? (
                  <div className={`text-center py-4 text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No recent activity
                  </div>
                ) : (
                  recentRequests.map((request) => {
                    const activityType = request.status === 'approved' ? 'approved' : 
                                       request.status === 'rejected' ? 'rejected' : 'created';
                    return (
                      <div 
                        key={request.id} 
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                          activityType === 'approved'
                            ? isDark 
                              ? 'bg-green-900/10 border-green-700/30 hover:bg-green-900/20' 
                              : 'bg-green-50 border-green-200 hover:bg-green-100'
                            : activityType === 'rejected'
                            ? isDark 
                              ? 'bg-red-900/10 border-red-700/30 hover:bg-red-900/20' 
                              : 'bg-red-50 border-red-200 hover:bg-red-100'
                            : isDark 
                            ? 'bg-blue-900/10 border-blue-700/30 hover:bg-blue-900/20' 
                            : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                        }`}
                        onClick={() => navigate(`/requests/${request.id}`)}
                      >
                        <div className={`p-1.5 rounded-full flex-shrink-0 ${
                          activityType === 'approved' 
                            ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-200 text-green-600'
                            : activityType === 'rejected'
                            ? isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-200 text-red-600'
                            : isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-200 text-blue-600'
                        }`}>
                          {activityType === 'approved' && <i className="fas fa-check text-xs"></i>}
                          {activityType === 'rejected' && <i className="fas fa-times text-xs"></i>}
                          {activityType === 'created' && <i className="fas fa-plus text-xs"></i>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium mb-1 ${
                            isDark ? 'text-gray-300' : 'text-gray-800'
                          }`}>
                            {request.title}
                          </p>
                          <p className={`text-xs ${
                            isDark ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {request.created_by_username}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
