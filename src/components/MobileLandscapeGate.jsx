import React, { useEffect, useState } from 'react';
import { isTouchDevice } from '../utils/mobile';

/**
 * Forces in-game play to landscape on mobile.
 * Attempts a real orientation lock (works in fullscreen on most Android browsers)
 * and, since that is unsupported on iOS, also blocks the view with a rotate prompt
 * whenever the device is held in portrait.
 */
export default function MobileLandscapeGate() {
    const [isMobile] = useState(() => isTouchDevice());
    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        if (!isMobile) return;

        const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
        check();

        const tryLock = async () => {
            try {
                await window.screen?.orientation?.lock?.('landscape');
            } catch {
                /* unsupported (iOS / not fullscreen) — the rotate prompt handles it */
            }
        };
        tryLock();

        window.addEventListener('resize', check);
        window.addEventListener('orientationchange', check);
        return () => {
            window.removeEventListener('resize', check);
            window.removeEventListener('orientationchange', check);
            try { window.screen?.orientation?.unlock?.(); } catch { /* noop */ }
        };
    }, [isMobile]);

    if (!isMobile || !isPortrait) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 200000,
                background: '#06070a',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '22px',
                color: '#fff',
                textAlign: 'center',
                padding: '0 32px',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            <div
                style={{
                    width: 64,
                    height: 96,
                    border: '3px solid rgba(255,255,255,0.85)',
                    borderRadius: 12,
                    animation: 'mlg-rotate 1.8s ease-in-out infinite',
                }}
            />
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.3px' }}>
                Rotate your device
            </div>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', maxWidth: 320, lineHeight: 1.5 }}>
                This game is played in landscape. Turn your phone sideways to keep playing.
            </div>
            <style>{`
                @keyframes mlg-rotate {
                    0%, 40% { transform: rotate(0deg); }
                    60%, 100% { transform: rotate(-90deg); }
                }
            `}</style>
        </div>
    );
}
