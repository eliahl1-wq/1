import React, { useEffect, useRef } from 'react';
import { drawGamemodePreview } from './gamemodePreviewDraw.js';

export default function GamemodePreview({ mode, className = '' }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const wrap = canvas?.parentElement;
        if (!canvas || !wrap) return;

        const paint = () => {
            const w = wrap.clientWidth;
            const h = wrap.clientHeight;
            if (w < 2 || h < 2) return;

            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawGamemodePreview(ctx, w, h, mode);
        };

        const ro = new ResizeObserver(paint);
        ro.observe(wrap);
        paint();

        return () => ro.disconnect();
    }, [mode]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            aria-hidden="true"
        />
    );
}
