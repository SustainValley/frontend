import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OwnerSignup.module.css';
import { useOwnerSignup } from '../../../context/OwnerSignupContext';
import axios from 'axios';
import instance from '../../../lib/axios';

import logoImg from '../../../assets/Logo-main-fin.svg';

const loadDaumPostcode = () =>
  new Promise((resolve, reject) => {
    if (window.daum?.Postcode) return resolve(window.daum.Postcode);
    const existing = document.getElementById('daum-postcode-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.daum.Postcode));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src =
      'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.onload = () => resolve(window.daum.Postcode);
    script.onerror = reject;
    document.body.appendChild(script);
  });

const digits = (v) => (v || '').replace(/[^0-9]/g, '');

const formatBizNo = (v) => {
  const s = digits(v).slice(0, 10);
  if (s.length <= 3) return s;
  if (s.length <= 5) return `${s.slice(0, 3)}-${s.slice(3)}`;
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}`;
};

const OwnerSignup = () => {
  const navigate = useNavigate();

  const {
    bno, setBno,
    ownerName, setOwnerName,
    brandName, setBrandName,
    zip, setZip,
    addr1, setAddr1,
    addr2, setAddr2,
    verifyResult, setVerifyResult,
  } = useOwnerSignup();

  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [postcodeReady, setPostcodeReady] = useState(false);

  const [usernameMsg, setUsernameMsg] = useState('');
  const [usernameErr, setUsernameErr] = useState('');

  const RAW_KEY = process.env.REACT_APP_NTS_SERVICE_KEY || '';
  const IS_ENCODED = /%[0-9A-F]{2}/i.test(RAW_KEY);

  useEffect(() => {
    loadDaumPostcode()
      .then(() => setPostcodeReady(true))
      .catch(() => setPostcodeReady(false));
  }, []);

  const checkUsername = async (bizNoFormatted) => {
    setUsernameErr('');
    setUsernameMsg('');
    try {
      const { data } = await instance.post(
        '/api/users/signup/check-username',
        { username: bizNoFormatted }
      );
      setUsernameMsg(data?.message || '아이디 확인 결과를 불러왔습니다.');
    } catch (e) {
      setUsernameErr(
        e?.response?.data?.message ||
        '아이디 확인 중 오류가 발생했어요.'
      );
    }
  };

  const handleVerify = async () => {
    setVerifyError('');
    setVerifyResult(null);
    setUsernameErr('');
    setUsernameMsg('');

    const clean = digits(bno);
    if (clean.length !== 10) {
      setVerifyError('사업자번호는 숫자 10자리여야 해요.');
      return;
    }
    if (!RAW_KEY) {
      setVerifyError(
        '서비스 키가 비어있어요. .env.local에 REACT_APP_NTS_SERVICE_KEY 설정 후 개발 서버 재시작하세요.'
      );
      return;
    }

    try {
      setVerifying(true);

      const keyParam = IS_ENCODED ? RAW_KEY : encodeURIComponent(RAW_KEY);
      const ntsUrl =
        `https://api.odcloud.kr/api/nts-businessman/v1/status` +
        `?serviceKey=${keyParam}&returnType=JSON`;

      const [ntsRes] = await Promise.all([
        axios.post(
          ntsUrl,
          { b_no: [clean] },
          { headers: { 'Content-Type': 'application/json' } }
        ),
        checkUsername(bno),
      ]);

      const first = ntsRes?.data?.data?.[0];
      if (!first || !first.b_stt) {
        setVerifyError(
          '국세청에 등록되지 않은 사업자번호일 수 있어요. 다시 확인해주세요.'
        );
        return;
      }
      setVerifyResult(first);
    } catch (e) {
      setVerifyError(
        e?.response?.data?.message ||
        '인증 중 오류가 발생했어요.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenPostcode = async () => {
    try {
      await loadDaumPostcode();
      new window.daum.Postcode({
        oncomplete: (data) => {
          const baseAddr =
            data.userSelectedType === 'R'
              ? data.roadAddress
              : data.jibunAddress;
          setZip(data.zonecode);
          setAddr1(baseAddr);
          setTimeout(() => {
            document.getElementById('addr2')?.focus();
          }, 0);
        },
      }).open();
    } catch {
      alert('주소 검색 스크립트를 불러오지 못했습니다.');
    }
  };

  const statusBadge = () => {
    if (!verifyResult) return null;
    const st = verifyResult.b_stt;
    const cls =
      st === '계속사업자'
        ? styles.badgeGreen
        : st === '휴업자'
        ? styles.badgeOrange
        : styles.badgeRed;

    return (
      <div className={styles.verifyBox}>
        <span className={cls}>{st}</span>
        {verifyResult.tax_type && (
          <span className={styles.taxType}>
            과세유형: {verifyResult.tax_type}
          </span>
        )}
        {verifyResult.end_dt && (
          <span className={styles.endDt}>
            폐업일: {verifyResult.end_dt}
          </span>
        )}
      </div>
    );
  };

  const fieldsFilled = useMemo(() => {
    return (
      ownerName?.trim() &&
      brandName?.trim() &&
      zip?.trim() &&
      addr1?.trim() &&
      addr2?.trim()
    );
  }, [ownerName, brandName, zip, addr1, addr2]);

  const usernameOK = useMemo(() => {
    if (usernameErr) return false;
    if (!usernameMsg) return false;
    if (/이미\s*사용중/i.test(usernameMsg)) return false;
    return true;
  }, [usernameErr, usernameMsg]);

  const canProceed =
    verifyResult?.b_stt === '계속사업자' &&
    usernameOK &&
    fieldsFilled;

  return (
    <div className={styles.userSignupContainer}>
      <div className={styles.logo}>
        <img src={logoImg} alt="서비스 로고" className={styles.logoImg} />
      </div>

      <div className={styles.formSection}>
        <div className={styles.inputCard}>
          <label className={styles.label}>사업자 번호</label>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={bno}
              placeholder='사업자 번호 입력'
              onChange={(e) => {
                setBno(formatBizNo(e.target.value));
                setVerifyResult(null);
                setVerifyError('');
                setUsernameMsg('');
                setUsernameErr('');
              }}
            />
            <button
              className={styles.checkButton}
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? '인증중…' : '인증하기'}
            </button>
          </div>

          {usernameErr && <div className={styles.errorText}>{usernameErr}</div>}
          {usernameMsg && <div className={styles.successText}>{usernameMsg}</div>}
          {verifyError && <div className={styles.errorText}>{verifyError}</div>}
          {statusBadge()}
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label}>대표자 명</label>
          <input
            className={styles.input}
            value={ownerName}
            placeholder='대표자 명 입력'
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label}>상호</label>
          <input
            className={styles.input}
            value={brandName}
            placeholder='상호명 입력'
            onChange={(e) => setBrandName(e.target.value)}
          />
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label}>사업장주소</label>
          <div className={styles.inputRow}>
            <input className={styles.input} placeholder='우편번호' value={zip} readOnly />
            <button
              className={styles.checkButton}
              onClick={handleOpenPostcode}
              disabled={!postcodeReady}
            >
              주소 검색
            </button>
          </div>
          <input className={styles.input} placeholder='기본주소' value={addr1} readOnly />
          <input
            id="addr2"
            className={styles.input}
            value={addr2}
            placeholder='상세주소'
            onChange={(e) => setAddr2(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.inputCard}>
        <button
          className={styles.nextButton}
          disabled={!canProceed || verifying}
          onClick={() => navigate('/signup/owner/password')}
        >
          다음으로
        </button>
      </div>
    </div>
  );
};

export default OwnerSignup;
