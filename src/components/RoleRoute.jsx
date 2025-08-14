import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleRoute({ allow }) {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allow && !allow.includes(auth.role)) {
    // 역할이 다른 보호 라우트 접근 시 해당 메인으로 돌려보내기
    return <Navigate to={auth.role === 'owner' ? '/owner/main' : '/user/main'} replace />;
  }

  return <Outlet />;
}
