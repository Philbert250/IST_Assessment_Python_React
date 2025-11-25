import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../context/ThemeContext';
import { getUsers, createUser, updateUser, deleteUser } from '../../../services/admin';
import DataTable from '../../../components/common/DataTable/DataTable';

const userCreateSchema = yup.object().shape({
  username: yup.string().required('Username is required').min(3, 'Username must be at least 3 characters'),
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string()
    .nullable()
    .test('password-length', 'Password must be at least 8 characters', function(value) {
      // Only validate length if password is provided
      if (!value || value.trim() === '') {
        return true; // Empty password is allowed
      }
      return value.length >= 8;
    })
    .test('password-confirm', 'Please confirm password', function(value) {
      // If password is provided, password_confirm must also be provided
      if (value && value.trim() !== '' && !this.parent.password_confirm) {
        return false;
      }
      return true;
    }),
  password_confirm: yup.string()
    .nullable()
    .test('password-match', 'Passwords must match', function(value) {
      // Only validate if password is provided
      if (this.parent.password && this.parent.password.trim() !== '') {
        if (!value || value.trim() === '') {
          return false;
        }
        return value === this.parent.password;
      }
      return true;
    }),
  first_name: yup.string(),
  last_name: yup.string(),
  role: yup.string().required('Role is required'),
  department: yup.string(),
  phone_number: yup.string(),
  address: yup.string(),
});

const userUpdateSchema = yup.object().shape({
  username: yup.string().required('Username is required').min(3, 'Username must be at least 3 characters'),
  email: yup.string().email('Invalid email').required('Email is required'),
  first_name: yup.string(),
  last_name: yup.string(),
  is_active: yup.boolean(),
  profile: yup.object().shape({
    role: yup.string().required('Role is required'),
    department: yup.string(),
    phone_number: yup.string(),
    address: yup.string(),
  }),
});

const ROLE_CHOICES = [
  { value: 'staff', label: 'Staff' },
  { value: 'approver_level_1', label: 'Approver Level 1' },
  { value: 'approver_level_2', label: 'Approver Level 2' },
  { value: 'finance', label: 'Finance' },
  { value: 'admin', label: 'Admin' },
];

const DEPARTMENT_CHOICES = [
  { value: 'it', label: 'IT' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'other', label: 'Other' },
];

