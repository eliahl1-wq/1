import React, { useEffect, useRef } from 'react';
import { drawGamemodePreview } from './gamemodePreviewDraw.js';

const PREVIEW_IMAGES = {
    slither: '/normal slither.png',
    'competitive-slither': '/arena slither.png',
    'br-slither': '/battle royale slither.png',
    surviv: '/surviv normal.png',
};

const CANVAS_W = 480;
const CANVAS_H = 480;
const FIT_CANVAS_W = 640;
const FIT_CANVAS_H = 480;

export default function GamemodePreview({ mode, className = '', fit = false }) {
    const imageSrc = PREVIEW_IMAGES[mode];
    const canvasRef = useRef(null);

    useEffect(() => {
        if (imageSrc) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const previewW = fit ? FIT_CANVAS_W : CANVAS_W;
        const previewH = fit ? FIT_CANVAS_H : CANVAS_H;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(previewW * dpr);
        canvas.height = Math.round(previewH * dpr);
        canvas.style.width = '';
        canvas.style.height = '';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGamemodePreview(ctx, previewW, previewH, mode, { fit });
    }, [mode, imageSrc, fit]);

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
            width={fit ? FIT_CANVAS_W : CANVAS_W}
            height={fit ? FIT_CANVAS_H : CANVAS_H}
            aria-hidden="true"
        />
    );
}
