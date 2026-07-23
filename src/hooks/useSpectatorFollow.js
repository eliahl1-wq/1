import { useCallback, useEffect, useRef, useState } from 'react';

function validPlayers(getPlayers) {
    const players = typeof getPlayers === 'function' ? getPlayers() : [];
    return (Array.isArray(players) ? players : []).filter(player => (
        player
        && player.id != null
        && Number.isFinite(player.x)
        && Number.isFinite(player.y)
    ));
}

export function useSpectatorFollow({ active, cameraRef, getPlayers }) {
    const targetIdRef = useRef(null);
    const freeCameraRef = useRef(false);
    const [target, setTarget] = useState(null);

    const followPlayer = useCallback((player) => {
        if (!player) return false;
        targetIdRef.current = player.id;
        freeCameraRef.current = false;
        setTarget({ id: player.id, name: player.name || 'Player' });
        if (cameraRef.current) {
            cameraRef.current.x = player.x;
            cameraRef.current.y = player.y;
        }
        return true;
    }, [cameraRef]);

    const followNearest = useCallback((x, y) => {
        const players = validPlayers(getPlayers);
        if (!players.length) {
            targetIdRef.current = null;
            freeCameraRef.current = false;
            setTarget(null);
            return false;
        }
        const cx = Number.isFinite(x) ? x : (cameraRef.current?.x || 0);
        const cy = Number.isFinite(y) ? y : (cameraRef.current?.y || 0);
        let nearest = players[0];
        let nearestDistance = Infinity;
        for (const player of players) {
            const dx = player.x - cx;
            const dy = player.y - cy;
            const distance = dx * dx + dy * dy;
            if (distance < nearestDistance) {
                nearest = player;
                nearestDistance = distance;
            }
        }
        return followPlayer(nearest);
    }, [cameraRef, followPlayer, getPlayers]);

    const cyclePlayer = useCallback((direction) => {
        const players = validPlayers(getPlayers);
        if (!players.length) {
            targetIdRef.current = null;
            setTarget(null);
            return;
        }
        const currentIndex = players.findIndex(player => player.id === targetIdRef.current);
        const offset = direction < 0 ? -1 : 1;
        const nextIndex = currentIndex < 0
            ? (offset < 0 ? players.length - 1 : 0)
            : (currentIndex + offset + players.length) % players.length;
        followPlayer(players[nextIndex]);
    }, [followPlayer, getPlayers]);

    const useFreeCamera = useCallback(() => {
        targetIdRef.current = null;
        freeCameraRef.current = true;
        setTarget(null);
    }, []);

    const getSpectatorCamera = useCallback(() => {
        const camera = cameraRef.current;
        if (!camera) return null;
        const targetId = targetIdRef.current;
        if (targetId != null) {
            const player = validPlayers(getPlayers).find(candidate => candidate.id === targetId);
            if (player) {
                camera.x = player.x;
                camera.y = player.y;
            }
        }
        return camera;
    }, [cameraRef, getPlayers]);

    useEffect(() => {
        if (!active) {
            targetIdRef.current = null;
            freeCameraRef.current = false;
            setTarget(null);
            return undefined;
        }

        const validateTarget = () => {
            const players = validPlayers(getPlayers);
            const current = players.find(player => player.id === targetIdRef.current);
            if (current) {
                setTarget(previous => (
                    previous?.id === current.id && previous?.name === (current.name || 'Player')
                        ? previous
                        : { id: current.id, name: current.name || 'Player' }
                ));
                return;
            }
            if (!freeCameraRef.current) {
                followNearest(cameraRef.current?.x, cameraRef.current?.y);
            }
        };

        validateTarget();
        const interval = setInterval(validateTarget, 250);
        return () => clearInterval(interval);
    }, [active, cameraRef, followNearest, getPlayers]);

    return {
        target,
        isFollowing: target != null,
        followNearest,
        cyclePrevious: useCallback(() => cyclePlayer(-1), [cyclePlayer]),
        cycleNext: useCallback(() => cyclePlayer(1), [cyclePlayer]),
        useFreeCamera,
        getSpectatorCamera,
    };
}
