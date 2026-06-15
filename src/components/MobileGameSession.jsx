import { useEffect } from 'react';
import { isTouchDevice } from '../utils/mobile';
import { enterGameMobileSession, exitGameMobileSession } from '../utils/gameMobileSession';
import { notifyGameLayoutChange } from '../utils/forcedLandscape';

const PORTRAIT_LOCK_CLASS = 'game-viewport--portrait-lock';

/**
 * Mobile in-game session: fullscreen + landscape lock when supported, and a CSS
 * rotation fallback so the game always *looks* landscape even when the phone
 * is held upright (iOS Safari can't orientation-lock).
 */
export default function MobileGameSession({ containerRef }) {
    useEffect(() => {
        if (!isTouchDevice()) return;

        const container = containerRef?.current;
        if (!container) return;

        const syncPortraitLock = () => {
            const portrait = window.innerHeight > window.innerWidth;
            container.classList.toggle(PORTRAIT_LOCK_CLASS, portrait);
            notifyGameLayoutChange();
        };

        enterGameMobileSession(container);
        syncPortraitLock();

        const onFirstTouch = () => enterGameMobileSession(container);
        const onFullscreenChange = () => {
            if (document.fullscreenElement === container || document.webkitFullscreenElement === container) {
                window.screen?.orientation?.lock?.('landscape').catch(() => {});
            }
        };

        container.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
        window.addEventListener('resize', syncPortraitLock);
        window.addEventListener('orientationchange', syncPortraitLock);
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);

        return () => {
            container.removeEventListener('touchstart', onFirstTouch);
            window.removeEventListener('resize', syncPortraitLock);
            window.removeEventListener('orientationchange', syncPortraitLock);
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
            container.classList.remove(PORTRAIT_LOCK_CLASS);
            exitGameMobileSession(container);
        };
    }, [containerRef]);

    return null;
}
