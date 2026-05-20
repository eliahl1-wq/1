import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';

/**
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user, token } = useAuth();
    const socketRef = useRef(null);
    
    // --- KONSTANTER ---
    const WORLD_SIZE = 5000;
    
    // --- STATE ---
    const [players, setPlayers] = useState([]);
    const [food, setFood] = useState([]);
    const [myId, setMyId] = useState(null);

    useEffect(() => {
        // Anslut till servern
        socketRef.current = io(import.meta.env.VITE_API_URL);
        const socket = socketRef.current;

        socket.emit('joinGame', { username: user?.username, token });

        socket.on('init', (data) => {
            setMyId(data.id);
            setFood(data.food);
        });

        socket.on('tick', (data) => {
            setPlayers(data.players);
            setFood(data.food);
        });

        socket.on('died', () => {
            alert('Game Over!');
            window.location.href = '/lobby';
        });

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            socket.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [user, token]);

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    // Game Loop
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
            
            const myPlayer = players.find(p => p.id === myId);
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
            for (let x = 0; x <= WORLD_SIZE; x += 100) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_SIZE); ctx.stroke();
            }
            for (let y = 0; y <= WORLD_SIZE; y += 100) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_SIZE, y); ctx.stroke();
            }

            // Rita World Border
            ctx.strokeStyle = '#FF3B30';
            ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

            // Rita Mat
            food.forEach(f => {
                ctx.fillStyle = f.color;
                ctx.beginPath(); ctx.arc(f.x, f.y, 8, 0, Math.PI * 2); ctx.fill();
            });

            // Rita Spelare
            players.forEach(cell => {
                const radius = Math.sqrt(cell.mass * 100);
                ctx.fillStyle = cell.color;
                ctx.strokeStyle = cell.id === myId ? 'white' : 'rgba(0,0,0,0.5)';
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
    }, [players, food, myId]);

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
                        ${(players.find(p => p.id === myId)?.balance || 0).toFixed(2)}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '700' }}>1. You</span>
                        <span>${(players.find(p => p.id === myId)?.balance || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.5 }}>
                        <span>2. Bot_Alpha</span>
                        <span>$0.45</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.5 }}>
                        <span>3. CryptoKing</span>
                        <span>$0.12</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
