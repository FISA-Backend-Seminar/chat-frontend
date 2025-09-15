// src/ChatPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/**
 * 서버 엔드포인트
 * - REST  : http://localhost:8080/chat
 * - WS    : ws://localhost:8080/ws/chat
 */
const API_BASE = "http://localhost:8080";
const WS_URL = "ws://localhost:8080/ws/chat";

export default function ChatPage() {
    const [rooms, setRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState("");

    const [newRoomName, setNewRoomName] = useState("");
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState("");

    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState("");

    const sender = useMemo(
        () => (Math.floor(Math.random() * 100000000) + 1).toString(),
        []
    );

    const wsRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchRooms = async () => {
        try {
            const res = await axios.get(`${API_BASE}/chat`);
            setRooms(res.data || []);
        } catch {
            setRooms([]);
        }
    };
    useEffect(() => {
        fetchRooms();
    }, []);

    useEffect(() => {
        if (!currentRoomId) return;

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, "room switch");
        }

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(
                JSON.stringify({
                    messageType: "ENTER",
                    roomId: currentRoomId,
                    sender,
                    message: "",
                })
            );
            setMessages([]);
        };

        ws.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                if (data?.error) return;
                setMessages((prev) => [
                    ...prev,
                    { ...data, _ts: new Date().toISOString() },
                ]);
            } catch {}
        };

        return () => {
            try {
                ws.close(1000, "cleanup");
            } catch {}
        };
    }, [currentRoomId, sender]);

    const sendMessage = () => {
        const text = messageInput.trim();
        if (
            !text ||
            !wsRef.current ||
            wsRef.current.readyState !== WebSocket.OPEN
        )
            return;

        wsRef.current.send(
            JSON.stringify({
                messageType: "TALK",
                roomId: currentRoomId,
                sender,
                message: text,
            })
        );
        setMessageInput("");
    };

    const onInputEnter = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const createRoom = async () => {
        const name = newRoomName.trim();
        if (!name) return;
        setCreating(true);
        setCreateError("");

        try {
            const res = await axios.post(`${API_BASE}/chat`, null, {
                params: { name },
            });
            await fetchRooms();
            const created = res.data;
            if (created?.roomId) {
                setCurrentRoomId(created.roomId);
            }
            setNewRoomName("");
        } catch {
            setCreateError("방 생성 실패");
        } finally {
            setCreating(false);
        }
    };

    const onCreateEnter = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            createRoom();
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.container}>
                {/* 좌측: 방 목록 + 방 생성 */}
                <aside style={styles.sidebar}>
                    <div style={styles.title}>채팅</div>

                    <div style={styles.createBox}>
                        <div style={styles.createRow}>
                            <input
                                style={styles.createInput}
                                placeholder="새 방 ID(또는 이름)"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                onKeyDown={onCreateEnter}
                            />
                            <button
                                style={{
                                    ...styles.createBtn,
                                    ...(creating || !newRoomName.trim()
                                        ? styles.createBtnDisabled
                                        : {}),
                                }}
                                onClick={createRoom}
                                disabled={creating || !newRoomName.trim()}
                            >
                                만들기
                            </button>
                        </div>
                        {createError && (
                            <div style={styles.errorText}>{createError}</div>
                        )}
                        <div style={styles.hintText}>
                            * 현재 서버 구현상 이 값이 roomId로 사용돼요.
                        </div>
                    </div>

                    <div style={styles.roomList}>
                        {rooms.map((r) => (
                            <button
                                key={r.roomId}
                                onClick={() => setCurrentRoomId(r.roomId)}
                                style={{
                                    ...styles.roomItem,
                                    ...(currentRoomId === r.roomId
                                        ? styles.roomItemActive
                                        : {}),
                                }}
                            >
                                <div style={styles.avatar} />
                                <div style={styles.roomName}>{r.name}</div>
                            </button>
                        ))}
                        {rooms.length === 0 && (
                            <div style={styles.noRoomText}>
                                아직 방이 없어요. 위에서 새 방을 만들어보세요.
                            </div>
                        )}
                    </div>
                </aside>

                {/* 우측: 채팅 영역 */}
                <section style={styles.chatArea}>
                    <div style={styles.messages} ref={scrollRef}>
                        {messages.map((m, idx) => {
                            const isMine =
                                m.sender === sender && m.messageType === "TALK";
                            const isSystem = m.messageType === "ENTER";

                            if (isSystem) {
                                return (
                                    <div key={idx} style={styles.systemWrap}>
                                        <div style={styles.systemBadge}>
                                            {m.message}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        ...styles.msgRow,
                                        justifyContent: isMine
                                            ? "flex-end"
                                            : "flex-start",
                                    }}
                                >
                                    {!isMine && (
                                        <div style={styles.peerBubbleMeta}>
                                            <div style={styles.peerSender}>
                                                {m.sender}
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        style={{
                                            ...styles.bubble,
                                            ...(isMine
                                                ? styles.bubbleMine
                                                : styles.bubblePeer),
                                        }}
                                    >
                                        {m.message}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 입력 바 */}
                    <div style={styles.inputBar}>
                        <input
                            style={styles.input}
                            placeholder={
                                currentRoomId
                                    ? "메시지를 입력해주세요"
                                    : "왼쪽에서 방을 선택하세요"
                            }
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            onKeyDown={onInputEnter}
                            disabled={!currentRoomId}
                        />
                        <button
                            style={{
                                ...styles.sendBtn,
                                ...(currentRoomId && messageInput.trim()
                                    ? {}
                                    : styles.sendBtnDisabled),
                            }}
                            onClick={sendMessage}
                            disabled={!currentRoomId || !messageInput.trim()}
                        >
                            전송
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}

/* ---------- 인라인 스타일 ---------- */
const styles = {
    page: {
        width: "100%",
        minHeight: "100vh",
        background: "#fafafa",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "24px",
        boxSizing: "border-box",
    },
    container: {
        width: "1100px",
        height: "640px",
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: "12px",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: "320px 1fr",
    },
    sidebar: {
        borderRight: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
    },
    title: {
        fontSize: "28px",
        fontWeight: 700,
        padding: "20px 20px 8px",
    },
    createBox: {
        padding: "0 16px 12px",
    },
    createRow: {
        display: "flex",
        gap: "8px",
    },
    createInput: {
        flex: 1,
        padding: "8px 12px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        fontSize: "14px",
        outline: "none",
    },
    createBtn: {
        padding: "8px 12px",
        borderRadius: "8px",
        background: "#2f80ff",
        color: "#fff",
        fontSize: "14px",
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
    },
    createBtnDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    errorText: {
        fontSize: "12px",
        color: "red",
        marginTop: "4px",
    },
    hintText: {
        fontSize: "11px",
        color: "#777",
        marginTop: "4px",
    },
    roomList: {
        overflowY: "auto",
        padding: "8px",
    },
    roomItem: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
        borderRadius: "10px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
    },
    roomItemActive: {
        background: "#f2f5ff",
    },
    avatar: {
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        background: "#d9d9d9",
        flexShrink: 0,
    },
    roomName: {
        fontSize: "15px",
    },
    noRoomText: {
        fontSize: "12px",
        color: "#777",
        padding: "8px 12px",
    },
    chatArea: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
    },
    messages: {
        flex: 1,
        overflowY: "auto",
        padding: "16px 20px",
        background: "#fff",
    },
    msgRow: {
        width: "100%",
        display: "flex",
        margin: "6px 0",
    },
    bubble: {
        maxWidth: "60%",
        padding: "10px 12px",
        borderRadius: "18px",
        fontSize: "14px",
        lineHeight: 1.4,
        wordBreak: "break-word",
    },
    bubbleMine: {
        background: "#2f80ff",
        color: "#fff",
        borderBottomRightRadius: "6px",
    },
    bubblePeer: {
        background: "#f1f2f6",
        color: "#222",
        borderBottomLeftRadius: "6px",
    },
    peerBubbleMeta: {
        display: "flex",
        flexDirection: "column",
        marginRight: "8px",
    },
    peerSender: {
        fontSize: "11px",
        color: "#888",
        marginLeft: "4px",
        marginBottom: "2px",
    },
    systemWrap: {
        display: "flex",
        justifyContent: "center",
        margin: "12px 0",
    },
    systemBadge: {
        fontSize: "12px",
        color: "#666",
        background: "#f5f5f5",
        padding: "6px 10px",
        borderRadius: "999px",
    },
    inputBar: {
        display: "grid",
        gridTemplateColumns: "1fr 72px",
        gap: "8px",
        padding: "10px",
        borderTop: "1px solid #eee",
    },
    input: {
        padding: "12px 14px",
        borderRadius: "10px",
        border: "1px solid #ddd",
        outline: "none",
        fontSize: "14px",
    },
    sendBtn: {
        border: "none",
        borderRadius: "10px",
        background: "#2f80ff",
        color: "#fff",
        fontWeight: 700,
        cursor: "pointer",
    },
    sendBtnDisabled: {
        opacity: 0.5,
        cursor: "not-allowed",
    },
};
