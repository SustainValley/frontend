import React, { createContext, useContext, useState } from 'react';

const OwnerSignupCtx = createContext(null);

export const OwnerSignupProvider = ({ children }) => {
  const [bno, setBno] = useState('');               
  const [ownerName, setOwnerName] = useState('');   
  const [brandName, setBrandName] = useState('');   
  const [zip, setZip] = useState('');              
  const [addr1, setAddr1] = useState('');          
  const [addr2, setAddr2] = useState('');          
  const [password, setPassword] = useState('');    
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [verifyResult, setVerifyResult] = useState(null); 

  return (
    <OwnerSignupCtx.Provider value={{
      bno, setBno,
      ownerName, setOwnerName,
      brandName, setBrandName,
      zip, setZip,
      addr1, setAddr1,
      addr2, setAddr2,
      password, setPassword,
      phoneNumber, setPhoneNumber,
      verifyResult, setVerifyResult,
    }}>
      {children}
    </OwnerSignupCtx.Provider>
  );
};

export const useOwnerSignup = () => {
  const ctx = useContext(OwnerSignupCtx);
  if (!ctx) throw new Error('useOwnerSignup must be used within OwnerSignupProvider');
  return ctx;
};
