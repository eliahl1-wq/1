import React, { useEffect, useRef } from 'react';
import { drawGamemodePreview } from './gamemodePreviewDraw.js';

const SLITHER_PREVIEW_IMAGES = {
    slither: '/normal slither.png',
    'competitive-slither': '/arena slither.png',
    'br-slither': '/battle royale slither.png',
};

const CANVAS_W = 480;
const CANVAS_H = 480;

export default function GamemodePreview({ mode, className = '' }) {
    const imageSrc = SLITHER_PREVIEW_IMAGES[mode];
    const canvasRef = useRef(null);

    useEffect(() => {
        if (imageSrc) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(CANVAS_W * dpr);
        canvas.height = Math.round(CANVAS_H * dpr);
        canvas.style.width = '';
        canvas.style.height = '';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGamemodePreview(ctx, CANVAS_W, CANVAS_H, mode, { fit: false });
    }, [mode, imageSrc]);

    if (imageSrc) {
        return (
            <img
                src={imageSrc}
                alt=""
                className={className}
                aria-hidden="true"
                draggable={false}
            />
        );
    }

    return (
        <canvas
            ref={canvasRef}
            className={className}
            width={CANVAS_W}
            height={CANVAS_H}
            aria-hidden="true"
        />
    );
}
