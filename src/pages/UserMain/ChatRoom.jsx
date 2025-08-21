// src/pages/Chat/ChatRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Stomp } from "@stomp/stompjs";
import styles from "./Chat.module.css";
import { useAuth } from "../../context/AuthContext";

import backIcon from "../../assets/chevron.svg";
import sendIcon from "../../assets/tabler_send.svg";

const IS_DEV = process.env.NODE_ENV === "development";
const API_HOST = ISDEV_HACK();
function ISDEV_HACK() {
  return process.env.NODE_ENV === "development" ? "http://3.27.150.124:8080" : "";
}
const API_PREFIX = `${API_HOST}/hackathon/api`;
const WS_URL = `${
  IS_DEV
    ? "ws://3.27.150.124:8080"
    : (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host
}/hackathon/api/ws-stomp`;

const ZW_REGEX = /[\u200B-\u200D\uFEFF]/g; 
const NL_REGEX = /\r\n|\r/g;
const WS_REGEX = /[ \t]+/g;
const normalizeText = (s = "") =>
  s.replace(ZW_REGEX, "").replace(NL_REGEX, "\n").replace(WS_REGEX, " ").trim();

const safeText = (obj) =>
  normalizeText(obj?.message ?? obj?.text ?? obj?.content ?? obj?.body ?? "");

const toISO = (v) => (v ? new Date(v).toISOString() : new Date().toISOString());
const uuid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const num = (v) => (v === null || v === undefined ? null : Number(v));

const sameByIdentity = (a, b) => {
  const aSid = a.serverId ?? a.id;
  const bSid = b.serverId ?? b.id;
  if (aSid && bSid) return String(aSid) === String(bSid);
  return (num(a.sender) ?? null) === (num(b.sender) ?? null) && String(a.createdAt) === String(b.createdAt);
};

const isMatchPending = (pending, incoming, myId) => {
  if (pending.state !== "pending") return false;

  if (pending.clientId && incoming.tempId && String(pending.clientId) === String(incoming.tempId)) {
    return true;
  }

  const sameSenderIsMe = num(pending.sender) === num(myId) && num(incoming.sender) === num(myId);
  if (!sameSenderIsMe) return false;

  if (normalizeText(pending.text ?? pending.message) !== normalizeText(incoming.text ?? incoming.message)) {
    return false;
  }

  const dt = Math.abs(new Date(incoming.createdAt).getTime() - new Date(pending.createdAt).getTime());
  return dt <= 10000;
};

