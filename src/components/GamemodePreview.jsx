import React, { useEffect, useRef } from 'react';
import { drawGamemodePreview } from './gamemodePreviewDraw.js';

const PREVIEW_W = 480;
const PREVIEW_H = 480;

export default function GamemodePreview({ mode, className = '' }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(PREVIEW_W * dpr);
        canvas.height = Math.round(PREVIEW_H * dpr);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGamemodePreview(ctx, PREVIEW_W, PREVIEW_H, mode);
    }, [mode]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            width={PREVIEW_W}
            height={PREVIEW_H}
            aria-hidden="true"
        />
    );
}
