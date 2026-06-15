/**
 * Enter fullscreen + lock landscape on mobile. Retries on first touch because
 * most browsers require a user gesture for fullscreen.
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
        /* fullscreen needs a gesture on many browsers */
    }

    try {
        await window.screen?.orientation?.lock?.('landscape');
    } catch {
        /* unsupported on iOS or outside fullscreen */
    }
}

export function exitGameMobileSession(container) {
    try {
        window.screen?.orientation?.unlock?.();
    } catch { /* noop */ }

    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl && (!container || fsEl === container)) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        exit?.call(document)?.catch?.(() => {});
    }
}
