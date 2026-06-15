import { isTouchDevice } from './mobile';

/** Phone held upright — game still renders as landscape via CSS rotation. */
export function isPortraitViewport() {
    return window.innerHeight > window.innerWidth;
}

export function isPortraitLockActive() {
    return isTouchDevice() && isPortraitViewport();
}

/** Logical in-game screen size (always landscape-shaped on mobile). */
export function getGameScreenSize() {
    if (isPortraitLockActive()) {
        return { width: window.innerHeight, height: window.innerWidth };
    }
    return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Map a screen pointer position into game space (relative to canvas center).
 * Handles the 90° CSS rotation applied in portrait-lock mode.
 */
export function mapPointerToGameSpace(clientX, clientY, element) {
    const { width, height } = getGameScreenSize();
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;

    if (isPortraitLockActive()) {
        // inverse of translate(-50%,-50%) rotate(90deg)
        const lx = dy;
        const ly = -dx;
        dx = lx;
        dy = ly;
    }

    return { x: dx, y: dy, screenWidth: width, screenHeight: height };
}

export const GAME_LAYOUT_CHANGE = 'gamelayoutchange';

export function notifyGameLayoutChange() {
    window.dispatchEvent(new Event(GAME_LAYOUT_CHANGE));
}
