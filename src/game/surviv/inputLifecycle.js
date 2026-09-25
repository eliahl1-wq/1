// Only the pointer that began desktop fire can release it. In particular,
// lifting a second touch over the canvas must not release the aim joystick's
// firePressId: the server deliberately ignores further down packets for it.
export function createPrimaryFireInput({ renderer, canStart, send }) {
    let pointerId = null;

    const stop = () => {
        if (pointerId == null) return false;
        pointerId = null;
        renderer.handlePointerUp();
        send(renderer.getInputPayload());
        return true;
    };

    return {
        press(event) {
            if (event.button !== 0 || pointerId != null || !canStart()) return false;
            renderer.handlePointerMove(event.clientX, event.clientY);
            renderer.handlePointerDown();
            const payload = renderer.getInputPayload();
            if (!payload.shooting) return false;
            pointerId = event.pointerId;
            send(payload);
            return true;
        },
        release(event) {
            if (event.pointerId !== pointerId || event.button !== 0) return false;
            return stop();
        },
        cancel(event) {
            if (event.pointerId !== pointerId) return false;
            return stop();
        },
        move(event) {
            // Releasing the left button while another mouse button is held
            // produces pointermove, not pointerup, in Pointer Events.
            if (event.pointerId !== pointerId || (event.buttons & 1) !== 0) return false;
            return stop();
        },
        neutralize() {
            pointerId = null;
            renderer.clearInput();
            send({ ...renderer.getInputPayload(), dx: 0, dy: 0, shooting: false });
        },
    };
}

// Browser/app switches do not guarantee a final pointerup. Use the same reset
// points for game input and joystick ownership so a resumed touch cannot revive
// old movement or leave a stick occupied by a pointer that no longer exists.
export function listenForInputInterruption(windowTarget, documentTarget, onInterrupt) {
    const onVisibilityChange = () => {
        if (documentTarget.hidden) onInterrupt();
    };
    for (const type of ['blur', 'pagehide', 'orientationchange']) {
        windowTarget.addEventListener(type, onInterrupt);
    }
    documentTarget.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
        for (const type of ['blur', 'pagehide', 'orientationchange']) {
            windowTarget.removeEventListener(type, onInterrupt);
        }
        documentTarget.removeEventListener('visibilitychange', onVisibilityChange);
    };
}
