import React, { createContext, useContext, useState } from 'react';

const SignupContext = createContext(null);

export const SignupProvider = ({ children }) => {
  const [signupData, setSignupData] = useState({
    username: '',
    password: '',
    nickname: '',
    phoneNumber: '',
  });

  const updateField = (key, value) => {
    setSignupData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SignupContext.Provider value={{ signupData, updateField, setSignupData }}>
      {children}
    </SignupContext.Provider>
  );
};

export const useSignup = () => {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error('useSignup must be used within SignupProvider');
  return ctx;
};
