import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

import Login from './pages/Auth/Login/Login';
import Signup from './pages/Auth/Signup/Signup';
import UserSignup from './pages/Auth/Signup/UserSignup';
import OwnerSignup from './pages/Auth/Signup/OwnerSignup';
import UserNameSignup from './pages/Auth/Signup/UserNameSignup'; 
import UserPhoneSignup from './pages/Auth/Signup/UserPhoneSignup';
import UserCompleteSignup from './pages/Auth/Signup/UserCompleteSignup';

function App() {
  return (
    <div className="web-wrapper">
      <div className="web-container">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/signup/user" element={<UserSignup />} />
            <Route path="/signup/user/name" element={<UserNameSignup />} />
            <Route path="/signup/user/phone" element={<UserPhoneSignup />} />
            <Route path="/signup/user/complete" element={<UserCompleteSignup />} />
            <Route path="/signup/owner" element={<OwnerSignup />} />
          </Routes>
        </BrowserRouter>
      </div>
    </div>
  );
}

export default App;
