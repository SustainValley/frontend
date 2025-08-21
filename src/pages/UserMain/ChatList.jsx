// src/pages/Chat/ChatList.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Chat.module.css";
import backIcon from "../../assets/chevron.svg";
import { useAuth } from "../../context/AuthContext";

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const uid =
      user?.userId ||
      Number(localStorage.getItem("user_id")) ||
      Number(localStorage.getItem("userId"));

    if (!uid) {
      setLoading(false);
      setError("로그인 정보가 없습니다.");
      return;
    }

    const fetchChats = async () => {
      try {
        const token =
          localStorage.getItem("accessToken") ||
          localStorage.getItem("token") ||
          "";

        const res = await fetch(`/hackathon/api/chat/${uid}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          credentials: "include",
        });

        // 네트워크/권한 확인
        if (!res.ok) {
          if (res.status === 401) {
            setError("로그인이 만료되었어요. 다시 로그인 해주세요.");
          } else {
            setError(`채팅방을 불러올 수 없습니다. (HTTP ${res.status})`);
          }
          setLoading(false);
          return;
        }

        const data = await res.json();

        if (data.isSuccess) {
          const mapped = (data.result ?? []).map((chat) => ({
            id: chat.roomId,
            name: chat.title === null ? "null" : (chat.title ?? ""),
            preview: chat.lastMessage ?? "",
            unread: !!chat.unread,
          }));
          setChats(mapped);
        } else {
          setError(data.message || "채팅방을 불러올 수 없습니다.");
        }
      } catch (err) {
        console.error(err);
        setError("서버 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [user]);

  return (
    <div className={styles.page}>
      <div className={styles.appbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <img src={backIcon} alt="뒤로가기" />
        </button>
        <div className={styles.title}>채팅 문의</div>
        <div style={{ width: 40 }} />
      </div>

      {loading && <div className={styles.chatList}>불러오는 중...</div>}
      {error && !loading && <div className={styles.chatList}>{error}</div>}

      {!loading && !error && (
        <div className={styles.chatList}>
          {chats.length === 0 ? (
            <div className={styles.chatItem}>채팅방이 없습니다.</div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={`${styles.chatItem} ${chat.unread ? styles.unread : styles.read}`}
                onClick={() => navigate(`/chat/${chat.id}`)}
              >
                <div className={styles.chatName}>{chat.name}</div>
                <div className={styles.chatPreview}>{chat.preview}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
