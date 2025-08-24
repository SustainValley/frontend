import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./PromotionPage.module.css";
import backIcon from "../../assets/chevron-right.svg";

const MAX_LEN = 100;

export default function PromotionPage() {
  const navigate = useNavigate();
  const { state } = useLocation() || {};
  const cafeId = state?.cafeId ?? 7;

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const taRef = useRef(null);

  const autoResize = () => {
    const el = taRef.current;
    if (!el) return;
    const MAX_HEIGHT = 110; // px
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${h}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  };

  useEffect(() => {
    let alive = true;

    const fallback =
      state?.promotion?.rec_promotion?.trim() ||
      "금요일 18:00부터 회의실 예약 시 음료와 스낵 세트를 20% 할인된 가격에 구매할 수 있습니다.";

    setMessage(fallback.slice(0, MAX_LEN));

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(
          "https://port-0-analysis-api-mar0zdvm42447885.sel4.cloudtype.app/customer_promotion",
          {
            method: "POST",
            headers: {
              accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ rec_promotion: fallback }),
          }
        );
        const data = await res.json();
        if (!alive) return;

        const raw = (data?.customer_promo ?? "").trim();
        const unquoted = raw.replace(/^"(.*)"$/, "$1").trim();

        setMessage((unquoted || fallback).slice(0, MAX_LEN));
      } catch (e) {
        console.error("customer_promotion 호출 실패:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [state]);

  useEffect(() => {
    autoResize();
  }, [message]);

  const onChange = (e) => {
    setMessage(e.target.value.slice(0, MAX_LEN));
  };

  const onSave = async () => {
    const payload = { customerPromotion: message.trim() };
    if (!payload.customerPromotion) return;

    setLoading(true);
    try {
      const res = await fetch(
        `http://3.27.150.124:8080/hackathon/api/cafe/${cafeId}/promotions/save`,
        {
          method: "POST",
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      alert(data?.message || "프로모션이 정상 등록되었습니다.");
      navigate(-1);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>

      <div className={styles.header}>
        <img
          src={backIcon}
          alt="뒤로가기"
          className={styles.backBtn}
          onClick={() => navigate(-1)}
        />
        <span className={styles.title}>프로모션</span>
      </div>

      <div className={styles.body}>
        <p className={styles.caption}>MOCA의 프로모션 추천</p>

        <div className={styles.editor}>
          <textarea
            ref={taRef}
            className={styles.textarea}
            value={message}
            onChange={onChange}
            placeholder="여기에 프로모션 문구를 입력하세요."
            rows={3}
            maxLength={MAX_LEN}
            spellCheck={false}
          />
        </div>

        <div className={styles.limit}>최대 {MAX_LEN}자</div>

        <div className={styles.footerBar}>
          <button
            className={styles.primaryBtn}
            disabled={loading || message.trim().length === 0}
            onClick={onSave}
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}
