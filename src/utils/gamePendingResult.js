const KEYS = {
    slither: 'slither_pending_result',
    agar: 'agar_pending_result',
    surviv: 'surviv_pending_result',
};

export function savePendingResult(game, data) {
    try {
        sessionStorage.setItem(KEYS[game], JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch { /* ignore quota */ }
}

export function loadPendingResult(game) {
    try {
        const raw = sessionStorage.getItem(KEYS[game]);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || (data.type !== 'death' && data.type !== 'cashout')) return null;
        return data;
    } catch {
        return null;
    }
}

export function clearPendingResult(game) {
    try {
        sessionStorage.removeItem(KEYS[game]);
    } catch { /* ignore */ }
}
