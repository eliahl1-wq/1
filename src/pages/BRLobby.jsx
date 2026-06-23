import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Background from '../components/Background';
import { normalizeBREntryFee, formatUsd } from '../constants/economy';
import { getOrCreatePresenceId } from '../utils/sitePresence';
import '../styles/ui.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');
const MIN_PLAYERS = 5;
const MAX_PLAYERS = 10;

export default function BRLobby() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token } = useAuth();
    const freePlay = !!user?.freePlay;
    const socketRef = useRef(null);
    const joinedRef = useRef(false);
    const matchStartedRef = useRef(false);

    const variant = location.state?.variant || localStorage.getItem('selected_gamemode')?.replace('br-', '') || 'agar';
    const entryFeeUsd = normalizeBREntryFee(
        location.state?.entryFeeUsd ?? localStorage.getItem('selected_entry_fee')
    );
    const brMode = variant === 'slither' ? 'br-slither' : 'br-agar';

    const [queueStatus, setQueueStatus] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [error, setError] = useState('');
    const [joining, setJoining] = useState(false);
    const [tick, setTick] = useState(0);

    const matchNickname = location.state?.nickname || user?.username || 'Guest';

    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        document.title = 'AgarStake | Battle Royale Queue';
        if (!token) {
            navigate('/login');
            return;
        }

        localStorage.setItem('selected_gamemode', brMode);
        localStorage.setItem('selected_entry_fee', String(entryFeeUsd));

        const socket = io(API_URL, {
            auth: { token, presenceId: getOrCreatePresenceId() },
            transports: ['websocket', 'polling'],
            reconnection: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (joinedRef.current) return;
            joinedRef.current = true;
            setJoining(true);
            const skinKey = variant === 'slither' ? 'selected_skin' : 'selected_skin_agar';
            const preferredSkin = localStorage.getItem(skinKey) || 'random';
            socket.emit('brJoinQueue', {
                variant,
                token,
                username: matchNickname,
                entryFeeUsd,
                skinColor: preferredSkin
            });
        });

        socket.on('brQueueStatus', (status) => {
            setQueueStatus(status);
            setError('');
            setJoining(false);
        });

        socket.on('brMatchCountdown', ({ seconds, prizePool, playerCount, variant: v }) => {
            matchStartedRef.current = true;
            const mode = v === 'slither' ? 'br-slither' : 'br-agar';
            localStorage.setItem('selected_gamemode', mode);
            localStorage.setItem('current_game_mode', mode);
            const sec = Math.max(1, Math.ceil(Number(seconds) || 15));
            setCountdown({
                endsAt: Date.now() + sec * 1000,
                prizePool,
                playerCount,
            });
        });

        socket.on('brMatchStart', ({ variant: v }) => {
            matchStartedRef.current = true;
            const path = v === 'slither' ? '/slither-game' : '/game';
            navigate(path, { state: { nickname: matchNickname, battleRoyale: true } });
        });

        socket.on('error', (msg) => {
            setError(typeof msg === 'string' ? msg : 'Queue error');
            setJoining(false);
            joinedRef.current = false;
        });

        return () => {
            if (!matchStartedRef.current) {
                socket.emit('brLeaveQueue');
            }
            socket.off();
            socket.disconnect();
            joinedRef.current = false;
        };
    }, [token, variant, entryFeeUsd, navigate, matchNickname, brMode]);

    const leaveQueue = () => {
        if (!matchStartedRef.current) {
            socketRef.current?.emit('brLeaveQueue');
        }
        navigate('/pre-game', { state: { selectedMode: brMode } });
    };

    const playersInQueue = queueStatus?.playersInQueue ?? 0;
    const minPlayers = queueStatus?.minPlayers ?? MIN_PLAYERS;
    const maxPlayers = queueStatus?.maxPlayers ?? MAX_PLAYERS;
    const needMore = Math.max(0, minPlayers - playersInQueue);
    const fillPct = Math.min(100, (playersInQueue / minPlayers) * 100);

    const graceSecondsLeft = queueStatus?.graceEndsAt
        ? Math.max(0, Math.ceil((queueStatus.graceEndsAt - Date.now()) / 1000))
        : queueStatus?.graceRemainingMs != null
            ? Math.max(0, Math.ceil(queueStatus.graceRemainingMs / 1000))
            : null;

    const matchCountdownSec = countdown?.endsAt
        ? Math.max(0, Math.ceil((countdown.endsAt - Date.now()) / 1000))
        : null;

    return (
        <div className="br-lobby-shell">
            <Background />
            <nav className="topbar" style={{ width: '100%', zIndex: 2 }}>
                <div className="topbar-left">
                    <div className="logo" onClick={() => navigate('/pre-game')}>
                        <div className="logo-dot" />
                        <span>AGAR<span className="logo-accent">STAKE</span></span>
                    </div>
                </div>
            </nav>

            <div className="br-lobby-content">
                <div className="br-lobby-card">
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', color: 'var(--accent)', marginBottom: '12px' }}>
                        BATTLE ROYALE — {variant.toUpperCase()} · {freePlay ? 'FREE (Test)' : formatUsd(entryFeeUsd)}
                    </div>

                    {countdown ? (
                        <>
                            <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>
                                Match Starting
                            </h1>
                            <p style={{ margin: '0 0 24px', color: 'var(--text-3)', fontSize: '0.85rem' }}>
                                Get ready — zone closes in, no cash-out
                            </p>
                            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#14F195', fontFamily: 'ui-monospace, monospace' }}>
                                {matchCountdownSec ?? '—'}s
                            </div>
                            <p style={{ color: 'var(--text-2)', marginTop: '8px' }}>
                                {countdown.playerCount} players · ${countdown.prizePool?.toFixed(2)} prize pool
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>
                                Searching for Players
                            </h1>
                            <p style={{ margin: '0 0 24px', color: 'var(--text-3)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                {freePlay ? 'Test mode — no real SOL charged · ' : ''}
                                Need at least {minPlayers} players · up to {maxPlayers} per match
                            </p>

                            {freePlay && (
                                <div style={{
                                    marginBottom: '16px', padding: '10px 14px',
                                    background: 'rgba(255, 180, 0, 0.1)', border: '1px solid rgba(255, 180, 0, 0.3)',
                                    borderRadius: '12px', color: '#FFD080', fontSize: '0.78rem', fontWeight: 600,
                                }}>
                                    TEST MODE — Free play, no real SOL used
                                </div>
                            )}

                            {(joining || !queueStatus) && (
                                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                    {[0, 1, 2].map(i => (
                                        <div
                                            key={i}
                                            style={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: 'var(--accent)',
                                                opacity: 0.3 + ((tick + i) % 3) * 0.35,
                                                animation: 'none',
                                            }}
                                        />
                                    ))}
                                </div>
                            )}

                            {queueStatus && (
                                <>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>
                                        {playersInQueue}
                                        <span style={{ opacity: 0.3, fontSize: '1.2rem' }}> / {maxPlayers}</span>
                                    </div>

                                    <div style={{
                                        margin: '16px 0 12px',
                                        height: 6,
                                        borderRadius: 999,
                                        background: 'rgba(255,255,255,0.06)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${fillPct}%`,
                                            background: playersInQueue >= minPlayers
                                                ? 'linear-gradient(90deg, #0DBF76, #14F195)'
                                                : 'var(--accent)',
                                            borderRadius: 999,
                                            transition: 'width 0.4s ease',
                                        }} />
                                    </div>

                                    {graceSecondsLeft != null && graceSecondsLeft > 0 ? (
                                        <p style={{ color: '#14F195', marginTop: '8px', fontWeight: 700, fontSize: '0.9rem' }}>
                                            Match starting in {graceSecondsLeft}s — waiting for more players (max {maxPlayers})
                                        </p>
                                    ) : needMore > 0 ? (
                                        <p style={{ color: 'var(--text-3)', marginTop: '8px' }}>
                                            Waiting for {needMore} more player{needMore !== 1 ? 's' : ''} to start
                                        </p>
                                    ) : (
                                        <p style={{ color: 'var(--text-2)', marginTop: '8px' }}>
                                            Minimum reached — filling lobby…
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {error && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,59,48,0.1)', borderRadius: '12px', color: '#FF3B30', fontSize: '0.85rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={leaveQueue}
                        style={{
                            marginTop: '28px',
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'transparent',
                            color: 'var(--text-2)',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        {countdown ? 'Leave Match' : 'Cancel Search'}
                    </button>
                </div>
            </div>
        </div>
    );
}
