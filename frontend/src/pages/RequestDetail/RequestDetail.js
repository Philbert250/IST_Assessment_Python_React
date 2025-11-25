import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getPurchaseRequest, submitReceipt } from '../../services/requests';
import ApprovalModal from '../../components/requests/ApprovalModal/ApprovalModal';

const RequestDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [receiptFile, setReceiptFile] = useState(null);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState(null);

  // Fetch request details
  const { data: request, isLoading, isError, error } = useQuery({
    queryKey: ['purchaseRequest', id],
    queryFn: () => getPurchaseRequest(id),
    enabled: !!id,
  });

  // Submit receipt mutation
  const submitReceiptMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('receipt', file);
      return submitReceipt(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseRequest', id]);
      queryClient.invalidateQueries(['myPurchaseRequests']);
      queryClient.invalidateQueries(['purchaseRequests']);
      setShowReceiptForm(false);
      setReceiptFile(null);
    },
  });

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0 RWF';
    return new Intl.NumberFormat('en-RW', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(parseFloat(amount)) + ' RWF';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge classes
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

  // Get status icon
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

  // Check if user can edit
  const canEdit = request?.can_be_edited && (user?.id === request?.created_by || user?.is_superuser);
  // Staff can submit receipt for approved requests (even if receipt exists, they can replace it)
  const canSubmitReceipt = request?.status === 'approved' && (user?.id === request?.created_by || user?.is_superuser) && (user?.role === 'staff' || user?.is_superuser);
  
  // Check if user can approve/reject (approvers only, and request must be pending)
  const canApprove = request?.status === 'pending' && (
    user?.role === 'approver_level_1' || 
    user?.role === 'approver_level_2' || 
    user?.role === 'approver-level-1' || 
    user?.role === 'approver-level-2' ||
    user?.is_superuser
  );

  // Check if user has already acted on this request
  const getUserApprovalAction = () => {
    if (!request?.approvals || !user) return null;
    
    // Find approval by current user
    const userApproval = request.approvals.find(
      approval => approval.approver === user.id || approval.approver_username === user.username
    );
    
    return userApproval ? userApproval.action : null;
  };

  const userAction = getUserApprovalAction();

  // Handle receipt submission
  const handleReceiptSubmit = async (e) => {
    e.preventDefault();
    if (receiptFile) {
      try {
        await submitReceiptMutation.mutateAsync(receiptFile);
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error submitting receipt:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
          <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Loading request details...
          </p>
        </div>
      </div>
    );
  }

  // Get back navigation path based on user role
  const getBackPath = () => {
    const role = user?.role || 'staff';
    if (role === 'finance') {
      return '/requests/approved';
    } else if (role === 'approver_level_1' || role === 'approver_level_2' || 
               role === 'approver-level-1' || role === 'approver-level-2') {
      return '/approvals/pending';
    } else if (role === 'admin' || user?.is_superuser) {
      return '/requests/all';
    }
    return '/requests/my-requests';
  };

  if (isError || !request) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6">
        <div className={`p-6 rounded-lg ${
          isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            <i className="fas fa-exclamation-circle mr-2"></i>
            {error?.response?.data?.error || error?.message || 'Request not found'}
          </p>
          <button
            onClick={() => navigate(getBackPath())}
            className="mt-4 text-blue-500 hover:text-blue-600"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // Get file URL
  const getFileUrl = (filePath) => {
    if (!filePath) return null;
    if (filePath.startsWith('http')) return filePath;
    // Construct URL relative to API base URL
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
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(getBackPath())}
          className={`mb-4 flex items-center gap-2 text-sm ${
            isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <i className="fas fa-arrow-left"></i> Back
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${
              isDark ? 'text-white' : 'text-gray-800'
            }`}>
              {request.title}
            </h1>
            <p className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Request ID: {request.id.substring(0, 8)}...
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusClasses(request.status)}`}>
              <i className={`fas ${getStatusIcon(request.status)} mr-2`}></i>
              {request.status_display}
            </span>
            {canEdit && (
              <button
                onClick={() => navigate(`/requests/${id}/edit`)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <i className="fas fa-edit mr-2"></i> Edit
              </button>
            )}
            {canApprove && (
              <>
                {userAction ? (
                  <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    userAction === 'approved'
                      ? isDark
                        ? 'bg-green-900/30 text-green-400 border border-green-700'
                        : 'bg-green-50 text-green-600 border border-green-200'
                      : isDark
                      ? 'bg-red-900/30 text-red-400 border border-red-700'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    <i className={`fas ${userAction === 'approved' ? 'fa-check' : 'fa-times'} mr-2`}></i>
                    You {userAction === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setApprovalAction('approve');
                        setShowApprovalModal(true);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isDark
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      <i className="fas fa-check mr-2"></i> Approve
                    </button>
                    <button
                      onClick={() => {
                        setApprovalAction('reject');
                        setShowApprovalModal(true);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isDark
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      <i className="fas fa-times mr-2"></i> Reject
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Basic Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className={`text-sm font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Description
                </label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {request.description}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Request Type
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {request.request_type_name || request.request_type?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Total Amount
                  </label>
                  <p className={`mt-1 text-lg font-semibold ${
                    isDark ? 'text-gray-300' : 'text-gray-800'
                  }`}>
                    {formatCurrency(request.amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          {request.items && request.items.length > 0 && (
            <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Items
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b ${
                      isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                    }`}>
                      <th className="text-left py-2 px-2">Description</th>
                      <th className="text-right py-2 px-2">Quantity</th>
                      <th className="text-right py-2 px-2">Unit Price</th>
                      <th className="text-right py-2 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items.map((item, index) => (
                      <tr
                        key={item.id || index}
                        className={`border-b ${
                          isDark ? 'border-gray-700' : 'border-gray-200'
                        }`}
                      >
                        <td className={`py-3 px-2 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                          {item.description}
                        </td>
                        <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                          {item.quantity}
                        </td>
                        <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className={`py-3 px-2 text-right font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                          {formatCurrency(item.total_price || item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Proforma Extracted Data */}
          {request.proforma_extracted_data && !request.proforma_extracted_data.error && (
            <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <i className="fas fa-robot text-blue-500"></i>
                AI Extracted Proforma Data
              </h2>
              <div className="space-y-6">
                {/* Vendor Information */}
                {(request.proforma_extracted_data.vendor_name || 
                  request.proforma_extracted_data.vendor_address || 
                  request.proforma_extracted_data.vendor_email || 
                  request.proforma_extracted_data.vendor_phone) && (
                  <div>
                    <h3 className={`text-md font-semibold mb-3 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Vendor Information
                    </h3>
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {request.proforma_extracted_data.vendor_name && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Vendor Name
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.vendor_name}
                            </p>
                          </div>
                        )}
                        {request.proforma_extracted_data.vendor_email && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Email
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.vendor_email}
                            </p>
                          </div>
                        )}
                        {request.proforma_extracted_data.vendor_phone && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Phone
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.vendor_phone}
                            </p>
                          </div>
                        )}
                        {request.proforma_extracted_data.invoice_number && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Invoice Number
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.invoice_number}
                            </p>
                          </div>
                        )}
                      </div>
                      {request.proforma_extracted_data.vendor_address && (
                        <div className="mt-4">
                          <label className={`text-sm font-medium ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Address
                          </label>
                          <p className={`mt-1 whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                            {request.proforma_extracted_data.vendor_address}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Details */}
                {(request.proforma_extracted_data.invoice_date || 
                  request.proforma_extracted_data.payment_terms || 
                  request.proforma_extracted_data.delivery_terms) && (
                  <div>
                    <h3 className={`text-md font-semibold mb-3 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Invoice Details
                    </h3>
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {request.proforma_extracted_data.invoice_date && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Invoice Date
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.invoice_date}
                            </p>
                          </div>
                        )}
                        {request.proforma_extracted_data.payment_terms && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Payment Terms
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.payment_terms}
                            </p>
                          </div>
                        )}
                        {request.proforma_extracted_data.delivery_terms && (
                          <div>
                            <label className={`text-sm font-medium ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              Delivery Terms
                            </label>
                            <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {request.proforma_extracted_data.delivery_terms}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Extracted Items */}
                {request.proforma_extracted_data.items && 
                 Array.isArray(request.proforma_extracted_data.items) && 
                 request.proforma_extracted_data.items.length > 0 && (
                  <div>
                    <h3 className={`text-md font-semibold mb-3 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Extracted Items
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={`border-b ${
                            isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                          }`}>
                            <th className="text-left py-2 px-2">Description</th>
                            <th className="text-right py-2 px-2">Quantity</th>
                            <th className="text-right py-2 px-2">Unit Price</th>
                            <th className="text-right py-2 px-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {request.proforma_extracted_data.items.map((item, index) => (
                            <tr
                              key={index}
                              className={`border-b ${
                                isDark ? 'border-gray-700' : 'border-gray-200'
                              }`}
                            >
                              <td className={`py-3 px-2 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {item.description || 'N/A'}
                              </td>
                              <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {item.quantity || 0}
                              </td>
                              <td className={`py-3 px-2 text-right ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {formatCurrency(item.unit_price || 0)}
                              </td>
                              <td className={`py-3 px-2 text-right font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                                {formatCurrency(item.total_price || (item.quantity || 0) * (item.unit_price || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Financial Summary */}
                {(request.proforma_extracted_data.subtotal || 
                  request.proforma_extracted_data.tax || 
                  request.proforma_extracted_data.total) && (
                  <div>
                    <h3 className={`text-md font-semibold mb-3 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Financial Summary
                    </h3>
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <div className="space-y-2">
                        {request.proforma_extracted_data.subtotal !== undefined && (
                          <div className="flex justify-between">
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Subtotal:
                            </span>
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {formatCurrency(request.proforma_extracted_data.subtotal)}
                            </span>
                          </div>
                        )}
                        {request.proforma_extracted_data.tax !== undefined && (
                          <div className="flex justify-between">
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Tax:
                            </span>
                            <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              {formatCurrency(request.proforma_extracted_data.tax)}
                            </span>
                          </div>
                        )}
                        {request.proforma_extracted_data.total !== undefined && (
                          <div className="flex justify-between pt-2 border-t border-gray-600">
                            <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                              Total:
                            </span>
                            <span className={`text-lg font-bold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                              {formatCurrency(request.proforma_extracted_data.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {request.proforma_extracted_data.notes && (
                  <div>
                    <h3 className={`text-md font-semibold mb-3 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Notes
                    </h3>
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <p className={`whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                        {request.proforma_extracted_data.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proforma Extraction Error */}
          {request.proforma_extracted_data && request.proforma_extracted_data.error && (
            <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
              isDark ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h2 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${
                isDark ? 'text-yellow-400' : 'text-yellow-700'
              }`}>
                <i className="fas fa-exclamation-triangle"></i>
                Proforma Extraction Notice
              </h2>
              <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-600'}`}>
                The AI extraction encountered an issue: {request.proforma_extracted_data.error}
              </p>
            </div>
          )}

          {/* Files */}
          <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Documents
            </h2>
            <div className="space-y-4">
              {request.proforma && (
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Proforma Invoice
                  </label>
                  <div className="mt-2">
                    <a
                      href={getFileUrl(request.proforma)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <i className="fas fa-file-pdf"></i> View Proforma
                    </a>
                  </div>
                </div>
              )}
              {request.purchase_order && (
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Purchase Order
                  </label>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={getFileUrl(request.purchase_order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      <i className="fas fa-eye"></i> View PO
                    </a>
                    <a
                      href={getFileUrl(request.purchase_order)}
                      download
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      <i className="fas fa-download"></i> Download PO
                    </a>
                  </div>
                </div>
              )}
              {/* Receipt Section - Always show for approved requests if user is staff */}
              {request?.status === 'approved' && canSubmitReceipt && (
                <div>
                  <label className={`text-sm font-medium mb-2 block ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Receipt {request.receipt ? '(Current)' : ''}
                  </label>
                  {request.receipt && (
                    <div className="mb-3">
                      <a
                        href={getFileUrl(request.receipt)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-2 ${
                          isDark
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        <i className="fas fa-file-invoice"></i> View Current Receipt
                      </a>
                      {request.receipt_validated !== null && (
                        <div className={`mt-2 p-3 rounded-lg ${
                          request.receipt_validated
                            ? isDark
                              ? 'bg-green-900/30 border border-green-700'
                              : 'bg-green-50 border border-green-200'
                            : isDark
                            ? 'bg-yellow-900/30 border border-yellow-700'
                            : 'bg-yellow-50 border border-yellow-200'
                        }`}>
                          <p className={`text-sm ${
                            request.receipt_validated
                              ? isDark ? 'text-green-400' : 'text-green-600'
                              : isDark ? 'text-yellow-400' : 'text-yellow-600'
                          }`}>
                            <i className={`fas ${request.receipt_validated ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-2`}></i>
                            {request.receipt_validated ? 'Receipt validated' : 'Receipt validation pending'}
                          </p>
                          {request.receipt_validation_notes && (
                            <p className={`text-xs mt-1 ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {request.receipt_validation_notes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!showReceiptForm && (
                    <button
                      onClick={() => setShowReceiptForm(true)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isDark
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      <i className="fas fa-upload mr-2"></i> {request.receipt ? 'Replace Receipt' : 'Submit Receipt'}
                    </button>
                  )}
                </div>
              )}
              {/* Show receipt view only if user is not staff (finance, approvers, etc.) */}
              {request?.receipt && request?.status === 'approved' && !canSubmitReceipt && (
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Receipt
                  </label>
                  <div className="mt-2">
                    <a
                      href={getFileUrl(request.receipt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        isDark
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      <i className="fas fa-file-invoice"></i> View Receipt
                    </a>
                  </div>
                  {request.receipt_validated !== null && (
                    <div className={`mt-2 p-3 rounded-lg ${
                      request.receipt_validated
                        ? isDark
                          ? 'bg-green-900/30 border border-green-700'
                          : 'bg-green-50 border border-green-200'
                        : isDark
                        ? 'bg-yellow-900/30 border border-yellow-700'
                        : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <p className={`text-sm ${
                        request.receipt_validated
                          ? isDark ? 'text-green-400' : 'text-green-600'
                          : isDark ? 'text-yellow-400' : 'text-yellow-600'
                      }`}>
                        <i className={`fas ${request.receipt_validated ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-2`}></i>
                        {request.receipt_validated ? 'Receipt validated' : 'Receipt validation pending'}
                      </p>
                      {request.receipt_validation_notes && (
                        <p className={`text-xs mt-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {request.receipt_validation_notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {showReceiptForm && (
                <form onSubmit={handleReceiptSubmit} className={`p-4 rounded-lg border ${
                  isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                }`}>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Receipt File
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setReceiptFile(e.target.files[0])}
                    className={`w-full px-4 py-2 rounded-lg border mb-3 ${
                      isDark
                        ? 'bg-gray-800 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                    required
                  />
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={!receiptFile || submitReceiptMutation.isLoading}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isDark
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : 'bg-purple-500 text-white hover:bg-purple-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {submitReceiptMutation.isLoading ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i> Uploading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-upload mr-2"></i> Upload
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReceiptForm(false);
                        setReceiptFile(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isDark
                          ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                  {submitReceiptMutation.isError && (
                    <p className="mt-2 text-sm text-red-500">
                      {submitReceiptMutation.error?.response?.data?.error ||
                        submitReceiptMutation.error?.message ||
                        'Error uploading receipt'}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Approvals */}
          {request.approvals && request.approvals.length > 0 && (
            <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
              isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Approval History
              </h2>
              <div className="space-y-3">
                {request.approvals.map((approval, index) => (
                  <div
                    key={approval.id || index}
                    className={`p-4 rounded-lg border ${
                      isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                          {approval.approver_username || 'N/A'}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {approval.approval_level_display || 'N/A'}
                        </p>
                        {approval.comments && (
                          <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {approval.comments}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          approval.action === 'approved'
                            ? isDark
                              ? 'bg-green-900/30 text-green-400 border border-green-700'
                              : 'bg-green-50 text-green-600 border border-green-200'
                            : isDark
                            ? 'bg-red-900/30 text-red-400 border border-red-700'
                            : 'bg-red-50 text-red-600 border border-red-200'
                        }`}>
                          {approval.action_display || approval.action}
                        </span>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {formatDate(approval.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <h2 className={`text-lg font-semibold mb-4 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className={`text-sm font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Created By
                </label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {request.created_by_username || 'N/A'}
                </p>
              </div>
              <div>
                <label className={`text-sm font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Created At
                </label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {formatDate(request.created_at)}
                </p>
              </div>
              {request.approved_by_username && (
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Approved By
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {request.approved_by_username}
                  </p>
                </div>
              )}
              {request.updated_at && (
                <div>
                  <label className={`text-sm font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Last Updated
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {formatDate(request.updated_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && approvalAction && request && (
        <ApprovalModal
          key={`${request.id}-${approvalAction}`}
          request={request}
          action={approvalAction}
          onClose={() => {
            setShowApprovalModal(false);
            setApprovalAction(null);
          }}
          onSuccess={() => {
            setShowApprovalModal(false);
            setApprovalAction(null);
            // Query will refetch automatically
          }}
        />
      )}
    </div>
  );
};

export default RequestDetail;

