import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import Background from '../components/Background';
import AppTopbar from '../components/AppTopbar';
import { SlitherRenderer } from '../game/slither/SlitherRenderer.js';
import global from '../game/agar/global.js';
import * as renderUtils from '../game/agar/render.js';
import { useSpectatorCamera } from '../hooks/useSpectatorCamera';
import { getOrCreatePresenceId } from '../utils/sitePresence';
import '../styles/ui.css';
import { API_URL } from '../utils/apiBase';

/** Same as competitive Slither arena (SLITHER.worldHalf × 0.3). */
const SANDBOX_SLITHER_HALF = 900;
const AGAR_WORLD_SIZE = 6000;

function ControlSection({ title, children }) {
    return (
        <div className="sandbox-section">
            <h3 className="sandbox-section-title">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, children }) {
    return (
        <label className="sandbox-row">
            <span className="sandbox-label">{label}</span>
            {children}
        </label>
    );
}

function parseNumInput(str, fallback) {
    const n = parseFloat(String(str).replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
}

function NumInput({ value, onChange, min, max, step = 'any', className = '' }) {
    return (
        <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={className}
        />
    );
}

export default function AdminSandbox() {
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const rendererRef = useRef(null);
    const agarDataRef = useRef({ player: {}, users: [], food: [], viruses: [], ejected: [], zone: null });
    const animRef = useRef(null);
    const hasJoinedRef = useRef(false);
    const hideOverlaysRef = useRef(false);
    const pausedRef = useRef(false);
    const editModeRef = useRef(false);
    const selectedWormRef = useRef(null);

    const [mode, setMode] = useState('slither');
    const [connected, setConnected] = useState(false);
    const [gameReady, setGameReady] = useState(false);
    const [sandboxState, setSandboxState] = useState(null);
    const [paused, setPaused] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [botAi, setBotAi] = useState(true);
    const [invincible, setInvincible] = useState(true);
    const [worldHalf, setWorldHalf] = useState(SANDBOX_SLITHER_HALF);
    const [zoneRadius, setZoneRadius] = useState(SANDBOX_SLITHER_HALF);
    const [shrinkDuration, setShrinkDuration] = useState(120);
    const [shrinkEndRadius, setShrinkEndRadius] = useState(400);
    const [botCount, setBotCount] = useState(3);
    const [botSizeInput, setBotSizeInput] = useState('5');
    const [foodCount, setFoodCount] = useState(80);
    const [playerSizeInput, setPlayerSizeInput] = useState('5');
    const [staticWorms, setStaticWorms] = useState([]);
    const [controllableEntities, setControllableEntities] = useState([]);
    const [selectedWorm, setSelectedWorm] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [hideOverlays, setHideOverlays] = useState(false);
    const [wormX, setWormX] = useState(0);
    const [wormY, setWormY] = useState(0);
    const [wormSizeInput, setWormSizeInput] = useState('8');
    const [wormAngleInput, setWormAngleInput] = useState('0');
    const [wormBendInput, setWormBendInput] = useState('0');
    const [agarZone, setAgarZone] = useState(null);
    const [sessionEpoch, setSessionEpoch] = useState(0);
    const [restarting, setRestarting] = useState(false);

    const spectatorBounds = mode === 'slither'
        ? {
            minX: -worldHalf + 80,
            maxX: worldHalf - 80,
            minY: -worldHalf + 80,
            maxY: worldHalf - 80,
        }
        : {
            minX: 120,
            maxX: AGAR_WORLD_SIZE - 120,
            minY: 120,
            maxY: AGAR_WORLD_SIZE - 120,
        };

    const { camRef: specCamRef, seed: seedSpecCam } = useSpectatorCamera({
        active: paused && gameReady,
        canvasRef,
        worldBounds: spectatorBounds,
        baseViewZoom: 1,
        minZoom: mode === 'slither' ? 0.5 : 0.35,
        maxZoom: mode === 'slither' ? 4.2 : 2,
        initialZoom: mode === 'slither' ? 2.5 : 1,
    });

    useEffect(() => {
        pausedRef.current = paused;
    }, [paused]);

    useEffect(() => {
        editModeRef.current = editMode;
    }, [editMode]);

    useEffect(() => {
        selectedWormRef.current = selectedWorm;
    }, [selectedWorm]);

    const syncWormEditorFromEntity = useCallback((entity) => {
        if (!entity) return;
        if (entity.x != null) setWormX(Math.round(entity.x));
        if (entity.y != null) setWormY(Math.round(entity.y));
        if (entity.balance != null) setWormSizeInput(String(entity.balance));
        if (entity.angle != null) setWormAngleInput(String(entity.angle));
        if (entity.bend != null) setWormBendInput(String(entity.bend));
    }, []);

    useEffect(() => {
        if (!selectedWorm) return;
        const fromStatic = staticWorms.find(w => w.id === selectedWorm);
        const fromCtrl = controllableEntities.find(w => w.id === selectedWorm);
        syncWormEditorFromEntity(fromStatic || fromCtrl);
    }, [selectedWorm, staticWorms, controllableEntities, syncWormEditorFromEntity]);

    const sendControl = useCallback((action, params = {}) => {
        socketRef.current?.emit('sandboxControl', { token, mode, action, params });
    }, [token, mode]);

    const resetLocalSandboxState = useCallback(() => {
        agarDataRef.current = { player: {}, users: [], food: [], viruses: [], ejected: [], zone: null };
        setSandboxState(null);
        setStaticWorms([]);
        setSelectedWorm(null);
        setAgarZone(null);
        setPaused(false);
    }, []);

    const disconnectSocket = useCallback(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);
        if (rendererRef.current) {
            rendererRef.current.destroy();
            rendererRef.current = null;
        }
        if (socketRef.current) {
            socketRef.current.off();
            socketRef.current.disconnect();
            socketRef.current = null;
        }
        hasJoinedRef.current = false;
        setConnected(false);
        setGameReady(false);
    }, []);

    const handleAbort = useCallback(() => {
        if (!window.confirm('Avbryt och starta om sandboxen helt? Allt raderas, du kopplas från och en ny session startas.')) {
            return;
        }
        setRestarting(true);
        setGameReady(false);
        const finishAbort = () => {
            disconnectSocket();
            resetLocalSandboxState();
            setSessionEpoch((n) => n + 1);
            setTimeout(() => setRestarting(false), 400);
        };
        if (socketRef.current?.connected) {
            socketRef.current.emit('sandboxControl', { token, mode, action: 'abort' });
            setTimeout(finishAbort, 120);
        } else {
            finishAbort();
        }
    }, [token, mode, disconnectSocket, resetLocalSandboxState]);

    const startAgarLoop = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const graph = canvas.getContext('2d');

        const loop = () => {
            const { player, users, food, viruses, ejected, zone } = agarDataRef.current;
            const W = canvas.width;
            const H = canvas.height;
            const camX = pausedRef.current ? specCamRef.current.x : (player?.x ?? AGAR_WORLD_SIZE / 2);
            const camY = pausedRef.current ? specCamRef.current.y : (player?.y ?? AGAR_WORLD_SIZE / 2);
            const zoom = pausedRef.current ? specCamRef.current.zoom : 1;

            graph.fillStyle = global.backgroundColor;
            graph.fillRect(0, 0, W, H);
            renderUtils.drawGrid(global, { x: camX, y: camY }, { width: W, height: H }, graph, zoom);

            const z = zone || agarZone;
            if (z?.radius != null) {
                const zx = (z.cx - camX) * zoom + W / 2;
                const zy = (z.cy - camY) * zoom + H / 2;
                graph.save();
                graph.fillStyle = 'rgba(255, 59, 48, 0.12)';
                graph.beginPath();
                graph.arc(zx, zy, z.radius * zoom, 0, Math.PI * 2);
                graph.fill();
                graph.strokeStyle = z.shrinking ? 'rgba(255, 80, 60, 0.85)' : 'rgba(255, 255, 255, 0.25)';
                graph.lineWidth = 3;
                graph.stroke();
                graph.restore();
            }

            const worldToScreen = (wx, wy) => ({
                x: (wx - camX) * zoom + W / 2,
                y: (wy - camY) * zoom + H / 2,
            });

            food.forEach(f => {
                renderUtils.drawFood(worldToScreen(f.x, f.y), { ...f, radius: (f.radius || 5) * zoom }, graph);
            });
            viruses.forEach(v => {
                renderUtils.drawVirus(worldToScreen(v.x, v.y), { ...v, radius: (v.radius || 50) * zoom }, graph);
            });
            ejected.forEach(e => {
                renderUtils.drawFireFood(worldToScreen(e.x, e.y), { ...e, radius: (e.radius || 5) * zoom }, { border: 6 * zoom }, graph);
            });

            const cellsToDraw = [];
            const borders = [];
            users.forEach(u => {
                (u.cells || []).forEach(cell => {
                    cellsToDraw.push({
                        ...cell,
                        x: worldToScreen(cell.x, cell.y).x,
                        y: worldToScreen(cell.x, cell.y).y,
                        radius: (cell.radius || 20) * zoom,
                        color: u.color,
                        name: u.username,
                    });
                    borders.push({ x: cell.x, y: cell.y, radius: cell.radius });
                });
            });
            if (cellsToDraw.length) {
                if (hideOverlaysRef.current) {
                    for (const cell of cellsToDraw) {
                        renderUtils.drawOrganicCell(cell, borders, graph);
                    }
                } else {
                    renderUtils.drawCells(cellsToDraw, { border: 6 * zoom, textBorderSize: 3 * zoom, textColor: '#fff', textBorder: '#000' }, 1, borders, graph);
                }
            }

            animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
    }, [agarZone]);

    useEffect(() => {
        hideOverlaysRef.current = hideOverlays;
        rendererRef.current?.setHideOverlays(hideOverlays);
    }, [hideOverlays]);

    useEffect(() => {
        if (!paused || !gameReady) return;
        if (mode === 'slither' && rendererRef.current) {
            const r = rendererRef.current;
            seedSpecCam(r.camera.x, r.camera.y, r.zoom);
            r.setInputEnabled(false);
        } else if (mode === 'agar') {
            const p = agarDataRef.current.player;
            seedSpecCam(p?.x ?? AGAR_WORLD_SIZE / 2, p?.y ?? AGAR_WORLD_SIZE / 2, specCamRef.current.zoom || 1);
        }
    }, [paused, gameReady, mode, seedSpecCam, specCamRef]);

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!paused || mode !== 'slither' || !renderer) {
            renderer?.setExternalCameraGetter(null);
            if (renderer && mode === 'slither' && !paused) {
                renderer.setSpectatorMode(false);
                renderer.setInputEnabled(true);
            }
            return undefined;
        }
        renderer.setInputEnabled(false);
        renderer.setSpectatorMode(true, {
            x: specCamRef.current.x,
            y: specCamRef.current.y,
            zoom: specCamRef.current.zoom,
        });
        renderer.setExternalCameraGetter(() => specCamRef.current);
        return () => {
            renderer.setExternalCameraGetter(null);
            renderer.setSpectatorMode(false);
            renderer.setInputEnabled(true);
        };
    }, [paused, mode, specCamRef]);

    useEffect(() => {
        if (!user?.isAdmin || !token) return undefined;

        disconnectSocket();

        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const resize = () => {
            const parent = canvas.parentElement;
            if (!parent) return;
            if (mode === 'slither' && rendererRef.current) {
                rendererRef.current.resize();
            } else {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            }
            if (mode === 'agar' && socketRef.current?.connected) {
                const w = canvas.width;
                const h = canvas.height;
                socketRef.current.emit('0', {
                    x: 0, y: 0,
                    screenWidth: w,
                    screenHeight: h,
                });
            }
        };
        resize();
        window.addEventListener('resize', resize);

        if (mode === 'slither') {
            const renderer = new SlitherRenderer(canvas, { resizeToCanvas: true });
            rendererRef.current = renderer;
            renderer.setHideOverlays(hideOverlaysRef.current);
            renderer.start();
            renderer.setInputEmitter(() => {
                if (pausedRef.current) return;
                if (socketRef.current?.connected && rendererRef.current) {
                    socketRef.current.emit('slitherInput', rendererRef.current.getInput());
                }
            });
        } else {
            startAgarLoop();
        }

        const socket = io(API_URL, {
            auth: { token, presenceId: getOrCreatePresenceId() },
            transports: ['polling', 'websocket'],
            reconnection: true,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            if (!hasJoinedRef.current) {
                socket.emit('sandboxJoin', { token, mode, username: user.username });
                hasJoinedRef.current = true;
            }
        });

        socket.on('welcome', (player, meta) => {
            setGameReady(true);
            if (meta?.zone) {
                if (mode === 'slither') {
                    rendererRef.current?.updateState({
                        zone: meta.zone,
                        competitiveSlither: true,
                        circularMap: true,
                    });
                } else {
                    setAgarZone(meta.zone);
                    agarDataRef.current.zone = meta.zone;
                }
            }
            if (mode === 'slither') {
                rendererRef.current?.resetSession();
            } else {
                agarDataRef.current.player = player;
            }
        });

        socket.on('slitherTick', (tick) => {
            const renderer = rendererRef.current;
            if (!renderer) return;
            if (tick.zone) {
                renderer.updateState({
                    ...tick,
                    competitiveSlither: true,
                    circularMap: true,
                });
            } else {
                renderer.updateState(tick);
            }
        });

        socket.on('serverTellPlayerMove', (playerData, userData, foodList, massList, virusList, meta) => {
            agarDataRef.current.player = playerData;
            agarDataRef.current.users = userData || [];
            agarDataRef.current.food = foodList || [];
            agarDataRef.current.ejected = massList || [];
            agarDataRef.current.viruses = virusList || [];
            if (meta?.zone) {
                agarDataRef.current.zone = meta.zone;
                setAgarZone(meta.zone);
            }
        });

        socket.on('sandboxState', (state) => {
            setSandboxState(state);
            if (state?.paused != null) setPaused(state.paused);
            if (state?.speedMultiplier != null) setSpeed(state.speedMultiplier);
            if (state?.zone?.radius != null) setZoneRadius(Math.round(state.zone.radius));
            if (state?.staticWormIds?.length) {
                setStaticWorms(state.staticWormIds);
                if (!selectedWormRef.current && state.staticWormIds[0]) {
                    setSelectedWorm(state.staticWormIds[0].id);
                }
            } else if (state?.staticWormIds) {
                setStaticWorms([]);
            }
            if (state?.controllableEntities) {
                setControllableEntities(state.controllableEntities);
            }
            if (state?.lastAction === 'addStaticWorm' && state?.result) {
                const { id, x, y, angle, bend } = state.result;
                if (id) setSelectedWorm(id);
                if (x != null) setWormX(Math.round(x));
                if (y != null) setWormY(Math.round(y));
                if (angle != null) setWormAngleInput(String(angle));
                if (bend != null) setWormBendInput(String(bend));
            }
            if (state?.lastAction === 'possessEntity') {
                setPaused(false);
                pausedRef.current = false;
            }
        });

        socket.on('sandboxStaticWorms', (worms) => setStaticWorms(worms || []));
        socket.on('sandboxAborted', () => {
            disconnectSocket();
            resetLocalSandboxState();
            setGameReady(false);
            setRestarting(true);
            setSessionEpoch((n) => n + 1);
            setTimeout(() => setRestarting(false), 400);
        });

        socket.on('error', (msg) => console.error('Sandbox error:', msg));
        socket.on('disconnect', () => setConnected(false));

        // Agar mouse input
        const onPointer = (e) => {
            if (mode !== 'agar' || !socket.connected || pausedRef.current) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left - canvas.width / 2;
            const my = e.clientY - rect.top - canvas.height / 2;
            socket.emit('0', { x: mx, y: my, screenWidth: canvas.width, screenHeight: canvas.height });
        };
        const onSplit = (e) => { if (e.code === 'Space' && mode === 'agar') socket.emit('1'); };
        canvas.addEventListener('pointermove', onPointer);
        canvas.addEventListener('pointerdown', onPointer);
        window.addEventListener('keydown', onSplit);

        return () => {
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('pointermove', onPointer);
            canvas.removeEventListener('pointerdown', onPointer);
            window.removeEventListener('keydown', onSplit);
            disconnectSocket();
        };
    }, [user, token, mode, sessionEpoch, disconnectSocket, startAgarLoop, resetLocalSandboxState]);

    useEffect(() => {
        if (!gameReady || mode !== 'slither') return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const onCanvasClick = (e) => {
            if (pausedRef.current || !editModeRef.current || !selectedWormRef.current || !rendererRef.current) return;
            const rect = canvas.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const cam = rendererRef.current.camera || { x: 0, y: 0 };
            const zoom = rendererRef.current.zoom || 1;
            const worldX = (screenX - rect.width / 2) / zoom + cam.x;
            const worldY = (screenY - rect.height / 2) / zoom + cam.y;
            const wormId = selectedWormRef.current;
            socketRef.current?.emit('sandboxMoveStatic', { token, id: wormId, x: worldX, y: worldY });
            socketRef.current?.emit('sandboxControl', {
                token,
                mode,
                action: 'moveStaticWorm',
                params: { id: wormId, x: worldX, y: worldY },
            });
            setWormX(Math.round(worldX));
            setWormY(Math.round(worldY));
        };
        canvas.addEventListener('click', onCanvasClick);
        return () => canvas.removeEventListener('click', onCanvasClick);
    }, [gameReady, mode, token]);

    const applySelectedWorm = useCallback(() => {
        if (!selectedWorm || !staticWorms.some(w => w.id === selectedWorm)) return;
        const balance = parseNumInput(wormSizeInput, 8);
        const angle = parseNumInput(wormAngleInput, 0);
        const bend = parseNumInput(wormBendInput, 0);
        sendControl('moveStaticWorm', {
            id: selectedWorm,
            x: wormX,
            y: wormY,
            angle,
            bend,
            balance,
            useCustomPosition: true,
        });
    }, [selectedWorm, staticWorms, wormX, wormY, wormSizeInput, wormAngleInput, wormBendInput, sendControl]);

    const possessEntity = useCallback((entityId) => {
        if (!entityId) return;
        sendControl('possessEntity', { id: entityId, leaveBody: true });
        setPaused(false);
        pausedRef.current = false;
        sendControl('pause', { paused: false });
    }, [sendControl]);

    const switchMode = (newMode) => {
        if (newMode === mode) return;
        disconnectSocket();
        setMode(newMode);
        setWorldHalf(newMode === 'slither' ? SANDBOX_SLITHER_HALF : 3000);
        setZoneRadius(newMode === 'slither' ? SANDBOX_SLITHER_HALF : 3000);
        setGameReady(false);
    };

    if (!user?.isAdmin) {
        return (
            <div className="admin-page">
                <Background />
                <p style={{ padding: 40, color: '#fff' }}>Admin access required.</p>
            </div>
        );
    }

    return (
        <div className="admin-page sandbox-page">
            <Background />
            <AppTopbar />
            <div className="sandbox-layout">
                <aside className="sandbox-panel">
                    <div className="sandbox-panel-header">
                        <h2>Sandbox Studio</h2>
                        <button type="button" className="ui-btn ui-btn-ghost" onClick={() => navigate('/admin')}>
                            ← Dashboard
                        </button>
                    </div>

                    <div className="sandbox-mode-tabs">
                        <button
                            type="button"
                            className={`ui-btn ${mode === 'slither' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                            onClick={() => switchMode('slither')}
                        >
                            Slither
                        </button>
                        <button
                            type="button"
                            className={`ui-btn ${mode === 'agar' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                            onClick={() => switchMode('agar')}
                        >
                            Agar
                        </button>
                    </div>

                    <p className="sandbox-status">
                        {connected ? (gameReady ? '● Live' : '○ Connecting…') : '○ Disconnected'}
                        {sandboxState?.paused && ' · Paused · drag camera'}
                    </p>

                    <ControlSection title="Playback">
                        <button
                            type="button"
                            className={`ui-btn sandbox-full-btn ${hideOverlays ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                            onClick={() => setHideOverlays(v => !v)}
                        >
                            {hideOverlays ? 'Show UI overlays' : 'Hide UI overlays'}
                        </button>
                        <p className="sandbox-hint">Döljer balance, nickname och minimap — bra för screenshots.</p>
                        <div className="sandbox-btn-row">
                            <button
                                type="button"
                                className={`ui-btn ${paused ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                                onClick={() => { setPaused(true); sendControl('pause', { paused: true }); }}
                            >
                                Pause
                            </button>
                            <button
                                type="button"
                                className={`ui-btn ${!paused ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                                onClick={() => { setPaused(false); sendControl('pause', { paused: false }); }}
                            >
                                Play
                            </button>
                        </div>
                        <p className="sandbox-hint">Pause = spectator: dra kameran med musen, scrolla för zoom.</p>
                        <Row label={`Speed: ${speed.toFixed(1)}×`}>
                            <input
                                type="range" min="0.2" max="3" step="0.1" value={speed}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setSpeed(v);
                                    sendControl('setSpeed', { multiplier: v });
                                }}
                            />
                        </Row>
                        <label className="sandbox-check">
                            <input
                                type="checkbox" checked={botAi}
                                onChange={(e) => { setBotAi(e.target.checked); sendControl('setBotAi', { enabled: e.target.checked }); }}
                            />
                            Bot AI
                        </label>
                        <label className="sandbox-check">
                            <input
                                type="checkbox" checked={invincible}
                                onChange={(e) => { setInvincible(e.target.checked); sendControl('setInvincible', { enabled: e.target.checked }); }}
                            />
                            Invincible (no deaths)
                        </label>
                    </ControlSection>

                    <ControlSection title="Arena & Zone">
                        <Row label={`World: ${worldHalf}`}>
                            <input
                                type="range" min="800" max="4000" step="100" value={worldHalf}
                                onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setWorldHalf(v);
                                    setZoneRadius(v);
                                }}
                                onMouseUp={() => sendControl('setWorldSize', { worldHalf })}
                                onTouchEnd={() => sendControl('setWorldSize', { worldHalf })}
                            />
                        </Row>
                        <Row label={`Zone radius: ${zoneRadius}`}>
                            <input
                                type="range" min="200" max={worldHalf} step="50" value={zoneRadius}
                                onChange={(e) => setZoneRadius(parseInt(e.target.value, 10))}
                                onMouseUp={() => sendControl('setZoneRadius', { radius: zoneRadius })}
                                onTouchEnd={() => sendControl('setZoneRadius', { radius: zoneRadius })}
                            />
                        </Row>
                        <Row label={`Shrink time: ${shrinkDuration}s`}>
                            <input
                                type="range" min="10" max="300" step="5" value={shrinkDuration}
                                onChange={(e) => setShrinkDuration(parseInt(e.target.value, 10))}
                            />
                        </Row>
                        <Row label={`End radius: ${shrinkEndRadius}`}>
                            <input
                                type="range" min="100" max={worldHalf} step="50" value={shrinkEndRadius}
                                onChange={(e) => setShrinkEndRadius(parseInt(e.target.value, 10))}
                            />
                        </Row>
                        <div className="sandbox-btn-row">
                            <button
                                type="button" className="ui-btn ui-btn-primary"
                                onClick={() => sendControl('startZoneShrink', {
                                    durationMs: shrinkDuration * 1000,
                                    endRadius: shrinkEndRadius,
                                })}
                            >
                                Start shrink
                            </button>
                            <button type="button" className="ui-btn ui-btn-ghost" onClick={() => sendControl('stopZoneShrink')}>
                                Stop
                            </button>
                        </div>
                    </ControlSection>

                    <ControlSection title="Entities">
                        <Row label="Your size">
                            <NumInput
                                min="0.5" max="500" step="0.5"
                                value={playerSizeInput}
                                onChange={setPlayerSizeInput}
                            />
                            <button
                                type="button" className="ui-btn ui-btn-ghost sandbox-mini-btn"
                                onClick={() => sendControl('setEntitySize', { balance: parseNumInput(playerSizeInput, 5) })}
                            >
                                Apply
                            </button>
                        </Row>
                        <Row label={`Bots: ${botCount}`}>
                            <input type="range" min="0" max="20" value={botCount} onChange={(e) => setBotCount(parseInt(e.target.value, 10))} />
                        </Row>
                        <Row label="Bot size">
                            <NumInput
                                min="0.5" max="200" step="0.5"
                                value={botSizeInput}
                                onChange={setBotSizeInput}
                            />
                        </Row>
                        <button
                            type="button" className="ui-btn ui-btn-primary sandbox-full-btn"
                            onClick={() => sendControl('spawnBots', { count: botCount, balance: parseNumInput(botSizeInput, 5) })}
                        >
                            Spawn bots
                        </button>
                        <Row label={`Food: ${foodCount}`}>
                            <input type="range" min="10" max="400" step="10" value={foodCount} onChange={(e) => setFoodCount(parseInt(e.target.value, 10))} />
                        </Row>
                        <button
                            type="button" className="ui-btn ui-btn-primary sandbox-full-btn"
                            onClick={() => sendControl('spawnFood', { count: foodCount })}
                        >
                            Spawn food
                        </button>
                    </ControlSection>

                    {mode === 'slither' && (
                        <ControlSection title="Static worms &amp; control">
                            <p className="sandbox-hint">Lägg till statiska ormar, böj dem, eller ta kontroll och spela som dem.</p>
                            <button
                                type="button" className="ui-btn ui-btn-primary sandbox-full-btn"
                                onClick={() => {
                                    sendControl('addStaticWorm', {
                                        balance: parseNumInput(wormSizeInput, 8),
                                        angle: parseNumInput(wormAngleInput, 0),
                                        bend: parseNumInput(wormBendInput, 0),
                                    });
                                }}
                            >
                                + Add worm (beside you)
                            </button>
                            <label className="sandbox-check">
                                <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
                                Click canvas to move selected worm
                            </label>
                            {(staticWorms.length > 0 || controllableEntities.length > 0) && (
                                <Row label="Selected entity">
                                    <select
                                        value={selectedWorm || ''}
                                        onChange={(e) => setSelectedWorm(e.target.value)}
                                        style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', borderRadius: 6, padding: 4 }}
                                    >
                                        {staticWorms.map(w => (
                                            <option key={w.id} value={w.id}>{w.name || w.id} (${w.balance})</option>
                                        ))}
                                        {controllableEntities.filter(e => e.type === 'bot').map(w => (
                                            <option key={w.id} value={w.id}>{w.name || w.id} (bot ${w.balance})</option>
                                        ))}
                                    </select>
                                </Row>
                            )}
                            <Row label="X">
                                <NumInput value={String(wormX)} onChange={(v) => setWormX(parseNumInput(v, 0))} />
                            </Row>
                            <Row label="Y">
                                <NumInput value={String(wormY)} onChange={(v) => setWormY(parseNumInput(v, 0))} />
                            </Row>
                            <Row label="Size">
                                <NumInput min="0.5" max="200" step="0.5" value={wormSizeInput} onChange={setWormSizeInput} />
                            </Row>
                            <Row label={`Angle: ${parseNumInput(wormAngleInput, 0).toFixed(2)} rad`}>
                                <input
                                    type="range" min={-3.14} max={3.14} step="0.05"
                                    value={parseNumInput(wormAngleInput, 0)}
                                    onChange={(e) => setWormAngleInput(e.target.value)}
                                    onMouseUp={applySelectedWorm}
                                    onTouchEnd={applySelectedWorm}
                                />
                            </Row>
                            <Row label={`Bend: ${parseNumInput(wormBendInput, 0).toFixed(2)} rad/seg`}>
                                <input
                                    type="range" min={-0.35} max={0.35} step="0.01"
                                    value={parseNumInput(wormBendInput, 0)}
                                    onChange={(e) => setWormBendInput(e.target.value)}
                                    onMouseUp={applySelectedWorm}
                                    onTouchEnd={applySelectedWorm}
                                />
                            </Row>
                            {selectedWorm && staticWorms.some(w => w.id === selectedWorm) && (
                                <button
                                    type="button"
                                    className="ui-btn ui-btn-ghost sandbox-full-btn"
                                    onClick={applySelectedWorm}
                                >
                                    Apply to selected
                                </button>
                            )}
                            {selectedWorm && (
                                <button
                                    type="button"
                                    className="ui-btn ui-btn-primary sandbox-full-btn"
                                    onClick={() => possessEntity(selectedWorm)}
                                >
                                    Take control (play as this)
                                </button>
                            )}
                            {selectedWorm && staticWorms.some(w => w.id === selectedWorm) && (
                                <button
                                    type="button"
                                    className="ui-btn ui-btn-ghost sandbox-full-btn"
                                    onClick={() => {
                                        sendControl('removeStaticWorm', { id: selectedWorm });
                                        setSelectedWorm(null);
                                    }}
                                >
                                    Remove static worm
                                </button>
                            )}
                            {(sandboxState?.staticWorms > 0 || staticWorms.length > 0) && (
                                <p className="sandbox-hint">{sandboxState?.staticWorms ?? staticWorms.length} static worm(s) active</p>
                            )}
                        </ControlSection>
                    )}

                    <ControlSection title="Reset">
                        <button
                            type="button"
                            className="ui-btn ui-btn-danger sandbox-full-btn"
                            onClick={() => { if (window.confirm('Clear all entities?')) sendControl('clear'); }}
                        >
                            Clear sandbox
                        </button>
                        <button
                            type="button"
                            className="ui-btn ui-btn-abort sandbox-full-btn"
                            onClick={handleAbort}
                        >
                            Abort &amp; restart
                        </button>
                        <p className="sandbox-hint">Abort kopplar från, raderar allt (agar + slither) och startar en helt ny session — använd om det laggar eller kraschar.</p>
                    </ControlSection>
                </aside>

                <main className="sandbox-canvas-wrap">
                    <canvas ref={canvasRef} className="sandbox-canvas" />
                    {!gameReady && (
                        <div className="sandbox-overlay">
                            <p>{restarting ? 'Startar om sandbox…' : 'Connecting to sandbox…'}</p>
                        </div>
                    )}
                </main>
            </div>

            <style>{`
                .sandbox-page { min-height: 100vh; }
                .sandbox-layout {
                    display: flex;
                    height: calc(100vh - 56px);
                    margin-top: 56px;
                }
                .sandbox-panel {
                    width: 320px;
                    flex-shrink: 0;
                    overflow-y: auto;
                    background: rgba(10, 10, 14, 0.92);
                    border-right: 1px solid rgba(255,255,255,0.08);
                    padding: 16px;
                }
                .sandbox-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                .sandbox-panel-header h2 {
                    font-family: var(--display);
                    font-size: 1.1rem;
                    color: var(--text-h);
                    margin: 0;
                }
                .sandbox-mode-tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .sandbox-status {
                    font-size: 0.75rem;
                    color: var(--text-m);
                    margin: 0 0 12px;
                }
                .sandbox-section {
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .sandbox-section-title {
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--text-m);
                    margin: 0 0 8px;
                }
                .sandbox-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    margin-bottom: 8px;
                    font-size: 0.8rem;
                    color: var(--text-b);
                }
                .sandbox-label { color: var(--text-m); }
                .sandbox-row input[type="range"] { width: 100%; }
                .sandbox-row input[type="number"] {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    color: #fff;
                    padding: 4px 8px;
                    width: 100%;
                }
                .sandbox-check {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    color: var(--text-b);
                    margin-bottom: 6px;
                    cursor: pointer;
                }
                .sandbox-btn-row {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .sandbox-btn-row .ui-btn { flex: 1; }
                .sandbox-full-btn { width: 100%; margin-bottom: 8px; }
                .sandbox-mini-btn { padding: 2px 8px !important; height: auto !important; }
                .sandbox-hint {
                    font-size: 0.72rem;
                    color: var(--text-m);
                    margin: 0 0 8px;
                    line-height: 1.4;
                }
                .sandbox-canvas-wrap {
                    flex: 1;
                    position: relative;
                    background: #0a0a0c;
                }
                .sandbox-canvas {
                    width: 100%;
                    height: 100%;
                    display: block;
                    cursor: crosshair;
                }
                .sandbox-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.5);
                    color: #fff;
                    pointer-events: none;
                }
                .ui-btn-danger {
                    background: rgba(220, 50, 50, 0.2) !important;
                    border-color: rgba(220, 50, 50, 0.4) !important;
                    color: #ff6b6b !important;
                }
                .ui-btn-abort {
                    background: rgba(180, 40, 40, 0.35) !important;
                    border-color: rgba(255, 80, 80, 0.55) !important;
                    color: #ff9999 !important;
                    font-weight: 700;
                }
                .ui-btn-abort:hover {
                    background: rgba(200, 50, 50, 0.5) !important;
                }
            `}</style>
        </div>
    );
}

