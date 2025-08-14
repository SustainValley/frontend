import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import RoleRoute from './components/RoleRoute';

import Login from './pages/Auth/Login/Login';
import Signup from './pages/Auth/Signup/Signup';
import UserSignup from './pages/Auth/Signup/UserSignup';
import UserNameSignup from './pages/Auth/Signup/UserNameSignup';
import UserPhoneSignup from './pages/Auth/Signup/UserPhoneSignup';
import UserCompleteSignup from './pages/Auth/Signup/UserCompleteSignup';
import OwnerSignup from './pages/Auth/Signup/OwnerSignup';
import OwnerPasswordSignup from './pages/Auth/Signup/OwnerPasswordSignup';
import OwnerPhoneSignup from './pages/Auth/Signup/OwnerPhoneSignup';
import OwnerCompleteSignup from './pages/Auth/Signup/OwnerCompleteSignup';

const UserMain  = React.lazy(() => import('./pages/UserMain/UserMain'));
const OwnerMain = React.lazy(() => import('./pages/OwnerMain/OwnerMain'));

const RootRedirect = () => {
  const auth = useAuth();
  if (auth.isAuthenticated) {
    return <Navigate to={auth.role === 'owner' ? '/owner/home' : '/user/home'} replace />;
  }
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <div className="web-wrapper">
      <div className="web-container">
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />

                {/* 로그인/회원가입 */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/signup/user" element={<UserSignup />} />
                <Route path="/signup/user/name" element={<UserNameSignup />} />
                <Route path="/signup/user/phone" element={<UserPhoneSignup />} />
                <Route path="/signup/user/complete" element={<UserCompleteSignup />} />
                <Route path="/signup/owner" element={<OwnerSignup />} />
                <Route path="/signup/owner/password" element={<OwnerPasswordSignup />} />
                <Route path="/signup/owner/phone" element={<OwnerPhoneSignup />} />
                <Route path="/signup/owner/complete" element={<OwnerCompleteSignup />} />

                {/* 역할별 보호 라우트 */}
                <Route element={<RoleRoute allow={['user']} />}>
                  <Route path="/user/home" element={<UserMain />} />
                </Route>

                <Route element={<RoleRoute allow={['owner']} />}>
                  <Route path="/owner/home" element={<OwnerMain />} />
                </Route>

                {/* 미지정 경로 처리 */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </div>
    </div>
  );
}

export default App;
