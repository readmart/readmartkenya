import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * A wrapper component for routes that require authentication and specific roles.
 * Usage:
 * <ProtectedRoute allowedRoles={['admin', 'founder']}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, loading, hasRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // 1. Check if user is logged in
  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // 2. Check if roles are restricted and user has the required role
  if (allowedRoles && !hasRole(allowedRoles)) {
    // Redirect to home or an unauthorized page
    return <Navigate to="/" replace />;
  }

  // 3. Render children if all checks pass
  return <>{children}</>;
};

export default ProtectedRoute;
