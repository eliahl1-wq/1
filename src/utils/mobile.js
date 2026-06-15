/**
 * Touch / mobile detection shared by the games so in-game layout, controls and
 * the landscape gate all agree on what "mobile" means.
 */
export function isTouchDevice() {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    return !!coarse || 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}
