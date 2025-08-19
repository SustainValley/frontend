import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import axios from "axios";
import styles from "./Chat.module.css";

import backIcon from "../../assets/chevron.svg";
import sendIcon from "../../assets/tabler_send.svg";

export default function ChatRoom() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const roomId = Number(chatId);

  const clientRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sender, setSender] = useState(1); 

  useEffect(() => {
    const client = new Client({

      webSocketFactory: () => new SockJS("http://localhost:8080/ws-stomp"),
      reconnectDelay: 5000,
      debug: (str) => console.log(str),
      onConnect: () => {
        console.log(" WebSocket Connected with SockJS");

        client.subscribe(`/sub/chatroom/${roomId}`, (msg) => {
          const newMessage = JSON.parse(msg.body);
          console.log("📩 받은 메시지:", newMessage);
          setMessages((prev) => [
            ...prev,
            {
              from: newMessage.sender === sender ? "me" : "store",
              name: newMessage.sender === sender ? "나" : "상대방",
              text: newMessage.message,
              createdAt: newMessage.createdAt,
            },
          ]);
        });

        client.subscribe(`/user/queue/errors`, (err) => {
          try {
            const errorMsg = JSON.parse(err.body);
            alert(`❌ 에러 발생: ${errorMsg.message}`);
          } catch {
            alert(`❌ 에러 발생: ${err.body}`);
          }
        });
      },
      onStompError: (frame) => {
        console.error("❌ Broker error:", frame.headers["message"]);
        console.error("Details:", frame.body);
      },
    });

    client.activate();
    clientRef.current = client;

    axios
      .get(`/hackathon/api/chat/room?id=${roomId}`)
      .then((res) => {
        const prevMsgs = res.data.result.map((m) => ({
          from: m.sender === sender ? "me" : "store",
          name: m.sender === sender ? "나" : "상대방",
          text: m.message,
          createdAt: m.createdAt,
        }));
        setMessages(prevMsgs);
      })
      .catch((e) => console.error("❌ 이전 메시지 로드 실패", e));

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
        console.log("❌ WebSocket Disconnected");
      }
    };
  }, [roomId, sender]);

  const sendMessage = () => {
    if (!input.trim() || !clientRef.current?.connected) return;
    const body = { roomId, message: input.trim(), sender };

    clientRef.current.publish({
      destination: `/pub/chatroom/${roomId}`,
      body: JSON.stringify(body),
    });

    setMessages((prev) => [
      ...prev,
      { from: "me", name: "나", text: input.trim() },
    ]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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
      <div className={styles.appbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <img src={backIcon} alt="뒤로가기" />
        </button>
        <div className={styles.title}>채팅 문의</div>
        <div style={{ width: "40px" }} />
      </div>

      <div className={styles.chatWindow}>
        {messages.map((msg, i) =>
          msg.from === "store" ? (
            <div key={i} className={styles.messageRow}>
              <div className={styles.profile}></div>
              <div className={styles.messageContent}>
                <div className={styles.senderName}>{msg.name || "상대방"}</div>
                <div className={`${styles.bubble} ${styles.store}`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ) : (
            <div
              key={i}
              className={styles.messageRow}
              style={{ justifyContent: "flex-end" }}
            >
              <div className={`${styles.bubble} ${styles.me}`}>{msg.text}</div>
            </div>
          )
        )}
        <div ref={chatEndRef} />
      </div>


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
