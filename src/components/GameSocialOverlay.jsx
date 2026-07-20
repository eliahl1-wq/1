
import { useCallback, useEffect, useRef, useState } from 'react';

// Keep source ASCII-only so deployment tooling cannot corrupt UTF-8 emoji bytes.
const EMOTES = [
    '\u{1F600}', // happy
    '\u{1F602}', // laughing
    '\u{1F60E}', // cool
    '\u{1F621}', // angry
    '\u{1F62D}', // crying
    '\u{2764}\u{FE0F}', // heart
    '\u{1F44D}', // thumbs up
    '\u{1F44B}', // wave
];
const CHAT_TTL_MS = 12000;

export default function GameSocialOverlay({ socket, disabled = false, onEmote }) {
    const [chatOpen, setChatOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [messages, setMessages] = useState([]);
    const [wheelOpen, setWheelOpen] = useState(false);
    const [selected, setSelected] = useState(-1);
    const inputRef = useRef(null);
    const wheelOpenRef = useRef(false);
    const selectedRef = useRef(-1);

    const closeWheel = useCallback((send = true) => {
        if (!wheelOpenRef.current) return;
        const index = selectedRef.current;
        wheelOpenRef.current = false;
        selectedRef.current = -1;
        setWheelOpen(false);
        setSelected(-1);
        if (send && index >= 0 && socket?.connected) {
            socket.emit('gameEmote', { emote: EMOTES[index] });
        }
    }, [socket]);

    useEffect(() => {
        if (!socket) return undefined;
        const onChat = (message) => {
            const next = { ...message, receivedAt: Date.now() };
            setMessages((current) => [...current.slice(-5), next]);
        };
        const handleEmoteEvent = (payload) => {
            if (payload?.playerId && payload?.emote) onEmote?.(payload);
        };
        socket.on('gameChatMessage', onChat);
        socket.on('gameEmote', handleEmoteEvent);
        return () => {
            socket.off('gameChatMessage', onChat);
            socket.off('gameEmote', handleEmoteEvent);
        };
    }, [socket, onEmote]);

    useEffect(() => {
        const cleanup = window.setInterval(() => {
            const cutoff = Date.now() - CHAT_TTL_MS;
            setMessages((current) => current.filter((message) => message.receivedAt >= cutoff));
        }, 1000);
        return () => window.clearInterval(cleanup);
    }, []);

    useEffect(() => {
        if (chatOpen) window.setTimeout(() => inputRef.current?.focus(), 0);
    }, [chatOpen]);

    useEffect(() => {
        if (disabled) return undefined;
        const updateSelection = (event) => {
            if (!wheelOpenRef.current) return;
            const dx = event.clientX - window.innerWidth / 2;
            const dy = event.clientY - window.innerHeight / 2;
            const distance = Math.hypot(dx, dy);
            const index = distance < 35
                ? -1
                : Math.round((Math.atan2(dy, dx) + Math.PI * 2) / (Math.PI * 2 / EMOTES.length)) % EMOTES.length;
            selectedRef.current = index;
            setSelected(index);
        };
        const onKeyDown = (event) => {
            if (event.repeat && event.key.toLowerCase() !== 'y') return;
            const key = event.key.toLowerCase();
            const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
            if (key === 't' && !typing) {
                event.preventDefault();
                event.stopImmediatePropagation();
                closeWheel(false);
                setChatOpen(true);
            } else if (key === 'escape' && chatOpen) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setChatOpen(false);
                setDraft('');
            } else if (key === 'y' && !typing && !chatOpen) {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (!wheelOpenRef.current) {
                    wheelOpenRef.current = true;
                    setWheelOpen(true);
                }
            }
        };
        const onKeyUp = (event) => {
            if (event.key.toLowerCase() !== 'y' || !wheelOpenRef.current) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeWheel(true);
        };
        const onBlur = () => closeWheel(false);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        window.addEventListener('mousemove', updateSelection, true);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
            window.removeEventListener('mousemove', updateSelection, true);
            window.removeEventListener('blur', onBlur);
        };
    }, [chatOpen, closeWheel, disabled]);

    const submitChat = (event) => {
        event.preventDefault();
        const message = draft.trim();
        if (message && socket?.connected) socket.emit('gameChatSend', { message });
        setDraft('');
        setChatOpen(false);
    };

    if (disabled) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9500, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div style={{ position: 'absolute', left: 14, top: 158, width: 'min(380px, calc(100vw - 28px))' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                    {messages.map((message) => (
                        <div key={message.id} style={{ color: 'rgba(255,255,255,.82)', fontSize: 12, fontWeight: 600, textShadow: '0 1px 4px #000, 0 1px 8px #000' }}>
                            <span style={{ color: 'rgba(105,220,255,.9)', fontWeight: 850 }}>{message.sender}</span>
                            <span style={{ color: 'rgba(255,255,255,.42)' }}> - </span>
                            {message.message}
                        </div>
                    ))}
                </div>
                {chatOpen ? (
                    <form onSubmit={submitChat} style={{ pointerEvents: 'auto', display: 'flex', borderRadius: 8, overflow: 'hidden', background: 'rgba(8,12,18,.9)', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 10px 35px rgba(0,0,0,.45)' }}>
                        <input
                            ref={inputRef}
                            value={draft}
                            maxLength={180}
                            onChange={(event) => setDraft(event.target.value)}
                            placeholder="Skriv till spelarna..."
                            onKeyDown={(event) => event.stopPropagation()}
                            style={{ flex: 1, minWidth: 0, padding: '10px 12px', color: '#fff', background: 'transparent', border: 0, outline: 0, fontSize: 13 }}
                        />
                        <button type="submit" style={{ border: 0, padding: '0 14px', background: 'rgba(20,241,149,.14)', color: '#14f195', fontWeight: 900, cursor: 'pointer' }}>SEND</button>
                    </form>
                ) : (
                    <div style={{ color: 'rgba(255,255,255,.3)', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textShadow: '0 1px 4px #000' }}>T CHAT - HOLD Y EMOTES</div>
                )}
            </div>

            {wheelOpen && (
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 250, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(circle, rgba(8,12,18,.2) 0 23%, rgba(8,12,18,.9) 24% 100%)', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 20px 70px rgba(0,0,0,.55)' }}>
                    {EMOTES.map((emote, index) => {
                        const angle = index * Math.PI * 2 / EMOTES.length;
                        const active = selected === index;
                        return (
                            <div key={emote} style={{ position: 'absolute', left: '50%', top: '50%', width: 48, height: 48, transform: `translate(-50%, -50%) translate(${Math.cos(angle) * 88}px, ${Math.sin(angle) * 88}px) scale(${active ? 1.24 : 1})`, display: 'grid', placeItems: 'center', borderRadius: '50%', fontSize: 28, fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif', background: active ? 'rgba(20,241,149,.25)' : 'rgba(255,255,255,.06)', border: active ? '2px solid #14f195' : '1px solid rgba(255,255,255,.08)', transition: 'transform 80ms, background 80ms' }}>{emote}</div>
                        );
                    })}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.55)', fontSize: 10, fontWeight: 850, textAlign: 'center' }}>RELEASE<br />TO SEND</div>
                </div>
            )}

        </div>
    );
}

