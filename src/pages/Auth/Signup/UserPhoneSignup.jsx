import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './UserPhoneSignup.module.css';
import { useSignup } from '../../../context/SignupContext';
import instance, { setTokens, getUserId } from '../../../lib/axios';
import { useAuth } from '../../../context/AuthContext';

import logoImg from '../../../assets/Logo-main-fin.svg';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const normalizePhone = (raw) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  return raw;
};
const validatePhone = (p) => /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(p);

const UserPhoneSignup = () => {
  const navigate = useNavigate();
  const query = useQuery();

  const { signupData, updateField } = useSignup();
  const { isAuthenticated, role } = useAuth();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nextDest = query.get('next') || '/user/home';

  const isKakaoAddInfoMode =
    isAuthenticated &&
    role === 'user' &&
    !signupData?.username &&
    !signupData?.password &&
    !signupData?.nickname;

  const onSubmit = async () => {
    const formatted = normalizePhone(phone.trim());

    if (!formatted) return setError('전화번호를 입력해주세요.');
    if (!validatePhone(formatted))
      return setError('전화번호 형식을 확인해주세요. 예) 010-1234-5678');

    setError('');
    setLoading(true);

    try {
      if (isKakaoAddInfoMode) {
        
        const uid = getUserId();
        if (!uid) {
          throw new Error('사용자 정보를 찾을 수 없습니다. 다시 로그인해 주세요.');
        }

        await instance.patch(`/api/users/${uid}/addinfo`, {
          phonenumber: formatted, 
        });

        setTokens({ hasPhoneNumber: true });

        navigate(nextDest, { replace: true });
        return;
      }

      if (!signupData.username || !signupData.password || !signupData.nickname) {
        setError('이전 단계 정보가 없습니다. 처음부터 다시 진행해주세요.');
        return;
      }

      const payload = {
        username: signupData.username,
        nickname: signupData.nickname,
        password: signupData.password,
        provider: 'local',
        phoneNumber: formatted,
      };

      const { data } = await instance.post('/api/users/signup?type=per', payload);
      updateField('phoneNumber', payload.phoneNumber);

      navigate('/signup/user/complete', {
        state: { message: data?.message, userId: data?.userId },
      });
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        '처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const title = isKakaoAddInfoMode ? '전화번호를 등록해주세요' : '전화번호를 입력해주세요';
  const subText = isKakaoAddInfoMode
    ? '회의실 예약 시 사장님과 연락할 번호를 등록합니다.'
    : '회의실 예약 시 사장님과 연락할 번호를 입력해주세요.';
  const buttonLabel = isKakaoAddInfoMode ? '등록하기' : '회원가입하기';

  return (
    <div className={styles.container}>
      <div className={styles.logo}>
        <img src={logoImg} alt="서비스 로고" className={styles.logoImg} />
      </div>

      <div className={styles.wrapper}>
        <p className={styles.title}>{title}</p>
        <p className={styles.subText}>{subText}</p>

        <div className={styles.inputGroup}>
          <label className={styles.label}>전화번호</label>
          <input
            className={styles.input}
            type="text"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setPhone((p) => normalizePhone(p))}
            inputMode="tel"
            autoComplete="tel-national"
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
          {loading ? '처리 중...' : buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default UserPhoneSignup;
