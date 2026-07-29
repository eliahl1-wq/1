import React, { useEffect, useRef } from 'react';
import { SlitherRenderer } from '../SlitherRenderer.js';
import { SlitherStudioSimulation } from './SlitherStudioSimulation.js';
import { cloneScenario, STUDIO_SCENARIOS } from './studioScenarios.js';

const VIEW_WIDTH = 360;
const VIEW_HEIGHT = 640;
const CAPTURE_DPR = 1.6;

export default function SlitherStudioRender() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const scenarioId = params.get('scenario') || 'reference-coil-trap';
        const source = STUDIO_SCENARIOS.find(item => item.id === scenarioId) || STUDIO_SCENARIOS[0];
        const scenario = cloneScenario(source);
        const simulation = new SlitherStudioSimulation(scenario);
        const renderer = new SlitherRenderer(canvasRef.current, {
            fixedViewWidth: VIEW_WIDTH,
            fixedViewHeight: VIEW_HEIGHT,
            fixedDpr: CAPTURE_DPR,
            forceMobile: false,
            hideMinimap: scenario.ui?.hideMinimap !== false,
            balanceBadgeScale: scenario.ui?.balanceBadgeScale || 0.68,
        });
        const usePlayerCamera = scenario.renderMode === 'player';
        renderer.setInputEnabled(false);
        renderer.setHideOverlays(false);
        renderer.setSpectatorMode(!usePlayerCamera, simulation.getCamera());

        const renderFrame = (frame, fps = 30) => {
            const targetTime = Math.max(0, Number(frame) || 0) / fps;
            while (!simulation.finished && simulation.elapsedSeconds + 1e-9 < targetTime) {
                simulation.step();
            }
            if (!usePlayerCamera) {
                renderer.setSpectatorMode(true, simulation.getCamera());
            }
            renderer.updateState(simulation.getRenderState());
            renderer.draw(1 / fps);
            return {
                frame,
                time: simulation.elapsedSeconds,
                finished: simulation.finished,
                diagnostics: simulation.getDiagnostics(),
                width: canvasRef.current.width,
                height: canvasRef.current.height,
            };
        };

        renderFrame(Math.max(0, Number(params.get('frame')) || 0));
        window.__SLITHER_RENDER__ = {
            ready: true,
            duration: scenario.duration,
            fps: 30,
            renderFrame,
        };

        return () => {
            delete window.__SLITHER_RENDER__;
            renderer.destroy();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ display: 'block', width: VIEW_WIDTH, height: VIEW_HEIGHT }}
            aria-label="Slither render canvas"
        />
    );
}
