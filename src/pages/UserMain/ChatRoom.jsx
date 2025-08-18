import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./Chat.module.css";

import backIcon from "../../assets/chevron.svg";
import sendIcon from "../../assets/tabler_send.svg"; 

export default function ChatRoom() {
  const navigate = useNavigate();
  const { chatId } = useParams();

  const [messages, setMessages] = useState([
    { from: "store", name: "매머드 익스프레스", text: "안녕하세요, 매머드 익스프레스입니다." },
    {
      from: "me",
      text: "안녕하세요. 문의할 것이 있어서 연락드립니다.\n혹시 오늘 오후 3시에 8명도 예약이 가능할까요?\n답변 기다리겠습니다. 감사합니다.",
    },
  ]);

  const [input, setInput] = useState("");
  const textareaRef = useRef(null);
  const chatEndRef = useRef(null);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { from: "me", text: input.trim() }]);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; 
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return; 
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }, [input]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={styles.page}>
      {/* 상단 바 */}
      <div className={styles.appbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <img src={backIcon} alt="뒤로가기" />
        </button>
        <div className={styles.title}>채팅 문의</div>
        <div style={{ width: "40px" }} />
      </div>

      {/* 메시지 영역 */}
      <div className={styles.chatWindow}>
        {messages.map((msg, i) =>
          msg.from === "store" ? (
            <div key={i} className={styles.messageRow}>
              <div className={styles.profile}></div>
              <div className={styles.messageContent}>
                <div className={styles.senderName}>{msg.name || "상대방"}</div>
                <div className={`${styles.bubble} ${styles.store}`}>{msg.text}</div>
              </div>
            </div>
          ) : (
            <div key={i} className={styles.messageRow} style={{ justifyContent: "flex-end" }}>
              <div className={`${styles.bubble} ${styles.me}`}>{msg.text}</div>
            </div>
          )
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 입력창 */}
      <div className={styles.inputBar}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 보내기"
          rows={1}
        />
        <button onClick={sendMessage}>
          <img src={sendIcon} alt="보내기" />
        </button>
      </div>
    </div>
  );
}
