import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/** 순수 WebSocket 채팅 (UI: 라이트 테마) */
export default function ChatPage() {
    const [chatRooms, setChatRooms] = useState([]);
    const [currentRoomId, setCurrentRoomId] = useState("");
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState("");
    const [connected, setConnected] = useState(false);

    const sender = useMemo(
        () => (Math.floor(Math.random() * 100000000) + 1).toString(),
        []
    );
    const wsRef = useRef(null);
    const scrollRef = useRef(null);

    // --- UI helpers ---
    const nowAsHHMM = () => {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, "0")}:${String(
            d.getMinutes()
        ).padStart(2, "0")}`;
    };
    const normalizeMsg = (m) => ({ ...m, time: m.time || nowAsHHMM() });
    const displayName = (id) => `user_${String(id).slice(-4)}`;
    const avatarText = (id) => String(id).slice(-2);
    const truncate = (s, n = 24) => (s.length > n ? s.slice(0, n) + "…" : s);
    const elapsedText = (min = 2) => `${min}분전`; // 서버에서 방 최신시간 오면 여기에 반영

    // --- 자동 스크롤 ---
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // --- 방 리스트 (REST 유지) ---
    // useEffect(() => {
    //     let mounted = true;
    //     axios
    //         .get("/chat/rooms")
    //         .then((res) => {
    //             if (!mounted) return;
    //             const list = (res.data || []).map((x) => ({
    //                 roomId: x.roomId,
    //                 name: x.name,
    //             }));
    //             setChatRooms(list);
    //         })
    //         .catch(console.error);
    //     return () => {
    //         mounted = false;
    //     };
    // }, []);

    // --- 방 전환: 기존 소켓 닫고 새로 접속 ---
    useEffect(() => {
        if (!currentRoomId) {
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch {}
                wsRef.current = null;
            }
            setConnected(false);
            setMessages([]);
            return;
        }

        if (wsRef.current) {
            try {
                wsRef.current.close();
            } catch {}
            wsRef.current = null;
        }

        const url = makeWsUrl("/ws/chat", { roomId: currentRoomId, sender });
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            safeSend(ws, {
                messageType: "JOIN",
                roomId: currentRoomId,
                sender,
                message: "",
                time: nowAsHHMM(),
            });
        };

        ws.onmessage = (ev) => {
            try {
                const payload = JSON.parse(ev.data);
                setMessages((prev) => [...prev, normalizeMsg(payload)]);
            } catch {
                setMessages((prev) => [
                    ...prev,
                    normalizeMsg({
                        messageType: "TALK",
                        roomId: currentRoomId,
                        sender: "server",
                        message: String(ev.data),
                    }),
                ]);
            }
        };

        ws.onerror = (e) => console.error("WS error:", e);
        ws.onclose = () => setConnected(false);

        return () => {
            try {
                ws.close();
            } catch {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRoomId, sender]);

    // --- 유틸 ---
    function makeWsUrl(path, paramsObj) {
        const base =
            (window.location.protocol === "https:" ? "wss://" : "ws://") +
            window.location.host;
        const url = new URL(path, base);
        Object.entries(paramsObj || {}).forEach(([k, v]) =>
            url.searchParams.append(k, v)
        );
        return url.toString();
    }
    function safeSend(ws, data) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
            ws.send(JSON.stringify(data));
        } catch (e) {
            console.error("send error:", e);
        }
    }

    // --- 전송 ---
    function sendMessage() {
        const text = messageInput.trim();
        if (!text || !currentRoomId || !wsRef.current) return;

        const local = normalizeMsg({
            messageType: "TALK",
            roomId: currentRoomId,
            sender,
            message: text,
            _local: true,
        });
        setMessages((prev) => [...prev, local]);

        safeSend(wsRef.current, {
            messageType: "TALK",
            roomId: currentRoomId,
            sender,
            message: text,
            time: local.time,
        });

        setMessageInput("");
    }

    // --- 메시지 렌더 (카카오 스타일) ---
    const renderMessage = (m, idx) => {
        const isJoin = m.messageType === "JOIN" || m.messageType === "ENTER";
        const isMine = m.sender === sender;

        if (isJoin) {
            return (
                <div key={idx} className="flex justify-center my-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-neutral-100 text-neutral-500 border">
                        {m.message ||
                            `${displayName(m.sender)} 님이 입장했습니다.`}
                    </span>
                </div>
            );
        }

        if (isMine) {
            return (
                <div
                    key={idx}
                    className="flex justify-end items-end gap-2 px-3"
                >
                    <span className="text-[11px] text-neutral-400 mb-[2px]">
                        {m.time}
                    </span>
                    <div className="max-w-[70%] rounded-2xl px-3 py-2 bg-blue-500 text-white shadow">
                        {m.message}
                    </div>
                </div>
            );
        }

        return (
            <div key={idx} className="flex justify-start items-end gap-2 px-3">
                <div className="w-8 h-8 rounded-full bg-neutral-300 flex items-center justify-center text-[12px] text-neutral-700">
                    {avatarText(m.sender)}
                </div>
                <div className="flex flex-col items-start max-w-[75%]">
                    <div className="text-[12px] text-neutral-500 ml-1 mb-1">
                        {displayName(m.sender)}
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="rounded-2xl px-3 py-2 bg-neutral-100 text-neutral-900 shadow border">
                            {m.message}
                        </div>
                        <span className="text-[11px] text-neutral-400 mb-[2px]">
                            {m.time}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    // --- 방 생성 (REST 유지) ---
    function createRoom() {
        const name = prompt("새 방 이름을 입력하세요:");
        if (!name) return;
        const params = new URLSearchParams();
        params.append("name", name);
        axios
            .post("/chat/room", params, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            })
            .then((res) => {
                const newRoom = res.data; // { roomId, name }
                setChatRooms((prev) => [newRoom, ...prev]);
            })
            .catch(() => alert("방 생성에 실패했습니다."));
    }

    return (
        <div className="flex justify-center min-h-screen bg-white text-neutral-900">
            <div className="flex flex-col w-[920px] max-w-[92vw] mt-8">
                <h1 className="text-3xl font-semibold mb-4">채팅</h1>

                {/* 바깥 컨테이너 (연한 테두리, 둥근 모서리) */}
                <div className="border border-neutral-200 rounded-lg overflow-hidden bg-white">
                    <div className="flex" style={{ height: "72vh" }}>
                        {/* 왼쪽: 방 리스트 */}
                        <aside className="w-[280px] border-r border-neutral-200 flex flex-col">
                            <div className="flex-1 overflow-y-auto">
                                {chatRooms.map((room) => (
                                    <button
                                        key={room.roomId}
                                        onClick={() =>
                                            setCurrentRoomId(room.roomId)
                                        }
                                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-neutral-50
                      ${currentRoomId === room.roomId ? "bg-neutral-50" : ""}`}
                                    >
                                        {/* 아바타 */}
                                        <div className="w-10 h-10 rounded-full bg-neutral-300 shrink-0" />
                                        {/* 텍스트 */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold truncate">
                                                    {room.name}
                                                </span>
                                                <span className="text-xs text-neutral-400">
                                                    {elapsedText(2)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-neutral-400 truncate">
                                                {truncate(room.roomId, 28)}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={createRoom}
                                className="m-3 mt-0 px-3 py-2 rounded bg-neutral-100 hover:bg-neutral-200 text-sm"
                            >
                                방 만들기
                            </button>
                        </aside>

                        {/* 오른쪽: 채팅 영역 */}
                        <section className="flex-1 flex flex-col">
                            {/* 메시지 리스트 */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-3"
                                style={{ background: "#fff" }}
                            >
                                {messages.map(renderMessage)}
                            </div>

                            {/* 입력 바 */}
                            <div className="border-t border-neutral-200 p-3">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={
                                            currentRoomId
                                                ? "메시지를 입력하세요"
                                                : "채팅방을 먼저 선택하세요"
                                        }
                                        className="flex-1 h-10 px-3 rounded border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-sky-400"
                                        value={messageInput}
                                        onChange={(e) =>
                                            setMessageInput(e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            e.key === "Enter" && sendMessage()
                                        }
                                        disabled={!currentRoomId}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={
                                            !currentRoomId ||
                                            !messageInput.trim()
                                        }
                                        className="px-3 min-w-[56px] h-10 rounded border border-neutral-300 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50"
                                    >
                                        전송
                                    </button>
                                </div>
                                <div className="text-xs text-neutral-400 mt-2">
                                    상태:{" "}
                                    {connected ? "🟢 연결됨" : "🔴 연결 안 됨"}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
