import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';

/**
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user, token } = useAuth();
    const socketRef = useRef(null);
    const hasJoinedGameRef = useRef(false); // Ny ref för att spåra om joinGame har skickats
    // Liten ändring för att trigga Vercel deployment
    
    // Använd Refs för data som ändras ofta för att slippa starta om loopen
    const playersRef = useRef([]);
    const foodRef = useRef([]);
    const myIdRef = useRef(null);
    
    const WORLD_SIZE = 5000;
    
    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);

    useEffect(() => {
        // Skapa socket-instansen bara en gång vid komponentens första mount
        if (socketRef.current) return;

        console.log('Connecting to arena...');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        // Skapa instansen
        socketRef.current = io(apiUrl, {
            // Auth skickas inte här, utan i joinGame eventet när token är garanterat tillgänglig
            // Detta förhindrar att socketen försöker ansluta med en tom token vid första render
            // och att den stängs ner av cleanup i StrictMode.
            // auth: { token }, // Flyttas till joinGame
            transports: ['websocket'], // Tvinga websocket för att undvika Render polling-problem
            reconnection: true,
            reconnectionAttempts: 5
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Connected to socket server');
            setIsConnected(true); // Uppdatera state för att visa att vi är anslutna
            // Skicka joinGame först när vi vet att pipan är öppen och vi inte redan har skickat det
            if (token && user?.username && !hasJoinedGameRef.current) {
                console.log('Emitting joinGame after successful connection.');
                socket.emit('joinGame', { username: user.username, token });
            }
        });

        socket.on('init', (data) => {
            myIdRef.current = data.id; 
            setIsConnected(true); // Vi är först "anslutna" när vi fått init-data
            foodRef.current = data.food;
        });

        socket.on('tick', (data) => {
            playersRef.current = data.players;
            foodRef.current = data.food;

            // Uppdatera UI-state mer sällan för prestanda
            const me = data.players.find(p => p.id === myIdRef.current);
            if (me) setCurrentBalance(me.balance);
            
            // Enkel leaderboard-sortering
            const topPlayers = [...data.players]
                .sort((a, b) => b.mass - a.mass)
                .slice(0, 5);
            setLeaderboard(topPlayers);
        });

        socket.on('died', () => {
            alert('Game Over!');
            window.location.assign('/lobby');
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected.');
            setIsConnected(false);
            hasJoinedGameRef.current = false; // Återställ flaggan vid disconnect
            // Om servern kopplar ner oss, kan det vara pga auth-fel eller liknande.
            // I så fall vill vi inte att klienten försöker återansluta oändligt.
            if (socket.io.reconnecting) {
                console.log('Socket is trying to reconnect...');
            }
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
        });

        socket.on('error', (msg) => {
            console.error('Game logic error:', msg);
            if (msg.includes('balance')) {
                alert(msg);
                window.location.assign('/lobby');
            }
        });

        // Hantera fönsterstorleksändringar
        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            // Cleanup function for the effect
            if (socketRef.current) {
                console.log('Cleaning up socket connection...');
                socketRef.current.off(); // Ta bort alla lyssnare
                socketRef.current.disconnect(); // Stäng anslutningen
                socketRef.current = null;
                hasJoinedGameRef.current = false; // Återställ flaggan
            }
            window.removeEventListener('resize', handleResize); // Ta bort resize-lyssnare
        };
    }, [token, user?.username]); // Denna effekt körs när token eller användarnamn ändras

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    // Riktig renderingsloop som körs oberoende av Reacts state-ändringar
    useEffect(() => {
        let animationFrameId;
        const update = () => {
            render();
            animationFrameId = requestAnimationFrame(update);
        };

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            const myPlayer = playersRef.current.find(p => p.id === myIdRef.current);
            if (!myPlayer) return;

            const zoom = Math.max(0.15, Math.min(1, 1 / (1 + Math.pow(myPlayer.mass / 500, 0.5))));

            ctx.fillStyle = '#0a0a0c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-myPlayer.x, -myPlayer.y);

            // Rita Grid
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 2;
            for (let x = 0; x <= WORLD_SIZE; x += 200) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_SIZE); ctx.stroke();
            }
            for (let y = 0; y <= WORLD_SIZE; y += 200) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_SIZE, y); ctx.stroke();
            }

            // Rita World Border
            ctx.strokeStyle = '#FF3B30';
            ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

            // Rita Mat
            foodRef.current.forEach(f => {
                ctx.fillStyle = f.color;
                ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill();
            });

            // Rita alla spelare
            playersRef.current.forEach(cell => {
                const radius = Math.sqrt(cell.mass * 100);
                ctx.fillStyle = cell.color;
                ctx.strokeStyle = cell.id === myIdRef.current ? 'white' : 'rgba(0,0,0,0.5)';
                ctx.lineWidth = radius * 0.05;
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Namn & Massa
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.font = `bold ${Math.max(12, radius * 0.4)}px system-ui`;
                ctx.fillText(cell.username, cell.x, cell.y);
            });

            ctx.restore();
        };

        update();
        return () => cancelAnimationFrame(animationFrameId);
    }, []); // En renderingsloop för hela livscykeln

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        socketRef.current?.emit('mouseMove', {
            x: e.clientX - rect.left - canvas.width / 2,
            y: e.clientY - rect.top - canvas.height / 2
        });
    };

    return (
        <div style={{ 
            width: '100vw', 
            height: '100vh', 
            background: '#0a0a0c', 
            overflow: 'hidden', 
            position: 'fixed', 
            top: 0, 
            left: 0,
            fontFamily: 'system-ui'
        }}>
            <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                style={{ display: 'block' }}
            />

            {!isConnected && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0c', color: 'white', zIndex: 1000 }}>
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '10px' }}>Connecting to Arena...</h2>
                        <p style={{ opacity: 0.5 }}>Make sure you have at least $10 balance.</p>
                    </div>
                </div>
            )}

            {/* UI Overlay */}
            <div style={{ 
                position: 'absolute', 
                top: '30px', 
                left: '30px', 
                pointerEvents: 'none' 
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    padding: '15px 25px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white'
                }}>
                    <h3 style={{ margin: 0, opacity: 0.5, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Balance</h3>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>
                        ${currentBalance.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Controls Info */}
            <div style={{ 
                position: 'absolute', 
                bottom: '30px', 
                left: '30px', 
                color: 'rgba(255,255,255,0.3)',
                fontSize: '0.9rem'
            }}>
                SPACE to Split • W to Eject • Mouse to Move
            </div>

            {/* Logo/Name */}
            <div style={{ 
                position: 'absolute', 
                top: '30px', 
                right: '30px', 
                textAlign: 'right' 
            }}>
                <h2 style={{ 
                    margin: 0, 
                    color: 'white', 
                    fontWeight: '900', 
                    letterSpacing: '-1px',
                    fontStyle: 'italic'
                }}>
                    AGAR<span style={{ color: '#007AFF' }}>STAKE</span>
                </h2>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>Alpha Demo v0.1</div>
            </div>

            {/* Mock Leaderboard */}
            <div style={{
                position: 'absolute',
                top: '120px',
                right: '30px',
                width: '180px',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '20px',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                color: 'white'
            }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.7rem', opacity: 0.4, letterSpacing: '1px' }}>LEADERBOARD</h4>
                <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaderboard.map((p, i) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', opacity: p.id === myIdRef.current ? 1 : 0.5 }}>
                            <span style={{ fontWeight: p.id === myIdRef.current ? '700' : '400' }}>{i + 1}. {p.username}</span>
                            <span>${p.balance.toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
