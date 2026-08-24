import { useEffect, useRef } from 'react';

export default function GamePlusCursor() {
    const cursorRef = useRef(null);

    useEffect(() => {
        const cursor = cursorRef.current;
        if (!cursor || !window.matchMedia('(pointer: fine)').matches) return undefined;

        const hide = () => {
            cursor.dataset.visible = 'false';
        };
        const move = (event) => {
            if (event.pointerType === 'touch') {
                hide();
                return;
            }

            const target = event.target;
            const isGameSurface = target instanceof Element
                && target.classList.contains('gameplay-cursor-surface');
            if (!isGameSurface) {
                hide();
                return;
            }

            cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
            cursor.dataset.visible = 'true';
        };

        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerdown', move, { passive: true });
        window.addEventListener('blur', hide);
        document.addEventListener('mouseleave', hide);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerdown', move);
            window.removeEventListener('blur', hide);
            document.removeEventListener('mouseleave', hide);
        };
    }, []);

    return <span ref={cursorRef} className="game-plus-cursor" data-visible="false" aria-hidden="true" />;
}