export default function ChatRoom() {
  const navigate = useNavigate();
  const params = useParams();
  const roomId = Number(params.chatId ?? params.roomId);

  const { user } = useAuth();
  const globalUserId =
    user?.userId ?? num(localStorage.getItem("user_id")) ?? num(localStorage.getItem("userId")) ?? null;

  const token = localStorage.getItem("accessToken") || localStorage.getItem("token") || "";

  const stompRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const subscribedRef = useRef(false);

  const [chatRoomUserId, setChatRoomUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const isMine = (payload) => {
    const candidates = [
      num(payload?.sender),
      num(payload?.userId),
      num(payload?.fromUserId),
      num(payload?.authorId),
    ].filter((v) => Number.isFinite(v));
    return candidates.some((id) => id === num(chatRoomUserId) || id === num(globalUserId));
  };

  const loadChatRoomUserId = async () => {
    if (!globalUserId || !roomId) return;
    try {
      const res = await fetch(`${API_PREFIX}/chat/${globalUserId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const row = (data.result || []).find((r) => r.roomId === roomId);
      if (row?.chatRoomUserId) setChatRoomUserId(row.chatRoomUserId);
    } catch {}
  };

  const markEnter = async () => {
    if (!roomId || !globalUserId) return;
    try {
      await fetch(`${API_PREFIX}/chat/room/${roomId}/enter?userId=${globalUserId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
    } catch {}
  };

  function reconcileWithServer(prev, serverList) {
    let out = [...prev];

    for (const s of serverList) {
      const pIdx = out.findIndex((m) => isMatchPending(m, s, chatRoomUserId ?? globalUserId));
      if (pIdx !== -1) {
        const copy = [...out];
        copy[pIdx] = { ...copy[pIdx], ...s, state: "sent" };
        out = copy;
        continue;
      }

      const already = out.some((m) => sameByIdentity(m, s));
      if (!already) out.push(s);
    }

    out.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    return out;
  }

  const fetchMessages = async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`${API_PREFIX}/chat/room?id=${roomId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.result || []).map((m) => {
        const text = safeText(m);
        const mine = isMine(m);
        return {
          serverId: m.id ?? undefined,
          id: m.id ?? undefined,
          tempId: m.tempId ?? undefined,
          sender: num(m.sender) ?? num(m.userId) ?? undefined,
          message: text,
          text,
          createdAt: toISO(m.createdAt ?? m.timestamp),
          from: mine ? "me" : "store",
          name: mine ? "나" : "상대방",
          state: "sent",
        };
      });
      setMessages((prev) => reconcileWithServer(prev, list));
    } catch {}
  };

  const connect = () => {
    if (!roomId || subscribedRef.current) return;
    const ws = new WebSocket(WS_URL);
    const client = Stomp.over(ws);

    client.heartbeat.outgoing = 0;
    client.heartbeat.incoming = 0;
    client.debug = (s) => console.log(s);

    stompRef.current = client;

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    client.connect(
      headers,
      () => {
        client.subscribe(`/sub/chatroom/${roomId}`, (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            const text = safeText(payload);
            const mine = isMine(payload);

            const incoming = {
              serverId: payload.id ?? undefined,
              id: payload.id ?? undefined,
              tempId: payload.tempId ?? undefined,
              sender: num(payload.sender) ?? num(payload.userId) ?? undefined,
              message: text,
              text,
              createdAt: toISO(payload.createdAt ?? payload.timestamp),
              from: mine ? "me" : "store",
              name: mine ? "나" : "상대방",
              state: "sent",
            };

            setMessages((prev) => {
              const pIdx = prev.findIndex((m) => isMatchPending(m, incoming, chatRoomUserId ?? globalUserId));
              if (pIdx !== -1) {
                const copy = [...prev];
                copy[pIdx] = { ...copy[pIdx], ...incoming, state: "sent" };
                return copy;
              }

              const dup = prev.some((m) => sameByIdentity(m, incoming));
              if (dup) return prev;

              const myId = chatRoomUserId ?? globalUserId;
              const sameTextPendings = prev
                .map((m, idx) => ({ m, idx }))
                .filter(
                  ({ m }) =>
                    m.state === "pending" &&
                    num(m.sender) === num(myId) &&
                    normalizeText(m.text ?? m.message) === normalizeText(incoming.text ?? incoming.message)
                );
              if (sameTextPendings.length === 1) {
                const copy = [...prev];
                const { idx } = sameTextPendings[0];
                copy[idx] = { ...copy[idx], ...incoming, state: "sent" };
                return copy;
              }

              // 4) 매칭 실패 시 새로 추가
              return [...prev, incoming];
            });
          } catch (e) {
            console.error("메시지 파싱 오류:", e, frame.body);
          }
        });

        client.subscribe(`/user/queue/errors`, (err) => {
          try {
            const p = JSON.parse(err.body);
            alert(`❌ 에러: ${p.message ?? "알 수 없는 오류"}`);
          } catch {
            alert(`❌ 에러: ${err.body}`);
          }
        });

        subscribedRef.current = true;
      },
      (err) => {
        console.error("STOMP connect error:", err);
      }
    );
  };

  const disconnect = () => {
    try {
      subscribedRef.current = false;
      stompRef.current?.disconnect(() => console.log("WebSocket disconnected"));
    } catch {}
  };

  useEffect(() => {
    if (!roomId || Number.isNaN(roomId)) return;
    (async () => {
      await loadChatRoomUserId();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, globalUserId]);

  useEffect(() => {
    if (!roomId || !chatRoomUserId) return;
    connect();
    (async () => {
      await markEnter();
      await fetchMessages();
    })();
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, chatRoomUserId]);

  const sendMessage = () => {
    const textRaw = input;
    const text = normalizeText(textRaw);
    if (!text) return;

    const sc = stompRef.current;
    if (!sc) {
      alert("연결 상태가 불안정해요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!chatRoomUserId) {
      alert("방 참여자 정보를 아직 못 찾았어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const nowISO = new Date().toISOString();
    const clientId = uuid();

    setMessages((prev) => [
      ...prev,
      {
        clientId,
        sender: chatRoomUserId,
        message: text,
        text,
        createdAt: nowISO,
        from: "me",
        name: "나",
        state: "pending",
      },
    ]);

    sc.send(
      "/pub/message",
      {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
      },
      JSON.stringify({ roomId, message: text, sender: chatRoomUserId, tempId: clientId, createdAt: nowISO })
    );

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setTimeout(fetchMessages, 1500);

    setTimeout(() => {
      setMessages((prev) => {
        const hasSameSent = prev.some(
          (m) => m.state === "sent" && m.from === "me" && normalizeText(m.text ?? m.message) === normalizeText(text)
        );
        if (hasSameSent) return prev;
        return prev.map((m) => (m.clientId === clientId && m.state === "pending" ? { ...m, state: "failed" } : m));
      });
    }, 7000);
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className={styles.page}>
      <div className={styles.appbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <img src={backIcon} alt="뒤로가기" />
        </button>
        <div className={styles.title}>채팅 문의</div>
        <div style={{ width: 40 }} />
      </div>

      <div className={styles.chatWindow}>
        {messages.map((msg, i) => {
          const key =
            (msg.serverId ?? msg.id)
              ? `sid-${msg.serverId ?? msg.id}`
              : msg.clientId
              ? `cid-${msg.clientId}`
              : `at-${msg.createdAt}-${i}`;

          return msg.from === "store" ? (
            <div key={key} className={styles.messageRow}>
              <div className={styles.profile}></div>
              <div className={styles.messageContent}>
                <div className={styles.senderName}>{msg.name || "상대방"}</div>
                <div className={`${styles.bubble} ${styles.store}`}>{msg.text ?? msg.message}</div>
              </div>
            </div>
          ) : (
            <div key={key} className={styles.messageRow} style={{ justifyContent: "flex-end" }}>
              <div className={`${styles.bubble} ${styles.me}`}>
                {msg.text ?? msg.message}
                {/* 전송중/실패 배지는 '텍스트'로 넣지 않음 → 말풍선 모서리에 고정 */}
                {msg.state === "pending" && <i className={styles.pendingDot} aria-label="전송 중" />}
                {msg.state === "failed" && <span title="전송 실패" className={styles.failedBadge}>!</span>}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* 입력창 */}
      <div className={styles.inputBar}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지 보내기"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (e.nativeEvent.isComposing) return;
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button onClick={sendMessage}>
          <img src={sendIcon} alt="보내기" />
        </button>
      </div>
    </div>
  );
}
