import React, { useState } from 'react';
import styles from './OwnerPhoneSignup.module.css';
import { useNavigate } from 'react-router-dom';
import { useOwnerSignup } from '../../../context/OwnerSignupContext';


const digits = (v) => (v || '').replace(/[^0-9]/g, '');

const formatBizNo = (tenDigits) => {
  const s = digits(tenDigits).padEnd(10, '');
  if (s.length !== 10) return tenDigits;
  return `${s.slice(0,3)}-${s.slice(3,5)}-${s.slice(5)}`;
};

const formatPhone = (v) => {
  const s = digits(v);
  if (s.length < 9) return s;
  if (s.length === 9)  return `${s.slice(0,2)}-${s.slice(2,5)}-${s.slice(5)}`;
  if (s.length === 10) return `${s.slice(0,3)}-${s.slice(3,6)}-${s.slice(6)}`;
  return `${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7,11)}`;
};

const OwnerPhoneSignup = () => {
  const navigate = useNavigate();
  const {
    bno, ownerName, brandName, zip, addr1, addr2, password,
    phoneNumber, setPhoneNumber, verifyResult
  } = useOwnerSignup();

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  const canSubmit =
    verifyResult?.b_stt === '계속사업자' &&
    bno && ownerName && brandName && zip && addr1 && password &&
    digits(phoneNumber).length >= 9;

  const handleSubmit = async () => {
    setSubmitErr('');
    if (!canSubmit) {
      setSubmitErr('입력값을 다시 확인해주세요.');
      return;
    }

    const payload = {
      businessnumber: formatBizNo(bno),              
      presidentname: ownerName.trim(),                
      businessname: brandName.trim(),                  
      zipcode: zip.trim(),
      address: `${addr1} ${addr2}`.trim(),             
      password: password,                              
      provider: 'local',                               
      phoneNumber: formatPhone(phoneNumber),        
    };

    try {
      setSubmitting(true);
      const res = await fetch('/api/users/signup?type=cor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const data = (() => {
        try { return JSON.parse(text); } catch { return null; }
      })();

      if (!res.ok) {
        throw new Error(data?.message || text || `HTTP ${res.status}`);
      }

      if (!data?.userId) {
        
      }

      navigate('/signup/owner/complete', { state: { userId: data?.userId } });
    } catch (e) {
      setSubmitErr(e.message || '등록 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.wrapper}>
        <p className={styles.title}>전화번호를 입력해주세요</p>
        <p className={styles.subText}>매장 혹은 사장님 번호를 입력해주세요.</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>전화번호</label>
          <input
            className={styles.input}
            type="text"
            placeholder="전화번호"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(digits(e.target.value))}
            inputMode="numeric"
          />
        </div>

        {submitErr && <div className={styles.errorText}>{submitErr}</div>}

        <button
          className={styles.nextButton}
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          title={!canSubmit ? '입력값/사업자 인증을 확인해주세요.' : ''}
        >
          {submitting ? '등록 중…' : '매장 등록하기'}
        </button>
      </div>
    </div>
  );
};

export default OwnerPhoneSignup;
