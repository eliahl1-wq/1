import { isTouchDevice } from './mobile';

/** < 1 = zoomed out (more world visible). Desktop always 1. */
export const MOBILE_VIEW_ZOOM = 0.76;

export function getMobileViewZoom() {
    return isTouchDevice() ? MOBILE_VIEW_ZOOM : 1;
}

/** Canvas pixel size (matches the physical screen). */
export function getGameScreenSize() {
    return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Map pointer position to game-space offset from player center.
 * Also returns inflated screen dims so the server sends a wider view on mobile.
 */
export function mapPointerToGameSpace(clientX, clientY, element) {
    const { width, height } = getGameScreenSize();
    const viewZoom = getMobileViewZoom();
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    return {
        x: (clientX - cx) / viewZoom,
        y: (clientY - cy) / viewZoom,
        screenWidth: width / viewZoom,
        screenHeight: height / viewZoom,
    };
}

export const GAME_LAYOUT_CHANGE = 'gamelayoutchange';

export function notifyGameLayoutChange() {
    window.dispatchEvent(new Event(GAME_LAYOUT_CHANGE));
}
