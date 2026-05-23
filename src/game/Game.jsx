import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import global from './global.js';
import Canvas from './canvas.js';
import ChatClient from './chat-client.js';
import * as renderUtils from './render.js';

/**
 * Version v11 - Full Agar.io Clone Logic Integrated
 * Version v12 - Full Agar.io Clone Logic Integrated (Frontend)
 * AgarStake Core Game Component (Multiplayer Engine)
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user, token } = useAuth();
    const socketRef = useRef(null);
    const hasJoinedGameRef = useRef(false);
    
    // Använd Refs för data som ändras ofta för att slippa starta om loopen
    const gameData = useRef({ player: {}, users: [], food: [], viruses: [], ejected: [] });
    const myIdRef = useRef(null);
    const animationFrameId = useRef(null);
    
    const WORLD_SIZE = 5000;

    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [cashedAmount, setCashedAmount] = useState(null);
    const [isDead, setIsDead] = useState(false);

    useEffect(() => {
        // Endast anslut om vi har en token och användarnamn, OCH ingen socket är aktiv
        if (!token || !user?.username || socketRef.current) {
            // Om vi har en socket men token/användarnamn blev null (t.ex. utloggning), koppla bort den
            if (socketRef.current && (!token || !user?.username)) {
                console.log('Auth data lost or changed, disconnecting socket.');
                socketRef.current.disconnect(); // Disconnect existing socket
                socketRef.current = null;
                setIsConnected(false);
                hasJoinedGameRef.current = false;
            }
            console.log('useEffect: Skipping socket creation (token/user missing or socket exists).');
            return;
        }

        console.log('useEffect: Attempting to create new socket with valid auth data...');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        const socket = io(apiUrl, {
            auth: { token },
            transports: ['websocket'], // Tvinga websocket för Render
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 20000 // Längre timeout för Render cold starts
        });

        socketRef.current = socket; // Spara instansen i ref

        socket.on('connect', () => {
            console.log('Connected to socket server');
            setIsConnected(true);
            if (!hasJoinedGameRef.current) {
                console.log('Emitting joinGame...');
                socket.emit('joinGame', { username: user.username, token });
                hasJoinedGameRef.current = true;
            }
        });

        socket.on('init', (data) => {
            // Denna används inte längre då servern skickar 'welcome'
        });

        socket.on('welcome', (playerSettings, gameSizes) => {
            console.log('Welcome to Arena');
            myIdRef.current = playerSettings.id;
            gameData.current.player = playerSettings;
            global.game.width = gameSizes.width;
            global.game.height = gameSizes.height;
            setIsConnected(true);
        });

        socket.on('serverTellPlayerMove', (playerData, userData, foodList, massList, virusList) => {
            gameData.current = { player: playerData, users: userData, food: foodList, ejected: massList, viruses: virusList };
            const me = userData.find(p => p.id === myIdRef.current);
            setCurrentBalance(me?.balance ?? 0); // Use nullish coalescing to default to 0 if me or me.balance is undefined
        });

        socket.on('leaderboard', (data) => {
            setLeaderboard(data.leaderboard);
        });

        socket.on('cashOutSuccess', ({ amount }) => {
            setCashedAmount(amount);
            // Visa animationen i 4 sekunder innan redirect
            setTimeout(() => {
                window.location.assign('/lobby');
            }, 4000);
        });

        socket.on('died', () => {
            setIsDead(true);
            // Visa döds-skärmen i 4 sekunder innan vi skickar tillbaka till lobbyn
            setTimeout(() => {
                window.location.assign('/lobby'); 
            }, 4000);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setIsConnected(false);
            hasJoinedGameRef.current = false; // Återställ för eventuell återanslutning
        });

        socket.on('connect_error', (err) => {
            console.error('Connection failed, retrying...', err.message);
            setIsConnected(false); // Reflektera att vi inte är anslutna i UI
        });

        socket.on('error', (msg) => {
            console.error('Server error:', msg); // Logga server-side fel
            if (msg.includes('balance')) {
                alert(msg);
                window.location.assign('/lobby');
            }
        });

        const handleKeyDown = (e) => {
            if (e.code === 'Space') { 
                socketRef.current?.emit('2'); // Split
            } else if (e.code === 'KeyW') {
                socketRef.current?.emit('1'); // Eject
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyDown);
        handleResize();

        return () => {
            cancelAnimationFrame(animationFrameId.current);
            console.log('Cleaning up socket connection on component unmount or auth change...');
            window.removeEventListener('keydown', handleKeyDown);
            if (socketRef.current) {
                socketRef.current.off(); // Ta bort alla lyssnare
                socketRef.current.disconnect(); // Koppla bort socketen
                socketRef.current = null; // Nollställ ref
            }
            hasJoinedGameRef.current = false; // Återställ flaggan
            window.removeEventListener('resize', handleResize);
        };
    }, [token, user?.username]); // Körs när vi har inloggningsdata

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const graph = canvas.getContext('2d');
        
        const gameLoop = () => {
            const { player, users, food, viruses, ejected } = gameData.current;
            const screen = { width: window.innerWidth, height: window.innerHeight };
            
            if (isConnected && player.x !== undefined) {
                graph.fillStyle = '#0a0a0c';
                graph.fillRect(0, 0, screen.width, screen.height);
                
                renderUtils.drawGrid(global, player, screen, graph);
                
                food.forEach(f => {
                    const pos = { x: f.x - player.x + screen.width/2, y: f.y - player.y + screen.height/2 };
                    renderUtils.drawFood(pos, f, graph);
                });

                viruses.forEach(v => {
                    const pos = { x: v.x - player.x + screen.width/2, y: v.y - player.y + screen.height/2 };
                    renderUtils.drawVirus(pos, v, graph);
                });

                let borders = {
                    left: screen.width / 2 - player.x,
                    right: screen.width / 2 + global.game.width - player.x,
                    top: screen.height / 2 - player.y,
                    bottom: screen.height / 2 + global.game.height - player.y
                };

                // Rita celler
                const cellsToDraw = users.flatMap(u => u.cells.map(c => ({
                    ...c, 
                    name: u.username, 
                    color: u.color.fill || u.color, 
                    borderColor: u.color.border || '#000',
                    balance: u.balance, // Skicka med balansen till ritaren
                    x: c.x - player.x + screen.width/2, 
                    y: c.y - player.y + screen.height/2
                })));
                
                renderUtils.drawCells(cellsToDraw, { border: 6, textBorderSize: 3, textColor: '#fff', textBorder: '#000' }, 1, borders, graph);
            }
            animationFrameId.current = requestAnimationFrame(gameLoop);
        };
        gameLoop();
        return () => cancelAnimationFrame(animationFrameId.current);
    }, [isConnected]); 

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        socketRef.current?.emit('0', { // Agario-protokoll '0' för move
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

            {cashedAmount !== null && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.9)',
                    backdropFilter: 'blur(15px)',
                    animation: 'fadeInOverlay 0.5s ease forwards'
                }}>
                    <div style={{ 
                        textAlign: 'center', 
                        animation: 'scalePop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '50px',
                        padding: '0 20px'
                    }}>
                        <div style={{ fontSize: '1.4rem', color: '#34C759', fontWeight: '800', letterSpacing: '8px', textTransform: 'uppercase' }}>Profit Secured</div>
                        <h1 style={{ color: '#FFD700', fontSize: '9rem', margin: '10px 0', fontWeight: '900', textShadow: '0 0 60px rgba(255, 215, 0, 0.6)', letterSpacing: '-5px' }}>
                            ${cashedAmount.toFixed(2)}
                        </h1>
                        <p style={{ color: 'white', fontSize: '1.4rem', opacity: 0.4, margin: 0, fontWeight: '500', letterSpacing: '1px' }}>Funds added to your account.</p>
                    </div>
                </div>
            )}

            {isDead && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(30, 0, 0, 0.9)', // Mörk röd bakgrund
                    backdropFilter: 'blur(15px)',
                    animation: 'fadeInOverlay 0.5s ease forwards'
                }}>
                    <div style={{ 
                        textAlign: 'center', 
                        animation: 'scalePop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        padding: '0 20px'
                    }}>
                        <div style={{ fontSize: '1.4rem', color: '#FF3B30', fontWeight: '800', letterSpacing: '8px', textTransform: 'uppercase' }}>Eliminated</div>
                        <h1 style={{ color: '#fff', fontSize: '7rem', margin: '10px 0', fontWeight: '900', textShadow: '0 0 40px rgba(255, 59, 48, 0.6)', letterSpacing: '-2px' }}>
                            YOU DIED
                        </h1>
                        <p style={{ color: 'white', fontSize: '1.3rem', opacity: 0.5, margin: 0, fontWeight: '500' }}>Your stake has been collected. Returning to lobby...</p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeInOverlay {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scalePop {
                    from { transform: scale(0.3); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>

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
                zIndex: 100
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    padding: '15px 25px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    boxShadow: '0 0 20px rgba(0, 122, 255, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ margin: 0, opacity: 0.6, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '2px', color: '#34C759' }}>In-Game Stake</h3>
                        <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#fff', textShadow: '0 0 10px rgba(255,255,255,0.2)' }}>
                            ${(currentBalance ?? 0).toFixed(2)}
                        </div>
                    </div>

                    <button 
                        onClick={() => socketRef.current?.emit('cashOut')}
                        style={{
                            width: '100%',
                            background: '#34C759',
                            color: 'white',
                            border: 'none',
                            padding: '10px 0',
                            borderRadius: '12px',
                            fontWeight: '800',
                            fontSize: '0.8rem',
                            letterSpacing: '1px',
                            cursor: 'pointer',
                            transition: '0.2s all ease',
                            boxShadow: '0 4px 15px rgba(52, 199, 89, 0.4)'
                        }}
                    >
                        CASH OUT
                    </button>
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
                }} className="game-title">
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
                            <span style={{ fontWeight: p.id === myIdRef.current ? '700' : '400' }}>{i + 1}. {p.name || 'An unnamed cell'}</span>
                            <span>${(p.balance ?? 0).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
