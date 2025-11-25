import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../context/ThemeContext';
import { getApprovalLevels, createApprovalLevel, updateApprovalLevel, deleteApprovalLevel, getRequestTypes } from '../../../services/admin';
import DataTable from '../../../components/common/DataTable/DataTable';

const approvalLevelSchema = yup.object().shape({
  request_type: yup.string().required('Request type is required'),
  level_number: yup.number()
    .required('Level number is required')
    .integer('Level number must be an integer')
    .min(1, 'Level number must be at least 1'),
  approver_role: yup.string().required('Approver role is required'),
  is_required: yup.boolean(),
});

const ROLE_CHOICES = [
  { value: 'staff', label: 'Staff' },
  { value: 'approver_level_1', label: 'Approver Level 1' },
  { value: 'approver_level_2', label: 'Approver Level 2' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'Admin' },
];

const ApprovalLevels = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [deletingLevel, setDeletingLevel] = useState(null);
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch request types
  const { data: requestTypesData } = useQuery({
    queryKey: ['requestTypes'],
    queryFn: getRequestTypes,
    staleTime: 10 * 60 * 1000,
  });

  const requestTypes = useMemo(() => requestTypesData || [], [requestTypesData]);

  // Fetch approval levels
  const { data: approvalLevelsData, isLoading, isError, error } = useQuery({
    queryKey: ['approvalLevels', requestTypeFilter],
    queryFn: () => {
      const params = {};
      if (requestTypeFilter !== 'all') {
        params.request_type = requestTypeFilter;
      }
      return getApprovalLevels(params);
    },
    staleTime: 2 * 60 * 1000,
  });

  const approvalLevels = useMemo(() => approvalLevelsData || [], [approvalLevelsData]);

  // Create form
  const createForm = useForm({
    resolver: yupResolver(approvalLevelSchema),
    defaultValues: {
      is_required: true,
    },
  });

  // Update form
  const updateForm = useForm({
    resolver: yupResolver(approvalLevelSchema),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createApprovalLevel,
    onSuccess: () => {
      setSuccessMessage('Approval level created successfully!');
      setErrorMessage(null);
      createForm.reset();
      setShowForm(false);
      queryClient.invalidateQueries(['approvalLevels']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.level_number?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to create approval level'
      );
      setSuccessMessage(null);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateApprovalLevel(id, data),
    onSuccess: () => {
      setSuccessMessage('Approval level updated successfully!');
      setErrorMessage(null);
      setEditingLevel(null);
      updateForm.reset();
      queryClient.invalidateQueries(['approvalLevels']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.level_number?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update approval level'
      );
      setSuccessMessage(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteApprovalLevel,
    onSuccess: () => {
      setSuccessMessage('Approval level deleted successfully!');
      setErrorMessage(null);
      setDeletingLevel(null);
      queryClient.invalidateQueries(['approvalLevels']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to delete approval level'
      );
      setSuccessMessage(null);
    },
  });

  const handleCreate = async (data) => {
    try {
      await createMutation.mutateAsync(data);
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error creating approval level:', error);
    }
  };

  const handleEdit = (level) => {
    setEditingLevel(level);
    updateForm.reset({
      request_type: level.request_type,
      level_number: level.level_number,
      approver_role: level.approver_role,
      is_required: level.is_required !== undefined ? level.is_required : true,
    });
  };

  const handleUpdate = async (data) => {
    if (editingLevel) {
      try {
        await updateMutation.mutateAsync({ id: editingLevel.id, data });
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error updating approval level:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (deletingLevel) {
      try {
        await deleteMutation.mutateAsync(deletingLevel.id);
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error deleting approval level:', error);
      }
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Create table columns
  const columns = useMemo(() => [
    {
      id: 'request_type_name',
      header: 'Request Type',
      accessorKey: 'request_type_name',
      cell: ({ row }) => (
        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
          {row.original.request_type_name || 'N/A'}
        </span>
      ),
    },
    {
      id: 'level_number',
      header: 'Level',
      accessorKey: 'level_number',
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
        }`}>
          Level {row.original.level_number}
        </span>
      ),
    },
    {
      id: 'approver_role',
      header: 'Approver Role',
      accessorKey: 'approver_role_display',
      cell: ({ row }) => (
        <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
          {row.original.approver_role_display || row.original.approver_role || 'N/A'}
        </span>
      ),
    },
    {
      id: 'is_required',
      header: 'Required',
      accessorKey: 'is_required',
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          row.original.is_required
            ? isDark
              ? 'bg-green-900/30 text-green-400'
              : 'bg-green-100 text-green-600'
            : isDark
            ? 'bg-gray-700 text-gray-400'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {row.original.is_required ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      id: 'created_at',
      header: 'Created At',
      accessorKey: 'created_at',
      cell: ({ row }) => (
        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row, table }) => {
        const isDark = table.options.meta?.isDark || false;
        const level = row.original;
        
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(level);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title="Edit approval level"
            >
              <i className="fas fa-edit mr-1"></i> Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeletingLevel(level);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title="Delete approval level"
            >
              <i className="fas fa-trash mr-1"></i> Delete
            </button>
          </div>
        );
      },
      enableSorting: false,
    },
  ], [isDark]);

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-bold ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            Approval Levels
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Configure approval workflows for request types
          </p>
        </div>
        {!showForm && !editingLevel && (
          <button
            onClick={() => setShowForm(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <i className="fas fa-plus mr-2"></i> Create Approval Level
          </button>
        )}
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className={`mb-6 p-4 rounded-lg ${
          isDark ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200'
        }`}>
          <p className={`text-sm ${
            isDark ? 'text-green-400' : 'text-green-600'
          }`}>
            <i className="fas fa-check-circle mr-2"></i>
            {successMessage}
          </p>
        </div>
      )}

      {errorMessage && (
        <div className={`mb-6 p-4 rounded-lg ${
          isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${
            isDark ? 'text-red-400' : 'text-red-600'
          }`}>
            <i className="fas fa-exclamation-circle mr-2"></i>
            {errorMessage}
          </p>
        </div>
      )}

      {/* Filter */}
      {!showForm && !editingLevel && (
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Filter by Request Type
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
                <option value="all">All Request Types</option>
                {requestTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {(showForm || editingLevel) && (
        <ApprovalLevelForm
          form={showForm ? createForm : updateForm}
          onSubmit={showForm ? handleCreate : handleUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingLevel(null);
            createForm.reset();
            updateForm.reset();
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          isLoading={showForm ? createMutation.isLoading : updateMutation.isLoading}
          isDark={isDark}
          isCreate={showForm}
          level={editingLevel}
          requestTypes={requestTypes}
        />
      )}

      {/* Table */}
      {!showForm && !editingLevel && (
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <DataTable
            data={approvalLevels}
            columns={columns}
            isLoading={isLoading}
            isError={isError}
            error={error}
            enableSorting={true}
            enableFiltering={true}
            enablePagination={true}
            pageSize={10}
            emptyMessage="No approval levels found"
            tableMeta={{ isDark }}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLevel && (
        <DeleteModal
          itemName={`Level ${deletingLevel.level_number} for ${deletingLevel.request_type_name}`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingLevel(null)}
          isLoading={deleteMutation.isLoading}
          isDark={isDark}
        />
      )}
    </div>
  );
};

// Approval Level Form Component
const ApprovalLevelForm = ({ form, onSubmit, onCancel, isLoading, isDark, isCreate, level, requestTypes }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting: formIsSubmitting } } = form;

  return (
    <div className={`rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
    }`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-xl font-semibold ${
          isDark ? 'text-white' : 'text-gray-800'
        }`}>
          {isCreate ? 'Create New Approval Level' : `Edit Approval Level: Level ${level?.level_number}`}
        </h2>
        <button
          onClick={onCancel}
          className={`p-2 rounded-lg transition-colors ${
            isDark
              ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Request Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('request_type')}
            disabled={!isCreate}
            className={`w-full px-4 py-2 rounded-lg border transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.request_type ? 'border-red-500' : ''
            } ${!isCreate ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <option value="">Select request type</option>
            {requestTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {errors.request_type && (
            <p className="mt-1 text-sm text-red-500">{errors.request_type.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Level Number <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            {...register('level_number', { valueAsNumber: true })}
            className={`w-full px-4 py-2 rounded-lg border transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.level_number ? 'border-red-500' : ''
            }`}
            placeholder="Enter level number (1, 2, 3, etc.)"
          />
          {errors.level_number && (
            <p className="mt-1 text-sm text-red-500">{errors.level_number.message}</p>
          )}
          <p className={`mt-1 text-xs ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            The order in which approvals must be obtained (1 = first, 2 = second, etc.)
          </p>
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Approver Role <span className="text-red-500">*</span>
          </label>
          <select
            {...register('approver_role')}
            className={`w-full px-4 py-2 rounded-lg border transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.approver_role ? 'border-red-500' : ''
            }`}
          >
            <option value="">Select approver role</option>
            {ROLE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          {errors.approver_role && (
            <p className="mt-1 text-sm text-red-500">{errors.approver_role.message}</p>
          )}
          <p className={`mt-1 text-xs ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            The user role required to approve at this level
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('is_required')}
            className={`w-4 h-4 rounded ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-blue-500'
                : 'border-gray-300 text-blue-600'
            }`}
          />
          <label className={`ml-2 text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Required
          </label>
          <p className={`ml-2 text-xs ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            (Whether this approval level is mandatory)
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isLoading || formIsSubmitting}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading || formIsSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i> {isCreate ? 'Creating...' : 'Updating...'}
              </>
            ) : (
              <>
                <i className={`fas ${isCreate ? 'fa-plus' : 'fa-save'} mr-2`}></i>
                {isCreate ? 'Create Approval Level' : 'Update Approval Level'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              isDark
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// Delete Confirmation Modal
const DeleteModal = ({ itemName, onConfirm, onCancel, isLoading, isDark }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      ></div>
      <div className={`relative w-full max-w-md rounded-xl shadow-2xl ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}>
        <div className="p-6">
          <h2 className={`text-xl font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            Confirm Delete
          </h2>
          <p className={`mb-6 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Are you sure you want to delete approval level <strong>{itemName}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                isDark
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i> Deleting...
                </>
              ) : (
                <>
                  <i className="fas fa-trash mr-2"></i> Delete
                </>
              )}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalLevels;
