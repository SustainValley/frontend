import React from 'react';
import { useAuth } from '../../context/AuthContext';

const OwnerMain = () => {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <h1>사장님 메인</h1>
      <p>사업자번호 <b>{user?.id}</b> 로 로그인했습니다.</p>
      <button onClick={logout}>로그아웃</button>
    </div>
  );
};

export default OwnerMain;
