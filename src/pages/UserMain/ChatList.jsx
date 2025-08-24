// src/pages/Chat/ChatList.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Chat.module.css";
import backIcon from "../../assets/chevron.svg";
import { useAuth } from "../../context/AuthContext";
import { Client } from "@stomp/stompjs";

const IS_DEV = process.env.NODE_ENV === "development";

// REST 베이스 (개발=EC2, 배포=도메인)
const API_HOST = IS_DEV ? "http://3.27.150.124:8080" : "https://mocacafe.site";
const API_PREFIX = `${API_HOST}/hackathon/api`;

// WS-STOMP 베이스 (개발=EC2, 배포=도메인 직결)
const WS_BASE = IS_DEV ? "ws://3.27.150.124:8080" : "wss://mocacafe.site";
const WS_PATH = "/hackathon/api/ws-stomp";
const WS_URL = `${WS_BASE}${WS_PATH}`;

export default function ChatList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [chats, setChats] = useState([]); // [{id, name, preview, unread}]
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const stompRef = useRef(null);
  const subscribedRoomIdsRef = useRef(new Set());
  const pollingTimerRef = useRef(null);

  const uid =
    user?.userId ||
    Number(localStorage.getItem("user_id")) ||
    Number(localStorage.getItem("userId"));

  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token") ||
    "";

  const upsertChatPreview = (roomId, lastText, fromUserId) => {
    setChats((prev) => {
      const idx = prev.findIndex((c) => Number(c.id) === Number(roomId));
      const mine = Number(fromUserId) === Number(uid);

      if (idx === -1) {
        return [
          {
            id: roomId,
            name: "",
            preview: lastText ?? "",
            unread: mine ? false : true,
          },
          ...prev,
        ];
      }
      const next = [...prev];
      next[idx] = {
        ...prev[idx],
        preview: lastText ?? prev[idx].preview,
        unread: mine ? false : true,
      };
      next.sort((a, b) => (a.id === roomId ? -1 : b.id === roomId ? 1 : 0));
      return next;
    });
  };

  // --- REST: 방 목록 불러오기 ---
  const fetchChats = async () => {
    if (!uid) {
      setLoading(false);
      setError("로그인 정보가 없습니다.");
      return;
    }
    try {
      const res = await fetch(`${API_PREFIX}/chat/${uid}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) setError("로그인이 만료되었어요. 다시 로그인 해주세요.");
        else setError(`채팅방을 불러올 수 없습니다. (HTTP ${res.status})`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.isSuccess) {
        const mapped = (data.result ?? []).map((chat) => ({
          id: chat.roomId,
          name: chat.title ?? "",
          preview: chat.lastMessage ?? "",
          unread: !!chat.unread,
        }));
        setChats(mapped);
      } else {
        setError(data.message || "채팅방을 불러올 수 없습니다.");
      }
    } catch (e) {
      console.error(e);
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const ensureStompConnected = () => {
    if (stompRef.current?.connected) return;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      debug: () => {},
    });

    client.onConnect = () => {
      subscribedRoomIdsRef.current.clear();
      chats.forEach((c) => subscribeRoomTopic(client, c.id));
    };

    client.onStompError = (frame) => {
      console.error("STOMP error:", frame.headers?.message, frame.body);
    };
    client.onWebSocketError = (evt) => {
      console.error("WS error:", evt);
    };
    client.onWebSocketClose = (evt) => {
      console.warn("WS closed:", evt.code, evt.reason);
    };

    client.activate();
    stompRef.current = client;
  };

  const subscribeRoomTopic = (client, roomId) => {
    if (!client?.connected) return;
    const setKey = subscribedRoomIdsRef.current;
    const key = String(roomId);
    if (setKey.has(key)) return;

    client.subscribe(`/sub/chatroom/${roomId}`, (frame) => {
      try {
        const payload = JSON.parse(frame.body);
        const text =
          (payload?.message ?? payload?.text ?? payload?.content ?? payload?.body ?? "").toString();
        const fromUserId = payload?.sender ?? payload?.userId;
        upsertChatPreview(roomId, text, fromUserId);
      } catch (e) {
        console.error("메시지 파싱 오류:", e, frame.body);
      }
    });

    setKey.add(key);
  };

  useEffect(() => {
    if (!stompRef.current?.connected) return;
    chats.forEach((c) => subscribeRoomTopic(stompRef.current, c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats]);

  useEffect(() => {
    (async () => {
      await fetchChats();
      ensureStompConnected();
      if (!pollingTimerRef.current) {
        pollingTimerRef.current = setInterval(fetchChats, 30000);
      }
    })();

    return () => {
      try {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
        subscribedRoomIdsRef.current.clear();
        stompRef.current?.deactivate();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

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
                onClick={() =>
                  navigate(`/chat/${chat.id}`, {
                    state: { roomName: chat.name }, 
                  })
                }
              >
                <div className={styles.chatName}>{chat.name || "대화"}</div>
                <div className={styles.chatPreview}>{chat.preview}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
