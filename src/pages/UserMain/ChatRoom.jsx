// src/pages/Chat/ChatRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import styles from "./Chat.module.css";
import { useAuth } from "../../context/AuthContext";

import backIcon from "../../assets/chevron.svg";
import sendIcon from "../../assets/tabler_send.svg";

const IS_DEV = process.env.NODE_ENV === "development";

const API_HOST = IS_DEV ? "http://54.180.2.235:8080" : "https://mocacafe.site";
const API_PREFIX = `${API_HOST}/hackathon/api`;

const WS_BASE = IS_DEV ? "ws://54.180.2.235:8080" : "wss://mocacafe.site";
const WS_PATH = "/hackathon/api/ws-stomp";
const WS_URL = `${WS_BASE}${WS_PATH}`;

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

const isMatchPending = (pending, incoming, mySenderKey) => {
  if (pending.state !== "pending") return false;

  // 1) tempId/clientId 매칭 (가장 정확)
  if (pending.clientId && incoming.tempId && String(pending.clientId) === String(incoming.tempId)) {
    return true;
  }

  // 2) sender가 "내 senderKey"인 메시지만 pending 매칭 대상으로 본다
  const sameSenderIsMe =
    Number.isFinite(num(mySenderKey)) &&
    num(pending.sender) === num(mySenderKey) &&
    num(incoming.sender) === num(mySenderKey);

  if (!sameSenderIsMe) return false;

  // 3) 텍스트 동일
  if (normalizeText(pending.text ?? pending.message) !== normalizeText(incoming.text ?? incoming.message)) {
    return false;
  }

  // 4) 시간 근접
  const dt = Math.abs(new Date(incoming.createdAt).getTime() - new Date(pending.createdAt).getTime());
  return dt <= 10000;
};

export default function ChatRoom() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

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

  const [roomTitle, setRoomTitle] = useState(location.state?.roomName || "");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  /**
   * ✅ 내 메시지 판별 기준을 "sender만"으로 고정
   * - 서버가 userId/fromUserId/authorId 같은 필드에 "수신자(내 id)"를 실어 보내는 케이스가 있어서,
   *   그것까지 candidates에 넣으면 사용자 화면에서 전부 mine=true가 되어버림.
   */
  const mySenderKey = num(chatRoomUserId) ?? num(globalUserId) ?? null;

  const isMine = (payload) => {
    const s = num(payload?.sender);
    if (!Number.isFinite(s) || !Number.isFinite(num(mySenderKey))) return false;
    return s === num(mySenderKey);
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

      if (!roomTitle && row?.title) setRoomTitle(row.title);
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
      const pIdx = out.findIndex((m) => isMatchPending(m, s, mySenderKey));
      if (pIdx !== -1) {
        const copy = [...out];
        copy[pIdx] = { ...copy[pIdx], ...s, state: "sent" };
        out = copy;
        continue;
      }

      const already = out.some((m) => sameByIdentity(m, s));
      if (already) continue;
      out.push(s);
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

          // ✅ sender는 "서버가 준 sender"만 신뢰 (userId로 대체하지 않음)
          sender: num(m.sender) ?? undefined,

          message: text,
          text,
          createdAt: toISO(m.createdAt ?? m.timestamp),
          from: mine ? "me" : "store",
          state: "sent",
        };
      });

      setMessages((prev) => reconcileWithServer(prev, list));
    } catch {}
  };

  const connect = () => {
    if (!roomId || subscribedRef.current) return;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 2000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    });

    client.onConnect = () => {
      client.subscribe(`/sub/chatroom/${roomId}`, (frame) => {
        try {
          const payload = JSON.parse(frame.body);
          const text = safeText(payload);
          const mine = isMine(payload);

          const incoming = {
            serverId: payload.id ?? undefined,
            id: payload.id ?? undefined,
            tempId: payload.tempId ?? undefined,

            // ✅ sender는 payload.sender만 신뢰
            sender: num(payload.sender) ?? undefined,

            message: text,
            text,
            createdAt: toISO(payload.createdAt ?? payload.timestamp),
            from: mine ? "me" : "store",
            state: "sent",
          };

          setMessages((prev) => {
            const pIdx = prev.findIndex((m) => isMatchPending(m, incoming, mySenderKey));
            if (pIdx !== -1) {
              const copy = [...prev];
              copy[pIdx] = { ...copy[pIdx], ...incoming, state: "sent" };
              return copy;
            }

            const dup = prev.some((m) => sameByIdentity(m, incoming));
            if (dup) return prev;

            // ✅ 텍스트로만 매칭할 때도 sender를 mySenderKey로 제한
            const sameTextPendings = prev
              .map((m, idx) => ({ m, idx }))
              .filter(
                ({ m }) =>
                  m.state === "pending" &&
                  Number.isFinite(num(mySenderKey)) &&
                  num(m.sender) === num(mySenderKey) &&
                  normalizeText(m.text ?? m.message) === normalizeText(incoming.text ?? incoming.message)
              );

            if (sameTextPendings.length === 1) {
              const copy = [...prev];
              const { idx } = sameTextPendings[0];
              copy[idx] = { ...copy[idx], ...incoming, state: "sent" };
              return copy;
            }

            return [...prev, incoming];
          });
        } catch (e) {
          console.error("메시지 파싱 오류:", e, frame.body);
        }
      });

      subscribedRef.current = true;
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

  const disconnect = () => {
    try {
      subscribedRef.current = false;
      stompRef.current?.deactivate();
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
    if (!sc || !sc.connected) {
      alert("연결 상태가 불안정해요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!chatRoomUserId) {
      alert("방 참여자 정보를 아직 못 찾았어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    const nowISO = new Date().toISOString();
    const clientId = uuid();

    // ✅ pending sender도 mySenderKey(=chatRoomUserId)를 사용
    // (서버 sender와 같은 도메인으로 맞춰야 pending 매칭이 안 꼬임)
    setMessages((prev) => [
      ...prev,
      {
        clientId,
        sender: num(chatRoomUserId),
        message: text,
        text,
        createdAt: nowISO,
        from: "me",
        state: "pending",
      },
    ]);

    sc.publish({
      destination: "/pub/message",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        message: text,
        sender: chatRoomUserId,
        tempId: clientId,
        createdAt: nowISO,
      }),
    });

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

  const otherDisplayName = roomTitle || "상대방";

  return (
    <div className={styles.page}>
      <div className={styles.appbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <img src={backIcon} alt="뒤로가기" />
        </button>
        <div className={styles.title}>{otherDisplayName}</div>
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

          const isStore = msg.from === "store";
          const senderLabel = isStore ? otherDisplayName : "나";

          return isStore ? (
            <div key={key} className={styles.messageRow}>
              <div className={styles.messageContent}>
                <div className={styles.senderName}>{senderLabel}</div>
                <div className={`${styles.bubble} ${styles.store}`}>{msg.text ?? msg.message}</div>
              </div>
            </div>
          ) : (
            <div key={key} className={styles.messageRow} style={{ justifyContent: "flex-end" }}>
              <div className={`${styles.bubble} ${styles.me}`}>
                {msg.text ?? msg.message}
                {msg.state === "pending" && <i className={styles.pendingDot} aria-label="전송 중" />}
                {msg.state === "failed" && <span title="전송 실패" className={styles.failedBadge}>!</span>}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

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
