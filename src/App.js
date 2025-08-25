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

const StoreInfo       = React.lazy(() => import('./pages/OwnerMain/StoreInfo'));
const OperatingHours  = React.lazy(() => import('./pages/OwnerMain/OperatingHours'));
const BlockTime       = React.lazy(() => import('./pages/OwnerMain/BlockTime'));

const OwnerReservationList   = React.lazy(() => import('./pages/OwnerMain/OwnerReservationList'));
const OwnerReservationDetail = React.lazy(() => import('./pages/OwnerMain/OwnerReservationDetail'));

const PromotionPage = React.lazy(() => import('./pages/OwnerMain/PromotionPage'));

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

  if (!checked) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!role) return null;

  if (role === "owner") {
    if (!loc.pathname.startsWith("/owner") && !loc.pathname.startsWith("/chat")) {
      return <Navigate to="/owner/home" replace />;
    }
  } else if (role === "user") {
    if (!loc.pathname.startsWith("/user") && !loc.pathname.startsWith("/chat")) {
      return <Navigate to="/user/home" replace />;
    }
  }
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

function RequirePhone({ children }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || role !== 'user') return children;

  const hasPhoneRaw   = localStorage.getItem('has_phone_number');     
  const enforcePhone  = localStorage.getItem('phone_enforce') === '1';
  const isOnPhonePage = location.pathname.startsWith('/signup/user/phone');

  if (enforcePhone && hasPhoneRaw === '0' && !isOnPhonePage) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signup/user/phone?next=${next}`} replace />;
  }

  if ((!enforcePhone || hasPhoneRaw === '1') && isOnPhonePage) {
    const params = new URLSearchParams(location.search);
    const nextParam = params.get('next') || '/user/home';
    return <Navigate to={nextParam} replace />;
  }

  return children;
}

function App() {
  return (
    <div className="web-wrapper">
      <div className="web-container">
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={null}>
              <Routes>
                <Route path="/" element={<RootRedirect />} />

                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/oauth/kakao/callback" element={<KakaoCallback />} />

                <Route element={<UserSignupLayout />}>
                  <Route path="/signup/user" element={<UserSignup />} />
                  <Route path="/signup/user/name" element={<UserNameSignup />} />
                  <Route path="/signup/user/phone" element={<UserPhoneSignup />} />
                  <Route path="/signup/user/complete" element={<UserCompleteSignup />} />
                </Route>

                <Route element={<OwnerSignupLayout />}>
                  <Route path="/signup/owner" element={<OwnerSignup />} />
                  <Route path="/signup/owner/password" element={<OwnerPasswordSignup />} />
                  <Route path="/signup/owner/phone" element={<OwnerPhoneSignup />} />
                  <Route path="/signup/owner/complete" element={<OwnerCompleteSignup />} />
                </Route>

                <Route element={<RoleRoute allow={['user']} />}>
                  <Route
                    path="/user/home"
                    element={
                      <RequirePhone>
                        <UserMain />
                      </RequirePhone>
                    }
                  />
                  <Route
                    path="/user/filters"
                    element={
                      <RequirePhone>
                        <FilterPage />
                      </RequirePhone>
                    }
                  />
                  <Route
                    path="/user/reserve"
                    element={
                      <RequirePhone>
                        <Reserve />
                      </RequirePhone>
                    }
                  />
                </Route>

                <Route element={<RoleRoute allow={['owner']} />}>
                  <Route path="/owner/home" element={<OwnerMain />} />
                  <Route path="/owner/analysis" element={<OwnerAnalysis />} />
                  <Route path="/owner/promotion" element={<PromotionPage />} />
                  <Route path="/owner/store" element={<StoreInfo />} />
                  <Route path="/owner/store/hours" element={<OperatingHours />} />
                  <Route path="/owner/store/block-time" element={<BlockTime />} />
                  <Route path="/owner/reservations" element={<OwnerReservationList />} />
                  <Route path="/owner/reservation/:id" element={<OwnerReservationDetail />} />
                </Route>

                <Route element={<RoleRoute allow={['user','owner']} />}>
                  <Route
                    path="/chat"
                    element={
                      <RequirePhone>
                        <ChatList />
                      </RequirePhone>
                    }
                  />
                  <Route
                    path="/chat/:chatId"
                    element={
                      <RequirePhone>
                        <ChatRoom />
                      </RequirePhone>
                    }
                  />
                </Route>

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
