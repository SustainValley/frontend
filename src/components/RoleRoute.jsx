// src/components/RoleRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RoleRoute = ({ allow }) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!role) {
    return null; 
  }

  if (!allow.includes(role)) {
    const fallback = role === "owner" ? "/owner/home" : "/user/home";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
};


export default RoleRoute;
