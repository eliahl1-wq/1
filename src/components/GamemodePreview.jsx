import React, { useEffect, useRef } from 'react';
import { drawGamemodePreview } from './gamemodePreviewDraw.js';

const DESKTOP_W = 480;
const DESKTOP_H = 480;
const MOBILE_MQ = '(max-width: 768px)';

function isMobileGamemodeLayout() {
    return typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches;
}

export default function GamemodePreview({ mode, className = '' }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const wrap = canvas?.parentElement;
        if (!canvas || !wrap) return;

        const paintDesktop = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(DESKTOP_W * dpr);
            canvas.height = Math.round(DESKTOP_H * dpr);
            canvas.style.width = '';
            canvas.style.height = '';

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            drawGamemodePreview(ctx, DESKTOP_W, DESKTOP_H, mode, { fit: false });
        };

        const paintMobile = () => {
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
            drawGamemodePreview(ctx, w, h, mode, { fit: true });
        };

        let ro = null;

        const syncObserver = () => {
            if (isMobileGamemodeLayout()) {
                if (!ro) {
                    ro = new ResizeObserver(paint);
                    ro.observe(wrap);
                }
            } else if (ro) {
                ro.disconnect();
                ro = null;
            }
        };

        const paint = () => {
            syncObserver();
            if (isMobileGamemodeLayout()) paintMobile();
            else paintDesktop();
        };

        const mq = window.matchMedia(MOBILE_MQ);
        const onMq = () => paint();
        mq.addEventListener('change', onMq);
        paint();

        return () => {
            mq.removeEventListener('change', onMq);
            ro?.disconnect();
        };
    }, [mode]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            width={DESKTOP_W}
            height={DESKTOP_H}
            aria-hidden="true"
        />
    );
}
