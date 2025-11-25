import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../services/auth';
import api from '../../services/api';

const DEPARTMENT_CHOICES = [
  { value: 'it', label: 'IT' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'other', label: 'Other' },
];

const profileSchema = yup.object().shape({
  department: yup.string().nullable(),
  phone_number: yup.string().nullable(),
  address: yup.string().nullable(),
});

const userInfoSchema = yup.object().shape({
  username: yup.string().min(3, 'Username must be at least 3 characters').nullable(),
  first_name: yup.string().nullable(),
  last_name: yup.string().nullable(),
  email: yup.string().email('Invalid email').required('Email is required'),
});

const Profile = () => {
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'account'

  // Fetch user profile
  const { data: profileData, isLoading: profileLoading, isError: profileError } = useQuery({
    queryKey: ['userProfile'],
    queryFn: getUserProfile,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch user details
  const { data: userData, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['userDetails'],
    queryFn: async () => {
      const response = await api.get('/api/auth/user/');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Profile form
  const profileForm = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      department: '',
      phone_number: '',
      address: '',
    },
  });

  // User info form
  const userInfoForm = useForm({
    resolver: yupResolver(userInfoSchema),
    defaultValues: {
      username: '',
      first_name: '',
      last_name: '',
      email: '',
    },
  });

  const { isSubmitting: profileFormIsSubmitting } = profileForm.formState;
  const { isSubmitting: userInfoFormIsSubmitting } = userInfoForm.formState;

  // Update form values when data is loaded
  React.useEffect(() => {
    if (profileData) {
      profileForm.reset({
        department: profileData.department || '',
        phone_number: profileData.phone_number || '',
        address: profileData.address || '',
      });
    }
  }, [profileData, profileForm]);

  React.useEffect(() => {
    if (userData) {
      userInfoForm.reset({
        username: userData.username || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
      });
    }
  }, [userData, userInfoForm]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: (data) => {
      setSuccessMessage('Profile updated successfully!');
      setErrorMessage(null);
      queryClient.invalidateQueries(['userProfile']);
      queryClient.invalidateQueries(['userDetails']);
      // Also update auth context
      queryClient.invalidateQueries(['currentUser']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to update profile'
      );
      setSuccessMessage(null);
    },
  });

  // Update user info mutation
  const updateUserInfoMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.patch('/api/auth/user/', data);
      return response.data;
    },
    onSuccess: (data) => {
      setSuccessMessage('Account information updated successfully!');
      setErrorMessage(null);
      queryClient.invalidateQueries(['userDetails']);
      queryClient.invalidateQueries(['currentUser']);
    },
    onError: (error) => {
      setErrorMessage(
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.response?.data?.username?.[0] ||
        error?.response?.data?.email?.[0] ||
        error?.message ||
        'Failed to update account information'
      );
      setSuccessMessage(null);
    },
  });

  const handleProfileSubmit = async (data) => {
    try {
      // Remove department from data if user is not admin
      const isAdmin = authUser?.role === 'admin' || authUser?.is_superuser;
      if (!isAdmin) {
        const { department, ...restData } = data;
        await updateProfileMutation.mutateAsync(restData);
      } else {
        await updateProfileMutation.mutateAsync(data);
      }
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error updating profile:', error);
    }
  };

  const handleUserInfoSubmit = async (data) => {
    try {
      // Remove username from data if user is not admin
      const isAdmin = authUser?.role === 'admin' || authUser?.is_superuser;
      if (!isAdmin) {
        const { username, ...restData } = data;
        await updateUserInfoMutation.mutateAsync(restData);
      } else {
        await updateUserInfoMutation.mutateAsync(data);
      }
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error updating user info:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (profileLoading || userLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
        <div className={`rounded-xl shadow-lg p-8 text-center ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          <i className="fas fa-spinner fa-spin text-4xl mb-4 text-blue-500"></i>
          <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (profileError || userError) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
        <div className={`rounded-xl shadow-lg p-8 text-center ${
          isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
        }`}>
          <i className="fas fa-exclamation-circle text-4xl mb-4 text-red-500"></i>
          <p className={isDark ? 'text-red-400' : 'text-red-600'}>
            Failed to load profile. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-2xl sm:text-3xl font-bold ${
          isDark ? 'text-white' : 'text-gray-800'
        }`}>
          My Profile
        </h1>
        <p className={`text-sm mt-1 ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          View and update your profile information
        </p>
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

      {/* Tabs */}
      <div className={`rounded-xl shadow-lg mb-6 ${
        isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
      }`}>
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'profile'
                ? isDark
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-blue-600 border-b-2 border-blue-600'
                : isDark
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className="fas fa-user mr-2"></i> Profile Information
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === 'account'
                ? isDark
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-blue-600 border-b-2 border-blue-600'
                : isDark
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <i className="fas fa-cog mr-2"></i> Account Information
          </button>
        </div>

        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
          <div className="p-6">
            {/* Read-only Information */}
            <div className="mb-6">
              <h2 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                Profile Details
              </h2>
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg ${
                isDark ? 'bg-gray-700/50' : 'bg-gray-50'
              }`}>
                <div>
                  <label className={`text-xs font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Username
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    {authUser?.username || userData?.username || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className={`text-xs font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Role
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {profileData?.role_display || authUser?.role_display || 'N/A'}
                    </span>
                  </p>
                </div>
                <div>
                  <label className={`text-xs font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Profile Created
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {formatDate(profileData?.created_at)}
                  </p>
                </div>
                <div>
                  <label className={`text-xs font-medium ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Last Updated
                  </label>
                  <p className={`mt-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {formatDate(profileData?.updated_at)}
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Profile Form */}
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
              <h2 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                Update Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department field - only editable by admin */}
                {(authUser?.role === 'admin' || authUser?.is_superuser) ? (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Department
                    </label>
                    <select
                      {...profileForm.register('department')}
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
                ) : (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Department
                    </label>
                    <div className={`w-full px-4 py-2 rounded-lg border ${
                      isDark
                        ? 'bg-gray-700/50 border-gray-600 text-gray-400'
                        : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}>
                      {profileData?.department_display || 'N/A'}
                    </div>
                    <p className={`mt-1 text-xs ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      <i className="fas fa-info-circle mr-1"></i>
                      Department can only be changed by administrators
                    </p>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    {...profileForm.register('phone_number')}
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Address
                  </label>
                  <textarea
                    {...profileForm.register('address')}
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

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isLoading || profileFormIsSubmitting}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    isDark
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {updateProfileMutation.isLoading || profileFormIsSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i> Updating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i> Update Profile
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Account Tab Content */}
        {activeTab === 'account' && (
          <div className="p-6">
            <form onSubmit={userInfoForm.handleSubmit(handleUserInfoSubmit)}>
              <h2 className={`text-lg font-semibold mb-4 ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                Account Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username field - only editable by admin */}
                {(authUser?.role === 'admin' || authUser?.is_superuser) ? (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Username
                    </label>
                    <input
                      type="text"
                      {...userInfoForm.register('username')}
                      className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                        isDark
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        userInfoForm.formState.errors.username ? 'border-red-500' : ''
                      }`}
                      placeholder="Enter username"
                    />
                    {userInfoForm.formState.errors.username && (
                      <p className="mt-1 text-sm text-red-500">
                        {userInfoForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Username
                    </label>
                    <div className={`w-full px-4 py-2 rounded-lg border ${
                      isDark
                        ? 'bg-gray-700/50 border-gray-600 text-gray-400'
                        : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}>
                      {userData?.username || authUser?.username || 'N/A'}
                    </div>
                    <p className={`mt-1 text-xs ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      <i className="fas fa-info-circle mr-1"></i>
                      Username can only be changed by administrators
                    </p>
                  </div>
                )}

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    First Name
                  </label>
                  <input
                    type="text"
                    {...userInfoForm.register('first_name')}
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      userInfoForm.formState.errors.first_name ? 'border-red-500' : ''
                    }`}
                    placeholder="Enter first name"
                  />
                  {userInfoForm.formState.errors.first_name && (
                    <p className="mt-1 text-sm text-red-500">
                      {userInfoForm.formState.errors.first_name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    {...userInfoForm.register('last_name')}
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      userInfoForm.formState.errors.last_name ? 'border-red-500' : ''
                    }`}
                    placeholder="Enter last name"
                  />
                  {userInfoForm.formState.errors.last_name && (
                    <p className="mt-1 text-sm text-red-500">
                      {userInfoForm.formState.errors.last_name.message}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    {...userInfoForm.register('email')}
                    className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      userInfoForm.formState.errors.email ? 'border-red-500' : ''
                    }`}
                    placeholder="Enter email"
                  />
                  {userInfoForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-500">
                      {userInfoForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {!(authUser?.role === 'admin' || authUser?.is_superuser) && (
                  <div className="md:col-span-2">
                    <div className={`p-4 rounded-lg ${
                      isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <i className="fas fa-info-circle mr-2"></i>
                        <strong>Note:</strong> Username can only be changed by administrators. Contact an administrator if you need to change your username.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={updateUserInfoMutation.isLoading || userInfoFormIsSubmitting}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    isDark
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {updateUserInfoMutation.isLoading || userInfoFormIsSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i> Updating...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save mr-2"></i> Update Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;

