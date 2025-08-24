import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './UserPhoneSignup.module.css';
import { useSignup } from '../../../context/SignupContext';
import instance from '../../../lib/axios';

import logoImg from '../../../assets/Logo-main-fin.svg';

const UserPhoneSignup = () => {
  const navigate = useNavigate();
  const { signupData, updateField } = useSignup();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePhone = (p) => /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(p);

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
      const { data } = await instance.post('/api/users/signup?type=per', payload);
      updateField('phoneNumber', payload.phoneNumber);
      navigate('/signup/user/complete', {
        state: { message: data.message, userId: data.userId },
      });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        '회원가입 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <img src={logoImg} alt="서비스 로고" className={styles.logoImg} />
      </div>

      <div className={styles.wrapper}>
        <p className={styles.title}>전화번호를 입력해주세요</p>
        <p className={styles.subText}>
          회의실 예약 시 사장님과 연락할 번호를 입력해주세요.
        </p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>전화번호</label>
          <input
            className={styles.input}
            type="text"
            placeholder="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
          {error && (
            <div className={styles.errorText} aria-live="assertive">
              {error}
            </div>
          )}
        </div>

        <button
          className={styles.nextButton}
          onClick={onSubmit}
          disabled={loading}
        >
          {loading ? '가입 중...' : '회원가입하기'}
        </button>
      </div>
    </div>
  );
};

export default UserPhoneSignup;
