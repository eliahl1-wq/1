/**
 * Fullscreen mobile game session with a best-effort orientation lock.
 * CSS provides a landscape fallback for browsers that do not expose the lock API.
 */
export async function enterGameMobileSession(container, orientation = null) {
    if (!container) return;

    try {
        const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fullscreenElement) {
            if (container.requestFullscreen) {
                try {
                    await container.requestFullscreen({ navigationUI: 'hide' });
                } catch {
                    await container.requestFullscreen();
                }
            } else if (container.webkitRequestFullscreen) {
                await container.webkitRequestFullscreen();
            }
        }
    } catch {
        /* Fullscreen requires a user gesture on many browsers. */
    }

    if (orientation && screen.orientation?.lock) {
        try {
            await screen.orientation.lock(orientation);
        } catch {
            /* iOS and some embedded browsers rely on the CSS fallback. */
        }
    }
}

export function exitGameMobileSession(container) {
    try {
        screen.orientation?.unlock?.();
    } catch {
        /* Orientation may not have been locked. */
    }

    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl && (!container || fsEl === container)) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        exit?.call(document)?.catch?.(() => {});
    }
}