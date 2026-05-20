import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * AgarStake Core Game Component (Single Player Demo Version)
 * Denna fil innehåller grundmekaniken för spelet.
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user } = useAuth();
    
    // --- GAME CONSTANTS ---
    const WORLD_SIZE = 4000;
    const INITIAL_RADIUS = 30;
    const MIN_SPLIT_RADIUS = 50;
    const MAX_CELLS = 16;
    const DECAY_RATE = 0.0001; // Hur snabbt man tappar massa
    
    // --- GAME STATE ---
    const [playerCells, setPlayerCells] = useState([
        { id: 1, x: 2000, y: 2000, radius: INITIAL_RADIUS, vx: 0, vy: 0, color: '#007AFF' }
    ]);
    const [food, setFood] = useState([]);
    const [viruses, setViruses] = useState([]);
    const [ejectedMass, setEjectedMass] = useState([]);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [score, setScore] = useState(0);

    // Initiera mat och virus
    useEffect(() => {
        const initialFood = Array.from({ length: 200 }, () => ({
            id: Math.random(),
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            radius: 8,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`
        }));

        const initialViruses = Array.from({ length: 15 }, () => ({
            id: Math.random(),
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            radius: 80
        }));

        setFood(initialFood);
        setViruses(initialViruses);
    }, []);

    // --- INPUT HANDLING ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') splitPlayer();
            if (e.code === 'KeyW') ejectMass();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playerCells]);

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left - canvas.width / 2,
            y: e.clientY - rect.top - canvas.height / 2
        });
    };

    // --- CORE LOGIC FUNCTIONS ---
    const splitPlayer = () => {
        setPlayerCells(prev => {
            if (prev.length >= MAX_CELLS) return prev;
            let newCells = [...prev];
            let canSplit = false;

            prev.forEach(cell => {
                if (cell.radius >= MIN_SPLIT_RADIUS && newCells.length < MAX_CELLS) {
                    cell.radius /= 1.414; // Halvera ytan (r / sqrt(2))
                    const angle = Math.atan2(mousePos.y, mousePos.x);
                    newCells.push({
                        id: Math.random(),
                        x: cell.x,
                        y: cell.y,
                        radius: cell.radius,
                        vx: Math.cos(angle) * 25,
                        vy: Math.sin(angle) * 25,
                        color: cell.color,
                        splitTimer: 20 // Tid innan de kan mergas igen
                    });
                    canSplit = true;
                }
            });
            return canSplit ? newCells : prev;
        });
    };

    const ejectMass = () => {
        // Implementation för att skjuta ut massa (W)
        setPlayerCells(prev => {
            const updated = [...prev];
            const cell = updated[0]; // Förenklat för demo
            if (cell.radius > 40) {
                cell.radius -= 2;
                const angle = Math.atan2(mousePos.y, mousePos.x);
                setEjectedMass(prevE => [...prevE, {
                    id: Math.random(),
                    x: cell.x + Math.cos(angle) * cell.radius,
                    y: cell.y + Math.sin(angle) * cell.radius,
                    radius: 12,
                    vx: Math.cos(angle) * 15,
                    vy: Math.sin(angle) * 15,
                    color: cell.color
                }]);
            }
            return updated;
        });
    };

    // --- GAME LOOP ---
    useEffect(() => {
        let animationFrameId;

        const update = () => {
            setPlayerCells(currentCells => {
                return currentCells.map(cell => {
                    // 1. Beräkna hastighet baserat på mus (desto större cell, desto långsammare)
                    const speedScale = 4 / (1 + Math.pow(cell.radius / 30, 0.44));
                    const angle = Math.atan2(mousePos.y, mousePos.x);
                    
                    // Friktion för split-hastighet
                    cell.vx *= 0.9;
                    cell.vy *= 0.9;

                    let targetVx = Math.cos(angle) * speedScale;
                    let targetVy = Math.sin(angle) * speedScale;

                    // Move cell
                    let newX = cell.x + targetVx + cell.vx;
                    let newY = cell.y + targetVy + cell.vy;

                    // Boundary checks
                    newX = Math.max(cell.radius, Math.min(WORLD_SIZE - cell.radius, newX));
                    newY = Math.max(cell.radius, Math.min(WORLD_SIZE - cell.radius, newY));

                    // Mass decay
                    const newRadius = cell.radius > INITIAL_RADIUS ? cell.radius * (1 - DECAY_RATE) : cell.radius;

                    return { ...cell, x: newX, y: newY, radius: newRadius };
                });
            });

            // Uppdatera utskjuten massa
            setEjectedMass(prev => prev.map(m => ({
                ...m,
                x: m.x + m.vx,
                y: m.y + m.vy,
                vx: m.vx * 0.9,
                vy: m.vy * 0.9
            })).filter(m => Math.abs(m.vx) > 0.1));

            // Collision Detection: Player vs Food
            setFood(prevFood => {
                let newScoreAdd = 0;
                const remaining = prevFood.filter(f => {
                    let eaten = false;
                    playerCells.forEach(cell => {
                        const dist = Math.hypot(cell.x - f.x, cell.y - f.y);
                        if (dist < cell.radius) {
                            eaten = true;
                            cell.radius += 0.5; // Väx lite
                            newScoreAdd += 1;
                        }
                    });
                    return !eaten;
                });
                if (newScoreAdd > 0) setScore(s => s + newScoreAdd);
                return remaining;
            });

            // Virus collision
            viruses.forEach(v => {
                playerCells.forEach(cell => {
                    const dist = Math.hypot(cell.x - v.x, cell.y - v.y);
                    if (dist < cell.radius && cell.radius > v.radius * 1.1) {
                        // Trigger split-bomb (förenklat för demo: tappar bara massa)
                        cell.radius *= 0.8;
                    }
                });
            });

            render();
            animationFrameId = requestAnimationFrame(update);
        };

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Dynamisk skärmstorlek
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Beräkna center of mass för kameran
            const avgX = playerCells.reduce((sum, c) => sum + c.x, 0) / playerCells.length;
            const avgY = playerCells.reduce((sum, c) => sum + c.y, 0) / playerCells.length;
            const totalMass = playerCells.reduce((sum, c) => sum + c.radius, 0);
            
            // Dynamisk zoom
            const zoom = Math.max(0.2, Math.min(1, 1 / (1 + Math.pow(totalMass / 300, 0.5))));

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            // Transformera kameran
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-avgX, -avgY);

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
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            // Rita Virus
            viruses.forEach(v => {
                ctx.fillStyle = '#34C759';
                ctx.strokeStyle = '#248a3d';
                ctx.lineWidth = 5;
                ctx.beginPath();
                // Rita "taggig" cirkel
                for (let i = 0; i < 20; i++) {
                    const angle = (i / 20) * Math.PI * 2;
                    const r = i % 2 === 0 ? v.radius : v.radius * 0.9;
                    ctx.lineTo(v.x + Math.cos(angle) * r, v.y + Math.sin(angle) * r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });

            // Rita Ejected Mass
            ejectedMass.forEach(m => {
                ctx.fillStyle = m.color;
                ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
            });

            // Rita Spelaren
            playerCells.forEach(cell => {
                ctx.fillStyle = cell.color;
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                // Glöd-effekt (iOS stil)
                ctx.shadowBlur = 20;
                ctx.shadowColor = cell.color;
            });

            ctx.restore();
        };

        update();
        return () => cancelAnimationFrame(animationFrameId);
    }, [playerCells, food, mousePos, ejectedMass, viruses]);

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
                        ${((user?.balance || 0) + (score * 0.01)).toFixed(2)}
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
                        <span>${(score * 0.01).toFixed(2)}</span>
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
