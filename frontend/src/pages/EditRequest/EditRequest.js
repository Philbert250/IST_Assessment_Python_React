import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { getPurchaseRequest, updatePurchaseRequest, getRequestTypes } from '../../services/requests';

// Validation schema (same as Create)
const schema = yup.object().shape({
  title: yup.string().required('Title is required').min(3, 'Title must be at least 3 characters'),
  description: yup.string().required('Description is required').min(10, 'Description must be at least 10 characters'),
  amount: yup
    .number()
    .required('Amount is required')
    .positive('Amount must be positive')
    .min(0.01, 'Amount must be at least 0.01'),
  request_type_id: yup.string().required('Request type is required'),
  proforma: yup.mixed().nullable(),
  items: yup.array().of(
    yup.object().shape({
      description: yup.string().required('Item description is required'),
      quantity: yup
        .number()
        .required('Quantity is required')
        .positive('Quantity must be positive')
        .integer('Quantity must be a whole number'),
      unit_price: yup
        .number()
        .required('Unit price is required')
        .positive('Unit price must be positive')
        .min(0.01, 'Unit price must be at least 0.01'),
    })
  ),
});

const EditRequest = () => {
  const { id } = useParams();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [proformaFile, setProformaFile] = useState(null);
  const [proformaPreview, setProformaPreview] = useState(null);

  // Fetch request details
  const { data: request, isLoading: loadingRequest } = useQuery({
    queryKey: ['purchaseRequest', id],
    queryFn: () => getPurchaseRequest(id),
    enabled: !!id,
  });

  // Fetch request types
  const { data: requestTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['requestTypes'],
    queryFn: getRequestTypes,
  });

  // Form setup
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting: formIsSubmitting },
    watch,
    reset,
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      amount: '',
      request_type_id: '',
      proforma: null,
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Populate form when request data is loaded
  useEffect(() => {
    if (request) {
      reset({
        title: request.title || '',
        description: request.description || '',
        amount: request.amount || '',
        request_type_id: request.request_type?.id || request.request_type_id || '',
        proforma: null, // Don't pre-fill file input
        items: request.items?.map(item => ({
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
        })) || [],
      });
    }
  }, [request, reset]);

  // Watch items to calculate total
  const items = watch('items');
  const calculatedTotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const formData = new FormData();
      
      // Add basic fields
      formData.append('title', data.title);
      formData.append('description', data.description);
      formData.append('amount', data.amount);
      formData.append('request_type_id', data.request_type_id);
      
      // Add proforma file if provided (new file)
      if (proformaFile) {
        formData.append('proforma', proformaFile);
      }
      
      // Add items as JSON string (only if items are provided)
      if (data.items && data.items.length > 0) {
        formData.append('items', JSON.stringify(data.items));
      }
      
      return updatePurchaseRequest(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['purchaseRequest', id]);
      queryClient.invalidateQueries(['myPurchaseRequests']);
      queryClient.invalidateQueries(['purchaseRequests']);
      navigate(`/requests/${id}`);
    },
  });

  // Handle proforma file change
  const handleProformaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProformaFile(file);
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setProformaPreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setProformaPreview(null);
      }
    }
  };

  // Handle form submission
  const onSubmit = async (data) => {
    try {
      await updateMutation.mutateAsync(data);
    } catch (error) {
      // Error is handled by mutation's onError
      console.error('Error updating request:', error);
    }
  };

  // Add new item
  const addItem = () => {
    append({ description: '', quantity: 1, unit_price: 0 });
  };

  if (loadingRequest) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500 mb-4"></i>
          <p className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Loading request...
          </p>
        </div>
      </div>
    );
  }

  if (!request || !request.can_be_edited) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6">
        <div className={`p-6 rounded-lg ${
          isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-lg ${isDark ? 'text-red-400' : 'text-red-600'}`}>
            <i className="fas fa-exclamation-circle mr-2"></i>
            This request cannot be edited. It may have been approved or rejected.
          </p>
          <button
            onClick={() => navigate(`/requests/${id}`)}
            className="mt-4 text-blue-500 hover:text-blue-600"
          >
            ← Back to Request Details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-6 sm:pb-10 pt-4 sm:pt-6 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(`/requests/${id}`)}
          className={`mb-4 flex items-center gap-2 text-sm ${
            isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <i className="fas fa-arrow-left"></i> Back to Request Details
        </button>
        <h1 className={`text-2xl sm:text-3xl font-bold ${
          isDark ? 'text-white' : 'text-gray-800'
        }`}>
          Edit Purchase Request
        </h1>
        <p className={`text-sm mt-1 ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          Update the details of your purchase request
        </p>
      </div>

      {/* Form - Same structure as CreateRequest */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className={`rounded-xl shadow-lg p-4 sm:p-6 transition-colors ${
          isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'
        }`}>
          {/* Error Message */}
          {updateMutation.isError && (
            <div className={`mb-6 p-4 rounded-lg ${
              isDark ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm ${
                isDark ? 'text-red-400' : 'text-red-600'
              }`}>
                <i className="fas fa-exclamation-circle mr-2"></i>
                {updateMutation.error?.response?.data?.error || 
                 updateMutation.error?.response?.data?.message ||
                 updateMutation.error?.message ||
                 'An error occurred while updating the request'}
              </p>
            </div>
          )}

          {/* Title */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('title')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title ? 'border-red-500' : ''
              }`}
              placeholder="Enter request title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register('description')}
              rows={4}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.description ? 'border-red-500' : ''
              }`}
              placeholder="Enter detailed description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Request Type */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Request Type <span className="text-red-500">*</span>
            </label>
            <select
              {...register('request_type_id')}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.request_type_id ? 'border-red-500' : ''
              }`}
              disabled={loadingTypes}
            >
              <option value="">Select request type</option>
              {requestTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
            {errors.request_type_id && (
              <p className="mt-1 text-sm text-red-500">{errors.request_type_id.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Total Amount (RWF) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('amount', { valueAsNumber: true })}
              className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.amount ? 'border-red-500' : ''
              }`}
              placeholder="0.00"
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Proforma Upload */}
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-2 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Proforma Invoice (Optional - upload new file to replace existing)
            </label>
            <div className="space-y-3">
              {request.proforma && !proformaFile && (
                <div className={`p-3 rounded-lg ${
                  isDark ? 'bg-gray-700 border border-gray-600' : 'bg-gray-50 border border-gray-200'
                }`}>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <i className="fas fa-file mr-2"></i>
                    Current: {request.proforma.split('/').pop()}
                  </p>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleProformaChange}
                className={`w-full px-4 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {proformaPreview && (
                <div className="mt-2">
                  <img
                    src={proformaPreview}
                    alt="Proforma preview"
                    className="max-w-xs rounded-lg border border-gray-300"
                  />
                </div>
              )}
              {proformaFile && !proformaPreview && (
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <i className="fas fa-file mr-2"></i>
                  {proformaFile.name}
                </p>
              )}
            </div>
          </div>

          {/* Items Section - Same as CreateRequest */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <label className={`block text-sm font-medium ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Items
              </label>
              <button
                type="button"
                onClick={addItem}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                <i className="fas fa-plus mr-1"></i> Add Item
              </button>
            </div>

            {fields.length > 0 && (
              <div className="space-y-4 mb-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className={`p-4 rounded-lg border ${
                      isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className={`text-sm font-medium ${
                        isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Item {index + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className={`text-red-500 hover:text-red-600 transition-colors`}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Description <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          {...register(`items.${index}.description`)}
                          className={`w-full px-3 py-2 rounded border text-sm ${
                            isDark
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          placeholder="Item description"
                        />
                        {errors.items?.[index]?.description && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.items[index].description.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className={`w-full px-3 py-2 rounded border text-sm ${
                            isDark
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          placeholder="1"
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.items[index].quantity.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Unit Price (RWF) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                          className={`w-full px-3 py-2 rounded border text-sm ${
                            isDark
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                          placeholder="0.00"
                        />
                        {errors.items?.[index]?.unit_price && (
                          <p className="mt-1 text-xs text-red-500">
                            {errors.items[index].unit_price.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {fields.length > 0 && calculatedTotal > 0 && (
              <div className={`p-3 rounded-lg ${
                isDark ? 'bg-blue-900/20 border border-blue-700' : 'bg-blue-50 border border-blue-200'
              }`}>
                <p className={`text-sm font-medium ${
                  isDark ? 'text-blue-300' : 'text-blue-700'
                }`}>
                  Calculated Total: {new Intl.NumberFormat('en-RW', {
                    style: 'decimal',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(calculatedTotal)} RWF
                </p>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={updateMutation.isLoading || formIsSubmitting}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isLoading || formIsSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i> Updating...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i> Update Request
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/requests/${id}`)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                isDark
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditRequest;

