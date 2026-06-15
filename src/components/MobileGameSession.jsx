import { useEffect } from 'react';
import { isTouchDevice } from '../utils/mobile';
import { enterGameMobileSession, exitGameMobileSession } from '../utils/gameMobileSession';
import { notifyGameLayoutChange } from '../utils/forcedLandscape';

/**
 * On mobile: optional fullscreen when entering a game. Works in portrait and landscape.
 */
export default function MobileGameSession({ containerRef }) {
    useEffect(() => {
        if (!isTouchDevice()) return;

        const container = containerRef?.current;
        if (!container) return;

        const onLayoutChange = () => notifyGameLayoutChange();

        enterGameMobileSession(container);

        const onFirstTouch = () => enterGameMobileSession(container);

        container.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
        window.addEventListener('resize', onLayoutChange);
        window.addEventListener('orientationchange', onLayoutChange);

        return () => {
            container.removeEventListener('touchstart', onFirstTouch);
            window.removeEventListener('resize', onLayoutChange);
            window.removeEventListener('orientationchange', onLayoutChange);
            exitGameMobileSession(container);
        };
    }, [containerRef]);

    return null;
}
