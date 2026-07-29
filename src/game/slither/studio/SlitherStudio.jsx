import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SlitherRenderer } from '../SlitherRenderer.js';
import { SlitherStudioSimulation, STUDIO_TICK_MS } from './SlitherStudioSimulation.js';
import { cloneScenario, STUDIO_SCENARIOS } from './studioScenarios.js';
import './slitherStudio.css';

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 640;
const CAPTURE_DPR = 3;

function recordingMimeType() {
    const candidates = [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
    ];
    return candidates.find(type => window.MediaRecorder?.isTypeSupported(type)) || '';
}

function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

export default function SlitherStudio() {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const simulationRef = useRef(null);
    const frameRef = useRef(null);
    const lastFrameAtRef = useRef(0);
    const accumulatorRef = useRef(0);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);

    const initialScenario = useMemo(() => cloneScenario(STUDIO_SCENARIOS[0]), []);
    const [scenario, setScenario] = useState(initialScenario);
    const [scenarioText, setScenarioText] = useState(() => JSON.stringify(initialScenario, null, 2));
    const [playing, setPlaying] = useState(true);
    const [elapsed, setElapsed] = useState(0);
    const [recording, setRecording] = useState(false);
    const [notice, setNotice] = useState('Redo att spela in');
    const playingRef = useRef(playing);
    playingRef.current = playing;

    const pushStateToRenderer = useCallback(() => {
        const simulation = simulationRef.current;
        const renderer = rendererRef.current;
        if (!simulation || !renderer) return;
        renderer.updateState(simulation.getRenderState());
        setElapsed(simulation.elapsedSeconds);
    }, []);

    const resetWithScenario = useCallback((nextScenario, shouldPlay = true) => {
        simulationRef.current = new SlitherStudioSimulation(nextScenario);
        accumulatorRef.current = 0;
        lastFrameAtRef.current = performance.now();
        rendererRef.current?.resetSession();
        rendererRef.current?.setSpectatorMode(true, simulationRef.current.getCamera());
        rendererRef.current?.setExternalCameraGetter(() => simulationRef.current?.getCamera());
        rendererRef.current?.setHideOverlays(nextScenario.hideOverlays !== false);
        pushStateToRenderer();
        setElapsed(0);
        setPlaying(shouldPlay);
        setNotice('Scenen \u00e5terst\u00e4lld');
    }, [pushStateToRenderer]);

    const finishRecording = useCallback(() => {
        const recorder = recorderRef.current;
        if (recorder?.state === 'recording') recorder.stop();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const renderer = new SlitherRenderer(canvas, {
            fixedViewWidth: VIEW_WIDTH,
            fixedViewHeight: VIEW_HEIGHT,
            fixedDpr: CAPTURE_DPR,
        });
        renderer.setInputEnabled(false);
        renderer.start();
        rendererRef.current = renderer;
        resetWithScenario(initialScenario, true);

        const animate = now => {
            const simulation = simulationRef.current;
            if (simulation && playingRef.current) {
                const delta = Math.min(100, now - (lastFrameAtRef.current || now));
                accumulatorRef.current += delta;
                while (accumulatorRef.current >= STUDIO_TICK_MS && !simulation.finished) {
                    simulation.step();
                    accumulatorRef.current -= STUDIO_TICK_MS;
                }
                renderer.updateState(simulation.getRenderState());
                setElapsed(simulation.elapsedSeconds);
                if (simulation.finished) {
                    setPlaying(false);
                    finishRecording();
                    setNotice('Scenen \u00e4r klar');
                }
            }
            lastFrameAtRef.current = now;
            frameRef.current = requestAnimationFrame(animate);
        };
        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
            finishRecording();
            renderer.destroy();
            rendererRef.current = null;
        };
    }, [finishRecording, initialScenario, resetWithScenario]);

    const applyScenarioText = () => {
        try {
            const parsed = JSON.parse(scenarioText);
            if (!Array.isArray(parsed.actors) || parsed.actors.length === 0) {
                throw new Error('Scenen m\u00e5ste ha minst en actor.');
            }
            setScenario(parsed);
            resetWithScenario(parsed, true);
            setNotice('Scenariot laddades');
        } catch (error) {
            setNotice(`Kunde inte l\u00e4sa scenariot: ${error.message}`);
        }
    };

    const chooseScenario = id => {
        const selected = STUDIO_SCENARIOS.find(item => item.id === id);
        if (!selected) return;
        const next = cloneScenario(selected);
        setScenario(next);
        setScenarioText(JSON.stringify(next, null, 2));
        resetWithScenario(next, true);
    };

    const togglePlayback = () => {
        if (simulationRef.current?.finished) {
            resetWithScenario(scenario, true);
            return;
        }
        lastFrameAtRef.current = performance.now();
        setPlaying(value => !value);
    };

    const startRecording = () => {
        const canvas = canvasRef.current;
        if (!canvas?.captureStream || !window.MediaRecorder) {
            setNotice('Den h\u00e4r webbl\u00e4saren kan inte spela in canvas-video.');
            return;
        }

        const mimeType = recordingMimeType();
        const stream = canvas.captureStream(60);
        const options = {
            videoBitsPerSecond: 14_000_000,
            ...(mimeType ? { mimeType } : {}),
        };
        const recorder = new MediaRecorder(stream, options);
        chunksRef.current = [];
        recorderRef.current = recorder;
        recorder.ondataavailable = event => {
            if (event.data?.size) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
            const actualType = recorder.mimeType || mimeType || 'video/webm';
            const extension = actualType.includes('mp4') ? 'mp4' : 'webm';
            const blob = new Blob(chunksRef.current, { type: actualType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${scenario.id || 'slither-scene'}-${Date.now()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            stream.getTracks().forEach(track => track.stop());
            recorderRef.current = null;
            setRecording(false);
            setNotice(`Videon sparades som ${extension.toUpperCase()} i 1080 x 1920`);
        };

        resetWithScenario(scenario, true);
        recorder.start(250);
        setRecording(true);
        setNotice('Spelar in hela scenen...');
    };

    const progress = Math.min(1, elapsed / Math.max(1, Number(scenario.duration) || 1));

    return (
        <main className="slither-studio">
            <section className="slither-studio__preview-column">
                <header className="slither-studio__header">
                    <div>
                        <span className="slither-studio__eyebrow">LOCAL GAMEPLAY STUDIO</span>
                        <h1>Slither Director</h1>
                    </div>
                    <span className={`slither-studio__status ${recording ? 'is-recording' : ''}`}>
                        {recording ? 'REC' : 'READY'}
                    </span>
                </header>

                <div className="slither-studio__phone-frame">
                    <canvas ref={canvasRef} aria-label="Slither studio preview" />
                </div>

                <div className="slither-studio__transport">
                    <button type="button" onClick={() => resetWithScenario(scenario, false)}>Reset</button>
                    <button className="is-primary" type="button" onClick={togglePlayback}>
                        {playing ? 'Pausa' : simulationRef.current?.finished ? 'Spela igen' : 'Spela'}
                    </button>
                    <div className="slither-studio__time">
                        <span>{formatTime(elapsed)}</span>
                        <div><i style={{ width: `${progress * 100}%` }} /></div>
                        <span>{formatTime(scenario.duration)}</span>
                    </div>
                </div>
            </section>

            <aside className="slither-studio__panel">
                <label>
                    Scen
                    <select value={scenario.id || ''} onChange={event => chooseScenario(event.target.value)}>
                        {STUDIO_SCENARIOS.map(item => (
                            <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                    </select>
                </label>

                <div className="slither-studio__scene-card">
                    <strong>{scenario.title || scenario.id}</strong>
                    <p>{scenario.description || 'Eget Slither-scenario'}</p>
                    <div>
                        <span>{scenario.duration}s</span>
                        <span>{scenario.actors?.length || 0} ormar</span>
                        <span>Seed {scenario.seed}</span>
                    </div>
                </div>

                <button
                    className="slither-studio__record"
                    type="button"
                    disabled={recording}
                    onClick={startRecording}
                >
                    {recording ? 'Spelar in...' : 'Spela in 1080 x 1920'}
                </button>

                <label className="slither-studio__editor-label">
                    Scenario
                    <textarea
                        spellCheck="false"
                        value={scenarioText}
                        onChange={event => setScenarioText(event.target.value)}
                    />
                </label>
                <button type="button" onClick={applyScenarioText}>Ladda scenario</button>
                <p className="slither-studio__notice">{notice}</p>
            </aside>
        </main>
    );
}
