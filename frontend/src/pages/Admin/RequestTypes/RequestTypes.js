import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../context/ThemeContext';
import { getRequestTypes, createRequestType, updateRequestType, deleteRequestType } from '../../../services/admin';
import DataTable from '../../../components/common/DataTable/DataTable';

const requestTypeSchema = yup.object().shape({
  name: yup.string().required('Name is required').min(2, 'Name must be at least 2 characters'),
  description: yup.string(),
  is_active: yup.boolean(),
});

const RequestTypes = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Fetch request types
  const { data: requestTypesData, isLoading, isError, error } = useQuery({
    queryKey: ['requestTypes'],
    queryFn: getRequestTypes,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const requestTypes = useMemo(() => requestTypesData || [], [requestTypesData]);

  // Create form
  const createForm = useForm({
    resolver: yupResolver(requestTypeSchema),
    defaultValues: {
      is_active: true,
    },
  });

  // Update form
  const updateForm = useForm({
    resolver: yupResolver(requestTypeSchema),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createRequestType,
    onSuccess: () => {
      setSuccessMessage('Request type created successfully!');
      setErrorMessage(null);
      createForm.reset();
      setShowForm(false);
      queryClient.invalidateQueries(['requestTypes']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.name?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to create request type'
      );
      setSuccessMessage(null);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateRequestType(id, data),
    onSuccess: () => {
      setSuccessMessage('Request type updated successfully!');
      setErrorMessage(null);
      setEditingType(null);
      updateForm.reset();
      queryClient.invalidateQueries(['requestTypes']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.name?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update request type'
      );
      setSuccessMessage(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteRequestType,
    onSuccess: () => {
      setSuccessMessage('Request type deleted successfully!');
      setErrorMessage(null);
      setDeletingType(null);
      queryClient.invalidateQueries(['requestTypes']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to delete request type'
      );
      setSuccessMessage(null);
    },
  });

  const handleCreate = async (data) => {
    try {
      await createMutation.mutateAsync(data);
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error creating request type:', error);
    }
  };

  const handleEdit = (type) => {
    setEditingType(type);
    updateForm.reset({
      name: type.name,
      description: type.description || '',
      is_active: type.is_active !== undefined ? type.is_active : true,
    });
  };

  const handleUpdate = async (data) => {
    if (editingType) {
      try {
        await updateMutation.mutateAsync({ id: editingType.id, data });
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error updating request type:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (deletingType) {
      try {
        await deleteMutation.mutateAsync(deletingType.id);
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error deleting request type:', error);
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
      id: 'name',
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => (
        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
          {row.original.name}
        </span>
      ),
    },
    {
      id: 'description',
      header: 'Description',
      accessorKey: 'description',
      cell: ({ row }) => (
        <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
          {row.original.description || 'N/A'}
        </span>
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      accessorKey: 'is_active',
      cell: ({ row }) => (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          row.original.is_active
            ? isDark
              ? 'bg-green-900/30 text-green-400 border border-green-700'
              : 'bg-green-50 text-green-600 border border-green-200'
            : isDark
            ? 'bg-red-900/30 text-red-400 border border-red-700'
            : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {row.original.is_active ? 'Active' : 'Inactive'}
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
        const type = row.original;
        
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(type);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title="Edit request type"
            >
              <i className="fas fa-edit mr-1"></i> Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeletingType(type);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title="Delete request type"
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
            Request Types
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            View and manage request types
          </p>
        </div>
        {!showForm && !editingType && (
          <button
            onClick={() => setShowForm(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <i className="fas fa-plus mr-2"></i> Create Request Type
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

      {/* Statistics */}
      {!showForm && !editingType && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Total Types
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  isDark ? 'text-white' : 'text-gray-800'
                }`}>
                  {requestTypes.length}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                isDark ? 'bg-blue-900/30' : 'bg-blue-100'
              }`}>
                <i className={`fas fa-tags text-2xl ${
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
                  Active Types
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  isDark ? 'text-white' : 'text-gray-800'
                }`}>
                  {requestTypes.filter(rt => rt.is_active).length}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                isDark ? 'bg-green-900/30' : 'bg-green-100'
              }`}>
                <i className={`fas fa-check-circle text-2xl ${
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
                  Inactive Types
                </p>
                <p className={`text-2xl font-bold mt-1 ${
                  isDark ? 'text-white' : 'text-gray-800'
                }`}>
                  {requestTypes.filter(rt => !rt.is_active).length}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                isDark ? 'bg-red-900/30' : 'bg-red-100'
              }`}>
                <i className={`fas fa-times-circle text-2xl ${
                  isDark ? 'text-red-400' : 'text-red-600'
                }`}></i>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {(showForm || editingType) && (
        <RequestTypeForm
          form={showForm ? createForm : updateForm}
          onSubmit={showForm ? handleCreate : handleUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingType(null);
            createForm.reset();
            updateForm.reset();
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          isLoading={showForm ? createMutation.isLoading : updateMutation.isLoading}
          isDark={isDark}
          isCreate={showForm}
          type={editingType}
        />
      )}

      {/* Table */}
      {!showForm && !editingType && (
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <DataTable
            data={requestTypes}
            columns={columns}
            isLoading={isLoading}
            isError={isError}
            error={error}
            enableSorting={true}
            enableFiltering={true}
            enablePagination={true}
            pageSize={10}
            emptyMessage="No request types found"
            tableMeta={{ isDark }}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingType && (
        <DeleteModal
          itemName={deletingType.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingType(null)}
          isLoading={deleteMutation.isLoading}
          isDark={isDark}
        />
      )}
    </div>
  );
};

// Request Type Form Component
const RequestTypeForm = ({ form, onSubmit, onCancel, isLoading, isDark, isCreate, type }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting: formIsSubmitting } } = form;

  return (
    <div className={`rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
    }`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-xl font-semibold ${
          isDark ? 'text-white' : 'text-gray-800'
        }`}>
          {isCreate ? 'Create New Request Type' : `Edit Request Type: ${type?.name}`}
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
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name')}
            className={`w-full px-4 py-2 rounded-lg border transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : ''
            }`}
            placeholder="Enter request type name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Description
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className={`w-full px-4 py-2 rounded-lg border transition-colors ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            placeholder="Enter description"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('is_active')}
            className={`w-4 h-4 rounded ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-blue-500'
                : 'border-gray-300 text-blue-600'
            }`}
          />
          <label className={`ml-2 text-sm ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Active
          </label>
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
                {isCreate ? 'Create Request Type' : 'Update Request Type'}
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
            Are you sure you want to delete request type <strong>{itemName}</strong>? This action cannot be undone.
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

export default RequestTypes;
