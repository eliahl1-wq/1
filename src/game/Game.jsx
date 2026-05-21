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
    const hasJoinedGameRef = useRef(false); // Ny ref för att spåra om joinGame har skickats
    
    // Använd Refs för data som ändras ofta för att slippa starta om loopen
    const gameData = useRef({ player: {}, users: [], food: [], viruses: [], ejected: [] });
    const myIdRef = useRef(null);
    const animationFrameId = useRef(null);
    
    const WORLD_SIZE = 5000;
    
    const [isConnected, setIsConnected] = useState(false);
    const [currentBalance, setCurrentBalance] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);

    useEffect(() => {
        // Endast anslut om vi har en token och användarnamn, OCH ingen socket är aktiv
        if (!token || !user?.username || socketRef.current) {
            // Om vi har en socket men token/användarnamn blev null (t.ex. utloggning), koppla bort den
            if (socketRef.current && (!token || !user?.username)) {
                console.log('Auth data lost or changed, disconnecting socket.');
                socketRef.current.disconnect();
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
            setIsConnected(true);
        });

        socket.on('serverTellPlayerMove', (playerData, userData, foodList, massList, virusList) => {
            gameData.current = { player: playerData, users: userData, food: foodList, ejected: massList, viruses: virusList };
            const me = userData.find(p => p.id === myIdRef.current);
            if (me) setCurrentBalance(me.balance);
        });

        socket.on('leaderboard', (data) => {
            setLeaderboard(data.leaderboard);
        });

        socket.on('died', () => {
            window.location.assign('/lobby'); 
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
            
            if (isConnected && player.x !== undefined) {
                graph.fillStyle = '#f2fbff';
                graph.fillRect(0, 0, window.innerWidth, window.innerHeight);
                
                renderUtils.drawGrid(global, player, { width: window.innerWidth, height: window.innerHeight }, graph);
                
                food.forEach(f => {
                    const pos = { x: f.x - player.x + window.innerWidth/2, y: f.y - player.y + window.innerHeight/2 };
                    renderUtils.drawFood(pos, f, graph);
                });

                viruses.forEach(v => {
                    const pos = { x: v.x - player.x + window.innerWidth/2, y: v.y - player.y + window.innerHeight/2 };
                    renderUtils.drawVirus(pos, v, graph);
                });

                // Rita celler
                const cellsToDraw = users.flatMap(u => u.cells.map(c => ({
                    ...c, name: u.username, color: u.color.fill || u.color, borderColor: u.color.border || '#000',
                    x: c.x - player.x + window.innerWidth/2, y: c.y - player.y + window.innerHeight/2
                })));
                
                renderUtils.drawCells(cellsToDraw, { border: 6, textBorderSize: 3, textColor: '#fff', textBorder: '#000' }, 1, {}, graph);
            }
            animationFrameId.current = requestAnimationFrame(gameLoop);
        };
        gameLoop();
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
