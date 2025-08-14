import React, { useState } from 'react';
import styles from './UserPhoneSignup.module.css';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../../../context/SignupContext';

const UserPhoneSignup = () => {
  const navigate = useNavigate();
  const { signupData, updateField } = useSignup();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePhone = p => /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(p);

  const onSubmit = async () => {
    if (!phone.trim()) return setError('전화번호를 입력해주세요.');
    if (!validatePhone(phone.trim())) return setError('전화번호 형식을 확인해주세요.');
    if (!signupData.username || !signupData.password || !signupData.nickname) {
      return setError('이전 단계 정보가 없습니다. 처음부터 다시 진행해주세요.');
    }

    setError('');
    setLoading(true);
    const payload = {
      username: signupData.username,
      nickname: signupData.nickname,
      password: signupData.password,
      provider: 'local',
      phoneNumber: phone.trim(),
    };

    try {
      const res = await fetch('/hackathon/api/users/signup?type=per', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `회원가입 실패 (status ${res.status})`);
      }

      const data = await res.json();
      updateField('phoneNumber', payload.phoneNumber);
      
      navigate('/signup/user/complete', { state: { message: data.message, userId: data.userId } });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.wrapper}>
        <p className={styles.title}>전화번호를 입력해주세요</p>
        <p className={styles.subText}>회의실 예약 시 사장님과 연락할 번호를 입력해주세요.</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>전화번호</label>
          <input
            className={styles.input}
            type="text"
            placeholder="전화번호"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            inputMode="tel"
          />
          {error && <div className={styles.errorText}>{error}</div>}
        </div>

        <button className={styles.nextButton} onClick={onSubmit} disabled={loading}>
          {loading ? '가입 중...' : '회원가입하기'}
        </button>
      </div>
    </div>
  );
};

export default UserPhoneSignup;
