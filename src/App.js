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

const Reserve       = React.lazy(() => import('./pages/UserMain/Reserve'));
const UserMain      = React.lazy(() => import('./pages/UserMain/UserMain'));
const OwnerMain     = React.lazy(() => import('./pages/OwnerMain/OwnerMain'));
const OwnerAnalysis = React.lazy(() => import('./pages/OwnerMain/OwnerAnalysis'));

const ChatList      = React.lazy(() => import('./pages/UserMain/ChatList'));
const ChatRoom      = React.lazy(() => import('./pages/UserMain/ChatRoom'));

// ✅ RootRedirect: 새로고침 시 안전 처리
const RootRedirect = () => {
  const { isAuthenticated, role, refreshNow } = useAuth();
  const loc = useLocation();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshNow?.();
      } finally {
        if (alive) setChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [refreshNow]);

  // ✅ 아직 refresh 체크 중이면 아무 것도 안 보여줌
  if (!checked) return null;

  // 로그인 안 됨
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // role 아직 안 잡힘이면 그냥 대기 (안보임)
  if (!role) return null;

  // role에 따라 홈 리다이렉트
  if (role === "owner") {
    if (!loc.pathname.startsWith("/owner")) {
      return <Navigate to="/owner/home" replace />;
    }
  } else if (role === "user") {
    if (!loc.pathname.startsWith("/user")) {
      return <Navigate to="/user/home" replace />;
    }
  }

  return null;
};

// User 회원가입 레이아웃
const UserSignupLayout = () => (
  <SignupProvider>
    <Outlet />
  </SignupProvider>
);

// Owner 회원가입 레이아웃
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
            <Suspense fallback={null}>
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

                {/* 사용자 라우트 */}
                <Route element={<RoleRoute allow={['user']} />}>
                  <Route path="/user/home" element={<UserMain />} />
                  <Route path="/user/filters" element={<FilterPage />} />
                  <Route path="/user/reserve" element={<Reserve />} />
                  <Route path="/chat" element={<ChatList />} />
                  <Route path="/chat/:chatId" element={<ChatRoom />} />
                </Route>

                {/* 사장님 라우트 */}
                <Route element={<RoleRoute allow={['owner']} />}>
                  <Route path="/owner/home" element={<OwnerMain />} />
                  <Route path="/owner/analysis" element={<OwnerAnalysis />} />
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
