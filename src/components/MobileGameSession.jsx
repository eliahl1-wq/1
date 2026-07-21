import { useEffect } from 'react';
import { isTouchDevice } from '../utils/mobile';
import { enterGameMobileSession, exitGameMobileSession } from '../utils/gameMobileSession';
import { notifyGameLayoutChange } from '../utils/forcedLandscape';

/**
 * On mobile: optional fullscreen and best-effort orientation lock when entering a game.
 */
export default function MobileGameSession({ containerRef, orientation = null }) {
    useEffect(() => {
        if (!isTouchDevice()) return;

        const container = containerRef?.current;
        if (!container) return;

        const root = document.documentElement;
        const body = document.body;
        let layoutRaf = 0;
        let lastWidth = 0;
        let lastHeight = 0;
        const updateViewport = () => {
            const viewport = window.visualViewport;
            const width = Math.round(viewport?.width || window.innerWidth);
            const height = Math.round(viewport?.height || window.innerHeight);
            if (width === lastWidth && height === lastHeight) return;
            lastWidth = width;
            lastHeight = height;
            root.style.setProperty('--game-viewport-width', `${width}px`);
            root.style.setProperty('--game-viewport-height', `${height}px`);
            notifyGameLayoutChange();
        };
        const onLayoutChange = () => {
            cancelAnimationFrame(layoutRaf);
            layoutRaf = requestAnimationFrame(updateViewport);
        };

        root.classList.add('game-session-active');
        body.classList.add('game-session-active');
        updateViewport();
        enterGameMobileSession(container, orientation);

        const onFirstInteraction = () => enterGameMobileSession(container, orientation);

        container.addEventListener('pointerdown', onFirstInteraction, { once: true, passive: true, capture: true });
        window.addEventListener('resize', onLayoutChange);
        window.addEventListener('orientationchange', onLayoutChange);
        window.visualViewport?.addEventListener('resize', onLayoutChange);
        window.visualViewport?.addEventListener('scroll', onLayoutChange);
        document.addEventListener('fullscreenchange', onLayoutChange);
        document.addEventListener('webkitfullscreenchange', onLayoutChange);

        return () => {
            container.removeEventListener('pointerdown', onFirstInteraction, true);
            window.removeEventListener('resize', onLayoutChange);
            window.removeEventListener('orientationchange', onLayoutChange);
            window.visualViewport?.removeEventListener('resize', onLayoutChange);
            window.visualViewport?.removeEventListener('scroll', onLayoutChange);
            document.removeEventListener('fullscreenchange', onLayoutChange);
            document.removeEventListener('webkitfullscreenchange', onLayoutChange);
            cancelAnimationFrame(layoutRaf);
            root.classList.remove('game-session-active');
            body.classList.remove('game-session-active');
            root.style.removeProperty('--game-viewport-width');
            root.style.removeProperty('--game-viewport-height');
            exitGameMobileSession(container);
        };
    }, [containerRef, orientation]);

    return null;
}
