export function decodeSlitherTick(tick) {
    if (!tick?.snakes?.some(snake => Array.isArray(snake.segmentPositions))) return tick;
    return {
        ...tick,
        snakes: tick.snakes.map(snake => {
            if (!Array.isArray(snake.segmentPositions)) return snake;
            const { segmentPositions, ...metadata } = snake;
            const segments = [];
            for (let i = 0; i + 1 < segmentPositions.length; i += 2) {
                segments.push({ x: segmentPositions[i], y: segmentPositions[i + 1] });
            }
            return { ...metadata, segments };
        }),
    };
}
