/**
 * Optional fullscreen on mobile when entering a game (no orientation lock).
 */
export async function enterGameMobileSession(container) {
    if (!container) return;

    try {
        if (container.requestFullscreen) {
            await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            await container.webkitRequestFullscreen();
        }
    } catch {
        /* needs a user gesture on many browsers */
    }
}

export function exitGameMobileSession(container) {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl && (!container || fsEl === container)) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        exit?.call(document)?.catch?.(() => {});
    }
}
