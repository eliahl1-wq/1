import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * AgarStake Core Game Component (Single Player Demo Version)
 * Denna fil innehåller grundmekaniken för spelet.
 */

export default function Game() {
    const canvasRef = useRef(null);
    const { user } = useAuth();
    
    // --- KONSTANTER ---
    const WORLD_SIZE = 5000;
    const INITIAL_MASS = 20;
    const MIN_SPLIT_MASS = 35;
    const MAX_PLAYER_CELLS = 16;
    const DECAY_BASE = 0.000001;
    
    // --- STATE ---
    const [playerCells, setPlayerCells] = useState([
        { 
            id: Math.random(), 
            x: WORLD_SIZE / 2, 
            y: WORLD_SIZE / 2, 
            mass: INITIAL_MASS, 
            vx: 0, 
            vy: 0, 
            canMergeTime: 0,
            color: '#007AFF' 
        }
    ]);
    const [food, setFood] = useState([]);
    const [viruses, setViruses] = useState([]);
    const [ejectedMass, setEjectedMass] = useState([]);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [totalMass, setTotalMass] = useState(INITIAL_MASS);

    // Initiera banan
    useEffect(() => {
        const initialFood = Array.from({ length: 400 }, () => ({
            id: Math.random(),
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            mass: 1,
            color: `hsl(${Math.random() * 360}, 80%, 60%)`
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

    // Input
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space') splitPlayer();
            if (e.code === 'KeyW') ejectMass();
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playerCells, mousePos]);

    const handleResize = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    const splitPlayer = () => {
        setPlayerCells(prev => {
            if (prev.length >= MAX_PLAYER_CELLS) return prev;
            let newCells = [...prev];
            const angle = Math.atan2(mousePos.y, mousePos.x);

            prev.forEach(cell => {
                if (cell.mass >= MIN_SPLIT_MASS && newCells.length < MAX_PLAYER_CELLS) {
                    cell.mass /= 2;
                    newCells.push({
                        id: Math.random(),
                        x: cell.x,
                        y: cell.y,
                        mass: cell.mass,
                        vx: Math.cos(angle) * 35,
                        vy: Math.sin(angle) * 35,
                        color: cell.color,
                        canMergeTime: Date.now() + 15000 // Kan merga efter 15 sek
                    });
                    cell.canMergeTime = Date.now() + 15000;
                }
            });
            return newCells;
        });
    };

    const ejectMass = () => {
        setPlayerCells(prev => {
            return prev.map(cell => {
                if (cell.mass > 35) {
                    cell.mass -= 1.5;
                    const angle = Math.atan2(mousePos.y, mousePos.x);
                    const dist = Math.sqrt(cell.mass * 100);
                    setEjectedMass(prevE => [...prevE, {
                        id: Math.random(),
                        x: cell.x + Math.cos(angle) * (dist + 5),
                        y: cell.y + Math.sin(angle) * (dist + 5),
                        mass: 1.2,
                        vx: Math.cos(angle) * 15,
                        vy: Math.sin(angle) * 15,
                        color: cell.color
                    }]);
                }
                return cell;
            });
        });
    };

    // Game Loop
    useEffect(() => {
        let animationFrameId;

        const update = () => {
            setPlayerCells(prevCells => {
                let cells = [...prevCells];
                
                // 1. Rörelse & Friktion
                cells = cells.map(cell => {
                    const radius = Math.sqrt(cell.mass * 100);
                    const speed = 3.5 / Math.pow(cell.mass, 0.4);
                    const angle = Math.atan2(mousePos.y, mousePos.x);
                    
                    // Basrörelse + "kick" från split
                    cell.x += (Math.cos(angle) * speed) + cell.vx;
                    cell.y += (Math.sin(angle) * speed) + cell.vy;
                    
                    cell.vx *= 0.9;
                    cell.vy *= 0.9;

                    // Världsgränser
                    cell.x = Math.max(radius, Math.min(WORLD_SIZE - radius, cell.x));
                    cell.y = Math.max(radius, Math.min(WORLD_SIZE - radius, cell.y));
                    
                    // Decay
                    cell.mass *= (1 - DECAY_BASE * cell.mass);
                    return cell;
                });

                // 2. Intern kollision (studsa eller merga egna celler)
                for (let i = 0; i < cells.length; i++) {
                    for (let j = i + 1; j < cells.length; j++) {
                        const c1 = cells[i];
                        const c2 = cells[j];
                        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
                        const r1 = Math.sqrt(c1.mass * 100);
                        const r2 = Math.sqrt(c2.mass * 100);

                        if (dist < r1 + r2) {
                            const now = Date.now();
                            if (now > c1.canMergeTime && now > c2.canMergeTime) {
                                // MERGE
                                c1.mass += c2.mass;
                                cells.splice(j, 1);
                                j--;
                            } else {
                                // BOUNCE (Push away)
                                const angle = Math.atan2(c1.y - c2.y, c1.x - c2.x);
                                const overlap = (r1 + r2) - dist;
                                c1.x += Math.cos(angle) * overlap * 0.1;
                                c1.y += Math.sin(angle) * overlap * 0.1;
                                c2.x -= Math.cos(angle) * overlap * 0.1;
                                c2.y -= Math.sin(angle) * overlap * 0.1;
                            }
                        }
                    }
                }
                return cells;
            });

            // Mat & Kollisioner
            setTotalMass(prevM => {
                let currentTotal = 0;
                playerCells.forEach(c => currentTotal += c.mass);
                return currentTotal;
            });

            setEjectedMass(prev => prev.map(m => ({
                ...m,
                x: m.x + m.vx,
                y: m.y + m.vy,
                vx: m.vx * 0.9,
                vy: m.vy * 0.9
            })).filter(m => Math.abs(m.vx) > 0.1));

            setFood(prevFood => {
                return prevFood.filter(f => {
                    let alive = true;
                    playerCells.forEach(cell => {
                        const radius = Math.sqrt(cell.mass * 100);
                        const dist = Math.hypot(cell.x - f.x, cell.y - f.y);
                        if (dist < radius) {
                            cell.mass += 0.2;
                            alive = false;
                        }
                    });
                    return alive;
                });
            });

            // Virus collision
            viruses.forEach(v => {
                playerCells.forEach((cell, idx) => {
                    const radius = Math.sqrt(cell.mass * 100);
                    const dist = Math.hypot(cell.x - v.x, cell.y - v.y);
                    if (dist < radius && cell.mass > v.radius) {
                        // EXPLODE
                        explodePlayer(idx);
                    }
                });
            });

            function explodePlayer(index) {
                setPlayerCells(prev => {
                    const cells = [...prev];
                    const cell = cells[index];
                    if (cells.length >= MAX_PLAYER_CELLS) return prev;
                    
                    const pieces = Math.min(8, MAX_PLAYER_CELLS - cells.length);
                    const newMass = cell.mass / (pieces + 1);
                    cell.mass = newMass;
                    cell.canMergeTime = Date.now() + 20000;
                    
                    for(let i=0; i<pieces; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        cells.push({
                            id: Math.random(), x: cell.x, y: cell.y, mass: newMass,
                            vx: Math.cos(angle) * 20, vy: Math.sin(angle) * 20,
                            color: cell.color, canMergeTime: Date.now() + 20000
                        });
                    }
                    return cells;
                });
            }

            render();
            animationFrameId = requestAnimationFrame(update);
        };

        const render = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d', { alpha: false }); // Performance optimization
            
            const avgX = playerCells.reduce((sum, c) => sum + c.x, 0) / playerCells.length;
            const avgY = playerCells.reduce((sum, c) => sum + c.y, 0) / playerCells.length;
            const zoom = Math.max(0.15, Math.min(1, 1 / (1 + Math.pow(totalMass / 500, 0.5))));

            ctx.fillStyle = '#0a0a0c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(zoom, zoom);
            ctx.translate(-avgX, -avgY);

            // Rita Grid
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            for (let x = 0; x <= worldSize; x += 100) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, worldSize); ctx.stroke();
            }
            for (let y = 0; y <= worldSize; y += 100) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(worldSize, y); ctx.stroke();
            }

            ctx.strokeStyle = '#FF3B30'; ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, worldSize, worldSize);

            // Rita Mat
            gameState.food.forEach(f => {
                ctx.fillStyle = f.color;
                ctx.beginPath();
                ctx.arc(f.x, f.y, 8, 0, Math.PI * 2);
                ctx.fill();
            });

            // Rita Virus
            gameState.viruses.forEach(v => {
                ctx.fillStyle = '#34C759';
                ctx.strokeStyle = '#248a3d';
                ctx.lineWidth = 5;
                ctx.beginPath();
                for (let i = 0; i < 20; i++) {
                    const angle = (i / 20) * Math.PI * 2;
                    const r = i % 2 === 0 ? v.radius : v.radius * 0.9;
                    ctx.lineTo(v.x + Math.cos(angle) * r, v.y + Math.sin(angle) * r);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });

            // Rita alla spelare
            Object.values(gameState.players).forEach(p => {
                p.cells.forEach(cell => {
                    const radius = Math.sqrt(cell.mass * 100);
                    ctx.fillStyle = p.color;
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = radius * 0.05;
                    ctx.beginPath();
                    ctx.arc(cell.x, cell.y, radius, 0, Math.PI * 2);
                    ctx.fill(); ctx.stroke();
                    
                    ctx.fillStyle = 'white'; ctx.textAlign = 'center';
                    ctx.font = `bold ${radius * 0.4}px system-ui`;
                    ctx.fillText(p.username, cell.x, cell.y);
                    ctx.font = `${radius * 0.2}px system-ui`;
                    ctx.fillText(Math.floor(cell.mass), cell.x, cell.y + radius * 0.3);
                });
            });

            ctx.restore();
        };

        update();
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState, myId]);

    const handleMouseMove = (e) => {
        socketRef.current?.emit('updateInput', {
            x: e.clientX - rect.left - canvas.width / 2,
            y: e.clientY - rect.top - canvas.height / 2
        });
    };

    const rect = canvasRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

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
                    <h3 style={{ margin: 0, opacity: 0.5, fontSize: '0.8rem', textTransform: 'uppercase' }}>Live Balance</h3>
                    <div style={{ fontSize: '1.8rem', fontWeight: '800' }}>
                        ${gameState.players[myId]?.balance.toFixed(2) || '0.00'}
                    </div>
                    <button 
                        style={{ marginTop: '10px', width: '100%', background: '#34C759', color: 'white', border: 'none', padding: '8px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => alert("Cashing out...")}
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
                        <span>${(totalMass * 0.01).toFixed(2)}</span>
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
