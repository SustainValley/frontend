import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OwnerSignup.module.css';

const OwnerSignup = () => {
  const navigate = useNavigate();

  const [bno, setBno] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [zip, setZip] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const RAW_KEY = process.env.REACT_APP_NTS_SERVICE_KEY || ''; 
  const IS_ENCODED = /%[0-9A-F]{2}/i.test(RAW_KEY);

  const onlyDigits10 = (v) => v.replace(/[^0-9]/g, '').slice(0, 10);

  const handleVerifyFrontendOnly = async () => {
    setVerifyError('');
    setVerifyResult(null);

    const clean = onlyDigits10(bno);
    if (clean.length !== 10) {
      setVerifyError('사업자번호는 하이픈 없이 숫자 10자리여야 해요.');
      return;
    }
    if (!RAW_KEY) {
      setVerifyError('서비스 키가 비어있어요. 프로젝트 루트의 .env.local에 REACT_APP_NTS_SERVICE_KEY를 설정하고 개발 서버를 재시작하세요.');
      return;
    }

    try {
      setVerifying(true);
      const keyParam = IS_ENCODED ? RAW_KEY : encodeURIComponent(RAW_KEY);
      const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${keyParam}&returnType=JSON`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: [clean] }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || '인증 호출 실패');

      const first = Array.isArray(json?.data) ? json.data[0] : null;

      if (!first || !first.b_stt) {
        setVerifyError('국세청에 등록되지 않은 사업자번호일 수 있어요. 다시 확인해주세요.');
        return;
      }

      setVerifyResult(first);
    } catch (e) {
      setVerifyError(e.message || '인증 중 오류가 발생했어요.');
    } finally {
      setVerifying(false);
    }
  };

  const statusBadge = () => {
    if (!verifyResult) return null;
    const st = verifyResult.b_stt; // 계속사업자 | 휴업자 | 폐업자
    const cls =
      st === '계속사업자' ? styles.badgeGreen :
      st === '휴업자'     ? styles.badgeOrange :
      styles.badgeRed;

    return (
      <div className={styles.verifyBox}>
        <span className={cls}>{st}</span>
        {verifyResult.tax_type && (
          <span className={styles.taxType}>과세유형: {verifyResult.tax_type}</span>
        )}
        {verifyResult.end_dt && (
          <span className={styles.endDt}>폐업일: {verifyResult.end_dt}</span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.userSignupContainer}>
      <div className={styles.logo}>Logo</div>

      <div className={styles.formSection}>
        {/* 사업자 번호 */}
        <div className={styles.inputCard}>
          <label className={styles.label} htmlFor="bno">사업자 번호</label>
          <div className={styles.inputRow}>
            <input
              id="bno"
              type="text"
              placeholder="사업자 번호 입력 (숫자 10자리)"
              className={styles.input}
              value={bno}
              onChange={(e) => setBno(onlyDigits10(e.target.value))}
              inputMode="numeric"
              aria-describedby="bnoHelp bnoError"
            />
            <button
              className={styles.checkButton}
              onClick={handleVerifyFrontendOnly}
              disabled={verifying}
            >
              {verifying ? '인증중…' : '인증하기'}
            </button>
          </div>

          {/* 아래 안내/에러/상태 */}
          <div id="bnoHelp" className={styles.subHint}>
            하이픈( - ) 없이 숫자 10자리로 입력해 주세요.
          </div>
          {verifyError && (
            <div id="bnoError" className={styles.errorText} role="alert" aria-live="assertive">
              {verifyError}
            </div>
          )}
          {statusBadge()}
        </div>

        {/* 대표자 명 */}
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

        {/* 상호 */}
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

        {/* 주소 */}
        <div className={styles.inputCard}>
          <label className={styles.label}>사업장주소</label>
          <div className={styles.inputRow}>
            <input
              type="text"
              placeholder="우편번호"
              className={styles.input}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
            <button className={styles.checkButton}>주소 검색</button>
          </div>
          <input
            type="text"
            placeholder="기본주소"
            className={styles.input}
            value={addr1}
            onChange={(e) => setAddr1(e.target.value)}
          />
          <input
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
          disabled={!verifyResult || verifyResult.b_stt !== '계속사업자'}
          title={!verifyResult ? '사업자번호 인증을 먼저 진행하세요.' :
                 verifyResult.b_stt !== '계속사업자' ? '계속사업자만 진행 가능합니다.' : ''}
        >
          다음으로
        </button>
      </div>
    </div>
  );
};

export default OwnerSignup;
