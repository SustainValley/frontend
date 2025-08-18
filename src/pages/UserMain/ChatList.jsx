import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Chat.module.css";

import backIcon from "../../assets/chevron.svg";

const chats = [
  {
    id: 1,
    name: "매머드 익스프레스",
    preview: "안녕하세요. 매머드 익스프레스입니다.",
    unread: true,
  },
  {
    id: 2,
    name: "프렛커피",
    preview: "안녕하세요. 문의 주신 내용에 답변드립니다.",
    unread: false,
  },
  {
    id: 3,
    name: "풍치커피익스프레스공릉점",
    preview: "안녕하세요. 문의 주신 내용에 답변드립니다. 일단 노트북 이...",
    unread: false,
  },
];

export default function ChatList() {
  const navigate = useNavigate();

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

      {/* 채팅 목록 */}
      <div className={styles.chatList}>
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`${styles.chatItem} ${
              chat.unread ? styles.unread : styles.read
            }`}
            onClick={() => navigate(`/chat/${chat.id}`)}
          >
            <div className={styles.chatName}>{chat.name}</div>
            <div className={styles.chatPreview}>{chat.preview}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
