import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Background from '../components/Background';
import { normalizeBREntryFee, formatUsd } from '../constants/economy';
import '../styles/ui.css';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? window.location.origin : 'http://localhost:5000');

export default function BRLobby() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, token } = useAuth();
    const freePlay = !!user?.freePlay;
    const socketRef = useRef(null);
    const joinedRef = useRef(false);

    const variant = location.state?.variant || localStorage.getItem('selected_gamemode')?.replace('br-', '') || 'agar';
    const entryFeeUsd = normalizeBREntryFee(
        location.state?.entryFeeUsd ?? localStorage.getItem('selected_entry_fee')
    );

    const [queueStatus, setQueueStatus] = useState(null);
    const [countdown, setCountdown] = useState(null);
    const [error, setError] = useState('');
    const [joining, setJoining] = useState(false);

    const matchNickname = location.state?.nickname || user?.username || 'Guest';

    useEffect(() => {
        document.title = 'AgarStake | Battle Royale Queue';
        if (!token) {
            navigate('/login');
            return;
        }

        localStorage.setItem('selected_gamemode', variant === 'slither' ? 'br-slither' : 'br-agar');
        localStorage.setItem('selected_entry_fee', String(entryFeeUsd));

        const socket = io(API_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            if (joinedRef.current) return;
            joinedRef.current = true;
            setJoining(true);
            socket.emit('brJoinQueue', { variant, token, username: matchNickname, entryFeeUsd });
        });

        socket.on('brQueueStatus', (status) => {
            setQueueStatus(status);
            setError('');
            setJoining(false);
        });

        socket.on('brMatchCountdown', ({ seconds, prizePool, playerCount, variant: v }) => {
            const mode = v === 'slither' ? 'br-slither' : 'br-agar';
            localStorage.setItem('selected_gamemode', mode);
            localStorage.setItem('current_game_mode', mode);
            setCountdown({ seconds, prizePool, playerCount });
        });

        socket.on('brMatchStart', ({ variant: v }) => {
            const path = v === 'slither' ? '/slither-game' : '/game';
            navigate(path, { state: { nickname: matchNickname, battleRoyale: true } });
        });

        socket.on('error', (msg) => {
            setError(typeof msg === 'string' ? msg : 'Queue error');
            setJoining(false);
            joinedRef.current = false;
        });

        return () => {
            socket.emit('brLeaveQueue');
            socket.off();
            socket.disconnect();
            joinedRef.current = false;
        };
    }, [token, variant, entryFeeUsd, navigate, matchNickname]);

    const leaveQueue = () => {
        socketRef.current?.emit('brLeaveQueue');
        navigate('/pre-game', { state: { selectedMode: variant === 'slither' ? 'br-slither' : 'br-agar' } });
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <Background />
            <nav className="topbar" style={{ width: '100%', zIndex: 2 }}>
                <div className="topbar-left">
                    <div className="logo" onClick={() => navigate('/pre-game')}>
                        <div className="logo-dot" />
                        <span>AGAR<span className="logo-accent">STAKE</span></span>
                    </div>
                </div>
            </nav>

            <div style={{ zIndex: 1, marginTop: '120px', width: '100%', maxWidth: '480px', padding: '0 24px' }}>
                <div style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-2xl)',
                    padding: '32px',
                    boxShadow: 'var(--shadow-xl)',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '2px', color: 'var(--accent)', marginBottom: '12px' }}>
                        BATTLE ROYALE — {variant.toUpperCase()} · {freePlay ? 'FREE (Test)' : formatUsd(entryFeeUsd)}
                    </div>
                    <h1 style={{ margin: '0 0 8px', fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>
                        {countdown ? 'Match Found' : 'Finding Match'}
                    </h1>
                    <p style={{ margin: '0 0 24px', color: 'var(--text-3)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        {freePlay ? 'Test mode — no real SOL charged · ' : ''}4–16 players · shrinking zone · no cash-out · winner takes the pool
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

                    {error && (
                        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255,59,48,0.1)', borderRadius: '12px', color: '#FF3B30', fontSize: '0.85rem' }}>
                            {error}
                        </div>
                    )}

                    {countdown ? (
                        <div>
                            <div style={{ fontSize: '3rem', fontWeight: 900, color: '#14F195', fontFamily: 'ui-monospace, monospace' }}>
                                {countdown.seconds}s
                            </div>
                            <p style={{ color: 'var(--text-2)', marginTop: '8px' }}>
                                {countdown.playerCount} players · ${countdown.prizePool?.toFixed(2)} prize pool
                            </p>
                        </div>
                    ) : queueStatus ? (
                        <div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>
                                {queueStatus.playersInQueue}<span style={{ opacity: 0.3, fontSize: '1.2rem' }}> / {queueStatus.maxPlayers}</span>
                            </div>
                            <p style={{ color: 'var(--text-3)', marginTop: '8px' }}>
                                {queueStatus.devFreePlay || freePlay
                                    ? 'Starting soon (test mode)'
                                    : `Need ${Math.max(0, queueStatus.minPlayers - queueStatus.playersInQueue)} more to start`}
                                {queueStatus.waitMs > 0 && !queueStatus.devFreePlay && !freePlay && ` · max wait ${Math.ceil(queueStatus.waitMs / 1000)}s`}
                            </p>
                        </div>
                    ) : joining ? (
                        <p style={{ color: 'var(--text-3)' }}>Joining queue…</p>
                    ) : null}

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
                        Back to Lobby
                    </button>
                </div>
            </div>
        </div>
    );
}
