import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Login from './components/auth/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import MyRequests from './pages/MyRequests/MyRequests';
import CreateRequest from './pages/CreateRequest/CreateRequest';
import EditRequest from './pages/EditRequest/EditRequest';
import RequestDetail from './pages/RequestDetail/RequestDetail';
import PendingApprovals from './pages/PendingApprovals/PendingApprovals';
import AllRequests from './pages/AllRequests/AllRequests';
import ApprovedRequests from './pages/ApprovedRequests/ApprovedRequests';
import UsersManagement from './pages/Admin/UsersManagement/UsersManagement';
import RequestTypes from './pages/Admin/RequestTypes/RequestTypes';
import ApprovalLevels from './pages/Admin/ApprovalLevels/ApprovalLevels';
import Profile from './pages/Profile/Profile';
import ProtectedRoute from './components/auth/ProtectedRoute/ProtectedRoute';
import Layout from './components/common/Layout/Layout';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes with Layout */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* Staff Routes */}
              <Route
                path="/requests/my-requests"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <MyRequests />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/create"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <CreateRequest />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RequestDetail />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <EditRequest />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* Approver Routes */}
              <Route
                path="/approvals/pending"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PendingApprovals />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* Common Routes */}
              <Route
                path="/requests/all"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AllRequests />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests/approved"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ApprovedRequests />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Profile />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* Admin Routes */}
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <UsersManagement />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/request-types"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <RequestTypes />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/approval-levels"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ApprovalLevels />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Catch all - redirect to dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