const UsersManagement = () => {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  // Fetch users
  const { data: usersData, isLoading, isError, error } = useQuery({
    queryKey: ['users', roleFilter, activeFilter],
    queryFn: () => {
      const params = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (activeFilter !== 'all') params.is_active = activeFilter === 'active';
      return getUsers(params);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const users = useMemo(() => usersData || [], [usersData]);

  // Create form
  const createForm = useForm({
    resolver: yupResolver(userCreateSchema),
    defaultValues: {
      role: 'staff',
      department: '',
    },
  });

  // Update form
  const updateForm = useForm({
    resolver: yupResolver(userUpdateSchema),
  });

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      const username = data.user?.username || data.username;
      const passwordSent = data.password_sent ? ' A password has been sent to the user\'s email.' : '';
      setSuccessMessage(`User "${username}" created successfully!${passwordSent}`);
      setErrorMessage(null);
      createForm.reset();
      setShowForm(false);
      queryClient.invalidateQueries(['users']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.username?.[0] ||
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.password?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to create user'
      );
      setSuccessMessage(null);
    },
  });

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: (data) => {
      setSuccessMessage(`User "${data.username}" updated successfully!`);
      setErrorMessage(null);
      setEditingUser(null);
      updateForm.reset();
      queryClient.invalidateQueries(['users']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.username?.[0] ||
        error?.response?.data?.email?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to update user'
      );
      setSuccessMessage(null);
    },
  });

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      setSuccessMessage('User deleted successfully!');
      setErrorMessage(null);
      setDeletingUser(null);
      queryClient.invalidateQueries(['users']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to delete user'
      );
      setSuccessMessage(null);
    },
  });

  const handleCreate = async (data) => {
    try {
      await createMutation.mutateAsync(data);
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error creating user:', error);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    updateForm.reset({
      username: user.username,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_active: user.is_active !== undefined ? user.is_active : true,
      profile: {
        role: user.role || user.profile?.role || 'staff',
        department: user.profile?.department || '',
        phone_number: user.profile?.phone_number || '',
        address: user.profile?.address || '',
      },
    });
  };

  const handleUpdate = async (data) => {
    if (editingUser) {
      try {
        await updateMutation.mutateAsync({ id: editingUser.id, data });
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error updating user:', error);
      }
    }
  };

  const handleDelete = async () => {
    if (deletingUser) {
      try {
        await deleteMutation.mutateAsync(deletingUser.id);
      } catch (error) {
        // Error is handled by mutation's onError
        console.error('Error deleting user:', error);
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
      id: 'username',
      header: 'Username',
      accessorKey: 'username',
      cell: ({ row }) => (
        <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
          {row.original.username}
        </span>
      ),
    },
    {
      id: 'email',
      header: 'Email',
      accessorKey: 'email',
      cell: ({ row }) => (
        <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
          {row.original.email}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
          {[row.original.first_name, row.original.last_name].filter(Boolean).join(' ') || 'N/A'}
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      accessorKey: 'role_display',
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
        }`}>
          {row.original.role_display || row.original.role || 'N/A'}
        </span>
      ),
    },
    {
      id: 'is_active',
      header: 'Status',
      accessorKey: 'is_active',
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          row.original.is_active
            ? isDark
              ? 'bg-green-900/30 text-green-400'
              : 'bg-green-100 text-green-600'
            : isDark
            ? 'bg-red-900/30 text-red-400'
            : 'bg-red-100 text-red-600'
        }`}>
          {row.original.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      id: 'date_joined',
      header: 'Joined',
      accessorKey: 'date_joined',
      cell: ({ row }) => (
        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
          {formatDate(row.original.date_joined)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row, table }) => {
        const isDark = table.options.meta?.isDark || false;
        const user = row.original;
        
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(user);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title="Edit user"
            >
              <i className="fas fa-edit mr-1"></i> Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeletingUser(user);
              }}
              disabled={user.is_superuser}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                user.is_superuser
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
              title={user.is_superuser ? 'Cannot delete superuser' : 'Delete user'}
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
            Users Management
          </h1>
          <p className={`text-sm mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Create and manage system users
          </p>
        </div>
        {!showForm && !editingUser && (
          <button
            onClick={() => setShowForm(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              isDark
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <i className="fas fa-plus mr-2"></i> Create User
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

      {/* Filters */}
      {!showForm && !editingUser && (
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Filter by Role
              </label>
              <select
                className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-gray-300'
                    : 'border-gray-300 text-gray-600 bg-white'
                }`}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                {ROLE_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={`block text-sm font-medium mb-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Filter by Status
              </label>
              <select
                className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${
                  isDark
                    ? 'bg-gray-800 border-gray-700 text-gray-300'
                    : 'border-gray-300 text-gray-600 bg-white'
                }`}
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Create User Form */}
      {showForm && (
        <UserForm
          form={createForm}
          onSubmit={handleCreate}
          onCancel={() => {
            setShowForm(false);
            createForm.reset();
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          isLoading={createMutation.isLoading}
          isDark={isDark}
          isCreate={true}
        />
      )}

      {/* Edit User Form */}
      {editingUser && (
        <UserForm
          form={updateForm}
          onSubmit={handleUpdate}
          onCancel={() => {
            setEditingUser(null);
            updateForm.reset();
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          isLoading={updateMutation.isLoading}
          isDark={isDark}
          isCreate={false}
          user={editingUser}
        />
      )}

      {/* Users Table */}
      {!showForm && !editingUser && (
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <DataTable
            data={users}
            columns={columns}
            isLoading={isLoading}
            isError={isError}
            error={error}
            enableSorting={true}
            enableFiltering={true}
            enablePagination={true}
            pageSize={10}
            emptyMessage="No users found"
            tableMeta={{ isDark }}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <DeleteModal
          itemName={deletingUser.username}
          onConfirm={handleDelete}
          onCancel={() => setDeletingUser(null)}
          isLoading={deleteMutation.isLoading}
          isDark={isDark}
        />
      )}
    </div>
  );
};

// User Form Component
const UserForm = ({ form, onSubmit, onCancel, isLoading, isDark, isCreate, user }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting: formIsSubmitting }, watch } = form;
  const showPasswordFields = isCreate || watch('change_password');

  return (
    <div className={`rounded-xl shadow-lg p-4 sm:p-6 mb-6 transition-colors ${
      isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
    }`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className={`text-xl font-semibold ${
          isDark ? 'text-white' : 'text-gray-800'
        }`}>
          {isCreate ? 'Create New User' : `Edit User: ${user?.username}`}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('username')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.username ? 'border-red-500' : ''
              }`}
              placeholder="Enter username"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              {...register('email')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-500' : ''
              }`}
              placeholder="Enter email"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          {showPasswordFields && (
            <>
              {isCreate && (
                <div className={`p-3 rounded-lg mb-4 ${
                  isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'
                }`}>
                  <p className={`text-sm ${
                    isDark ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    <i className="fas fa-info-circle mr-2"></i>
                    Password is optional. If not provided, a random password will be generated and sent to the user's email.
                  </p>
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password {isCreate ? '(Optional)' : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  {...register('password')}
                  className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.password ? 'border-red-500' : ''
                  }`}
                  placeholder={isCreate ? "Leave empty to auto-generate" : "Enter password"}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              {watch('password') && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Confirm Password {isCreate ? '(Optional)' : <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    {...register('password_confirm')}
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.password_confirm ? 'border-red-500' : ''
                    }`}
                    placeholder="Confirm password"
                  />
                  {errors.password_confirm && (
                    <p className="mt-1 text-sm text-red-500">{errors.password_confirm.message}</p>
                  )}
                </div>
              )}
            </>
          )}

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              First Name
            </label>
            <input
              type="text"
              {...register('first_name')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter first name"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Last Name
            </label>
            <input
              type="text"
              {...register('last_name')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter last name"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Role <span className="text-red-500">*</span>
            </label>
            <select
              {...register(isCreate ? 'role' : 'profile.role')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.role || errors['profile.role'] ? 'border-red-500' : ''
              }`}
            >
              {ROLE_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            {(errors.role || errors['profile.role']) && (
              <p className="mt-1 text-sm text-red-500">
                {errors.role?.message || errors['profile.role']?.message}
              </p>
            )}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Department
            </label>
            <select
              {...register(isCreate ? 'department' : 'profile.department')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            >
              <option value="">Select department</option>
              {DEPARTMENT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Phone Number
            </label>
            <input
              type="tel"
              {...register(isCreate ? 'phone_number' : 'profile.phone_number')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter phone number"
            />
          </div>

          {!isCreate && (
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
          )}

          <div className="sm:col-span-2">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Address
            </label>
            <textarea
              {...register(isCreate ? 'address' : 'profile.address')}
              rows={3}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              placeholder="Enter address"
            />
          </div>
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
                <i className={`fas ${isCreate ? 'fa-user-plus' : 'fa-save'} mr-2`}></i>
                {isCreate ? 'Create User' : 'Update User'}
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
            Are you sure you want to delete user <strong>{itemName}</strong>? This action cannot be undone.
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

export default UsersManagement;
