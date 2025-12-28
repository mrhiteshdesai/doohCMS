import React from 'react';
import { useAuth } from '../context/AuthContext';

interface PermissionGuardProps {
  module: string;
  action: 'create' | 'view' | 'update' | 'delete' | 'write' | 'publish' | 'edit' | 'read';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  module, 
  action, 
  children, 
  fallback = null 
}) => {
  const { checkPermission } = useAuth();

  if (!checkPermission(module, action)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGuard;
