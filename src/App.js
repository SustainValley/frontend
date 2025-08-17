// src/App.js
import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import './App.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import RoleRoute from './components/RoleRoute';

import { SignupProvider } from './context/SignupContext';
import { OwnerSignupProvider } from './context/OwnerSignupContext';

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

import KakaoCallback from './pages/Auth/Login/KakaoCallback';

import FilterPage from './pages/UserMain/FilterPage';

const Reserve  = React.lazy(() => import('./pages/UserMain/Reserve'));
const UserMain = React.lazy(() => import('./pages/UserMain/UserMain'));
const OwnerMain = React.lazy(() => import('./pages/OwnerMain/OwnerMain'));

const RootRedirect = () => {
  const { isAuthenticated, role, refresh } = useAuth();
  const loc = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refresh?.();
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [refresh]);

  if (!checked) return null;

  if (!isAuthenticated) {
    if (loc.pathname !== '/login') return <Navigate to="/login" replace />;
    return null;
  }

  if (!role) return null;

  const r = String(role).trim().toLowerCase();
  const target = r === 'owner' ? '/owner/home' : '/user/home';
  if (loc.pathname !== target) return <Navigate to={target} replace />;
  return null;
};

const UserSignupLayout = () => (
  <SignupProvider>
    <Outlet />
  </SignupProvider>
);

const OwnerSignupLayout = () => (
  <OwnerSignupProvider>
    <Outlet />
  </OwnerSignupProvider>
);

function App() {
  return (
    <div className="web-wrapper">
      <div className="web-container">
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<div />}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />

                {/* 로그인/메인 */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* 카카오 로그인 콜백 */}
                <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />

                {/* User 회원가입 스텝 */}
                <Route element={<UserSignupLayout />}>
                  <Route path="/signup/user" element={<UserSignup />} />
                  <Route path="/signup/user/name" element={<UserNameSignup />} />
                  <Route path="/signup/user/phone" element={<UserPhoneSignup />} />
                  <Route path="/signup/user/complete" element={<UserCompleteSignup />} />
                </Route>

                {/* Owner 회원가입 스텝 */}
                <Route element={<OwnerSignupLayout />}>
                  <Route path="/signup/owner" element={<OwnerSignup />} />
                  <Route path="/signup/owner/password" element={<OwnerPasswordSignup />} />
                  <Route path="/signup/owner/phone" element={<OwnerPhoneSignup />} />
                  <Route path="/signup/owner/complete" element={<OwnerCompleteSignup />} />
                </Route>

                {/* 역할별 보호 라우트 */}
                <Route element={<RoleRoute allow={['user']} />}>
                  <Route path="/user/home" element={<UserMain />} />
                  <Route path="/user/filters" element={<FilterPage />} />
                  <Route path="/user/reserve" element={<Reserve />} />
                </Route>

                <Route element={<RoleRoute allow={['owner']} />}>
                  <Route path="/owner/home" element={<OwnerMain />} />
                </Route>

                {/* 미지정 경로 처리 */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </div>
    </div>
  );
}

export default App;
