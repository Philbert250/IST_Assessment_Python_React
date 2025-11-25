import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../context/ThemeContext';
import { approvePurchaseRequest, rejectPurchaseRequest } from '../../../services/requests';

const ApprovalModal = ({ request, action, onClose, onSuccess }) => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens or request/action changes
  useEffect(() => {
    setComments('');
    setError(null);
    setSuccess(false);
    setIsSubmitting(false);
  }, [request?.id, action]);

  // Determine mutation based on action
  const mutationFn = action === 'approve' ? approvePurchaseRequest : rejectPurchaseRequest;
  const actionLabel = action === 'approve' ? 'Approve' : 'Reject';
  const actionIcon = action === 'approve' ? 'fa-check' : 'fa-times';
  const actionColor = action === 'approve' ? 'green' : 'red';

  const mutation = useMutation({
    mutationFn: (data) => mutationFn(request.id, data),
    onSuccess: () => {
      setError(null);
      setSuccess(true);
      setIsSubmitting(false);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries(['pendingApprovals']);
      queryClient.invalidateQueries(['purchaseRequests']);
      queryClient.invalidateQueries(['purchaseRequest', request.id]);
      queryClient.invalidateQueries(['myPurchaseRequests']);
      
      // Auto-close after 2 seconds on success
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    },
    onError: (error) => {
      setSuccess(false);
      setIsSubmitting(false);
      setError(
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        `Failed to ${action} request`
      );
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Force synchronous state update to show loading immediately
    flushSync(() => {
      setIsSubmitting(true);
    });
    
    try {
      await mutation.mutateAsync({
        comments: comments.trim() || null,
      });
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error approving/rejecting request:', error);
      setIsSubmitting(false);
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className={`relative w-full max-w-2xl rounded-xl shadow-2xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div>
            <h2 className={`text-xl font-bold ${
              isDark ? 'text-white' : 'text-gray-800'
            }`}>
              {actionLabel} Purchase Request
            </h2>
            <p className={`text-sm mt-1 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {request.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
            }`}>
              <p className={`text-sm ${
                isDark ? 'text-green-400' : 'text-green-600'
              }`}>
                <i className="fas fa-check-circle mr-2"></i>
                Request {action === 'approve' ? 'approved' : 'rejected'} successfully!
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className={`mb-4 p-4 rounded-lg ${
              isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm ${
                isDark ? 'text-red-400' : 'text-red-600'
              }`}>
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </p>
            </div>
          )}

          {/* Request Summary */}
          <div className={`mb-6 p-4 rounded-lg ${
            isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`text-xs font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Request Type
                </label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {request.request_type_name || request.request_type?.name || 'N/A'}
                </p>
              </div>
              <div>
                <label className={`text-xs font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Amount
                </label>
                <p className={`mt-1 font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {formatCurrency(request.amount)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={`text-xs font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Description
                </label>
                <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                  {request.description}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Comments (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                disabled={success || mutation.isLoading || isSubmitting}
                className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  success || mutation.isLoading || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                placeholder={`Add comments for ${action === 'approve' ? 'approval' : 'rejection'}...`}
              />
              <p className={`mt-1 text-xs ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Add any notes or comments about your decision
              </p>
            </div>

            {/* Warning for rejection */}
            {action === 'reject' && (
              <div className={`mb-6 p-4 rounded-lg ${
                isDark ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <p className={`text-sm ${
                  isDark ? 'text-yellow-400' : 'text-yellow-700'
                }`}>
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  <strong>Warning:</strong> Rejecting this request will immediately set its status to "Rejected" and it cannot be changed.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={mutation.isLoading || success || isSubmitting}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'approve'
                    ? isDark
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-500 text-white hover:bg-green-600'
                    : isDark
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {mutation.isLoading || isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i> Processing...
                  </>
                ) : success ? (
                  <>
                    <i className="fas fa-check mr-2"></i> Success!
                  </>
                ) : (
                  <>
                    <i className={`fas ${actionIcon} mr-2`}></i>
                    {actionLabel} Request
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={mutation.isLoading || isSubmitting}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  isDark
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {success ? 'Close' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;

