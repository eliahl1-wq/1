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

        const onLayoutChange = () => notifyGameLayoutChange();

        enterGameMobileSession(container, orientation);

        const onFirstTouch = () => enterGameMobileSession(container, orientation);

        container.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
        window.addEventListener('resize', onLayoutChange);
        window.addEventListener('orientationchange', onLayoutChange);

        return () => {
            container.removeEventListener('touchstart', onFirstTouch);
            window.removeEventListener('resize', onLayoutChange);
            window.removeEventListener('orientationchange', onLayoutChange);
            exitGameMobileSession(container);
        };
    }, [containerRef, orientation]);

    return null;
}
