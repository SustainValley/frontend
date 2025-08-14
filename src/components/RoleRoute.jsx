import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleRoute = ({ allow = [] }) => {
  const { isAuthenticated, role } = useAuth();
  const loc = useLocation();

  if (!isAuthenticated) {
    if (loc.pathname !== '/login') return <Navigate to="/login" replace />;
    return null;
  }

  if (!role) return null;

  const r = String(role).trim().toLowerCase();
  const allowed = allow.map(a => String(a).toLowerCase());

  if (!allowed.includes(r)) {
    const target = r === 'owner' ? '/owner/home' : '/user/home';
    if (loc.pathname !== target) return <Navigate to={target} replace />;
    return null;
  }

  return <Outlet />;
};

export default RoleRoute;
