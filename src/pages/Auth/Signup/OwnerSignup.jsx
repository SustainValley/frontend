import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OwnerSignup.module.css';
import { useOwnerSignup } from '../../../context/OwnerSignupContext';
import axios from 'axios';

import logoImg from '../../../assets/Logo-main-fin.svg';

const API_PREFIX = process.env.REACT_APP_API_PREFIX || '/hackathon/api';

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
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
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
      const { data } = await axios.post(
        `${API_PREFIX}/users/signup/check-username`,
        { username: bizNoFormatted },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (typeof data?.message === 'string') {
        setUsernameMsg(data.message);
      } else {
        setUsernameMsg('아이디 확인 결과를 불러왔습니다.');
      }
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        '아이디 확인 중 오류가 발생했어요.';
      setUsernameErr(msg);
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
      setVerifyError('서비스 키가 비어있어요. .env.local에 REACT_APP_NTS_SERVICE_KEY 설정 후 개발 서버 재시작하세요.');
      return;
    }

    try {
      setVerifying(true);

      const keyParam = IS_ENCODED ? RAW_KEY : encodeURIComponent(RAW_KEY);
      const ntsUrl = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${keyParam}&returnType=JSON`;

      const [ntsRes] = await Promise.all([
        axios.post(ntsUrl, { b_no: [clean] }, { headers: { 'Content-Type': 'application/json' } }),
        checkUsername(bno)
      ]);

      const json = ntsRes.data;
      const first = Array.isArray(json?.data) ? json.data[0] : null;
      if (!first || !first.b_stt) {
        setVerifyError('국세청에 등록되지 않은 사업자번호일 수 있어요. 다시 확인해주세요.');
        return;
      }
      setVerifyResult(first);
    } catch (e) {
      setVerifyError(e?.response?.data?.message || e?.message || '인증 중 오류가 발생했어요.');
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenPostcode = async () => {
    try {
      await loadDaumPostcode();
      new window.daum.Postcode({
        oncomplete: function (data) {
          const baseAddr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress;
          let extra = '';
          if (data.userSelectedType === 'R') {
            if (data.bname && /(동|로|가)$/.test(data.bname)) extra += data.bname;
            if (data.buildingName && data.apartment === 'Y') {
              extra += (extra ? ', ' : '') + data.buildingName;
            }
            if (extra) extra = ` (${extra})`;
          }
          setZip(data.zonecode);
          setAddr1(baseAddr + extra);
          setTimeout(() => {
            const el = document.getElementById('addr2');
            if (el) el.focus();
          }, 0);
        },
      }).open();
    } catch {
      alert('주소 검색 스크립트를 불러오지 못했습니다. 네트워크 상태를 확인해주세요.');
    }
  };

  const statusBadge = () => {
    if (!verifyResult) return null;
    const st = verifyResult.b_stt;
    const cls =
      st === '계속사업자' ? styles.badgeGreen :
      st === '휴업자'     ? styles.badgeOrange :
      styles.badgeRed;

    return (
      <div className={styles.verifyBox}>
        <span className={cls}>{st}</span>
        {verifyResult.tax_type && <span className={styles.taxType}>과세유형: {verifyResult.tax_type}</span>}
        {verifyResult.end_dt && <span className={styles.endDt}>폐업일: {verifyResult.end_dt}</span>}
      </div>
    );
  };

  const fieldsFilled = useMemo(() => {
    const hasOwner = (ownerName || '').trim().length > 0;
    const hasBrand = (brandName || '').trim().length > 0;
    const hasZip   = (zip || '').trim().length > 0;
    const hasAddr1 = (addr1 || '').trim().length > 0;
    const hasAddr2 = (addr2 || '').trim().length > 0;
    return hasOwner && hasBrand && hasZip && hasAddr1 && hasAddr2;
  }, [ownerName, brandName, zip, addr1, addr2]);

  const usernameOK = useMemo(() => {
    if (usernameErr) return false;
    if (!usernameMsg) return false;
    if (/이미\s*사용중|already\s*in\s*use/i.test(usernameMsg)) return false;
    return /가능|available|ok|사용 할 수|사용하실 수/i.test(usernameMsg);
  }, [usernameErr, usernameMsg]);

  const bnoHelpRender = useMemo(() => {
    if (usernameErr) {
      return (
        <div id="bnoHelp" className={styles.errorText} role="alert" aria-live="assertive">
          {usernameErr}
        </div>
      );
    }
    if (usernameMsg) {
      const isUsed = /이미\s*사용중|already\s*in\s*use/i.test(usernameMsg);
      const cls = isUsed ? styles.errorText : styles.successText;
      return (
        <div id="bnoHelp" className={cls} aria-live="polite">
          {usernameMsg}
        </div>
      );
    }
    return (
      <div id="bnoHelp" className={styles.subHint}>
        숫자 입력 시 자동으로 하이픈(-)이 붙어요.
      </div>
    );
  }, [usernameErr, usernameMsg]);

  const canProceed = verifyResult?.b_stt === '계속사업자' && usernameOK && fieldsFilled;

  return (
    <div className={styles.userSignupContainer}>
      <div className={styles.logo}>
        <img src={logoImg} alt="서비스 로고" className={styles.logoImg} />
      </div>

      <div className={styles.formSection}>
        <div className={styles.inputCard}>
          <label className={styles.label} htmlFor="bno">사업자 번호</label>
          <div className={styles.inputRow}>
            <input
              id="bno"
              type="text"
              placeholder="사업자 번호 입력 (숫자 10자리)"
              className={styles.input}
              value={bno}
              onChange={(e) => {
                setBno(formatBizNo(e.target.value));
                setUsernameMsg('');
                setUsernameErr('');
                setVerifyError('');
                setVerifyResult(null);
              }}
              inputMode="numeric"
              aria-describedby="bnoHelp bnoError"
            />
            <button
              className={styles.checkButton}
              onClick={handleVerify}
              disabled={verifying}
              title="국세청 상태 확인과 아이디(=사업자번호) 중복 여부를 함께 확인합니다."
            >
              {verifying ? '인증중…' : '인증하기'}
            </button>
          </div>

          {bnoHelpRender}

          {verifyError && (
            <div id="bnoError" className={styles.errorText} role="alert" aria-live="assertive">
              {verifyError}
            </div>
          )}

          {statusBadge()}
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label} htmlFor="ownerName">대표자 명</label>
          <input
            id="ownerName"
            type="text"
            placeholder="대표자 명 입력"
            className={styles.input}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label} htmlFor="brandName">상호</label>
          <input
            id="brandName"
            type="text"
            placeholder="상호명 입력"
            className={styles.input}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </div>

        <div className={styles.inputCard}>
          <label className={styles.label}>사업장주소</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              placeholder="우편번호"
              className={styles.input}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              readOnly
            />
            <button
              className={styles.checkButton}
              onClick={handleOpenPostcode}
              disabled={!postcodeReady}
              title={postcodeReady ? '' : '클릭 시 스크립트를 불러와요'}
            >
              주소 검색
            </button>
          </div>
          <input
            type="text"
            placeholder="기본주소"
            className={styles.input}
            value={addr1}
            onChange={(e) => setAddr1(e.target.value)}
            readOnly
          />
          <input
            id="addr2"
            type="text"
            placeholder="상세주소"
            className={styles.input}
            value={addr2}
            onChange={(e) => setAddr2(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.inputCard}>
        <button
          className={styles.nextButton}
          onClick={() => navigate('/signup/owner/password')}
          disabled={!canProceed || verifying}
          title={
            !verifyResult
              ? '사업자번호 인증을 먼저 진행하세요.'
              : verifyResult.b_stt !== '계속사업자'
              ? '계속사업자만 진행 가능합니다.'
              : !usernameOK
              ? '아이디(=사업자번호) 중복 확인을 통과해야 합니다.'
              : !fieldsFilled
              ? '대표자명, 상호, 주소(우편번호/기본/상세)를 모두 입력하세요.'
              : ''
          }
        >
          다음으로
        </button>
      </div>
    </div>
  );
};

export default OwnerSignup;
