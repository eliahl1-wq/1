/** Toggle Battle Royale on the public site (game code and routes stay intact). */
export const BATTLE_ROYALE_ENABLED = false;

export function isBattleRoyaleMode(mode) {
    return !!mode && String(mode).startsWith('br-');
}

export function isBattleRoyaleAvailable(isAdmin = false, mode = null) {
    return mode === 'br-surviv' || BATTLE_ROYALE_ENABLED || !!isAdmin;
}

/** Map hidden BR modes to their normal variant for lobby UI. */
export function normalizeGamemodeForLobby(mode, isAdmin = false) {
    if (!mode) return 'agar';
    if (isBattleRoyaleAvailable(isAdmin, mode) || !isBattleRoyaleMode(mode)) return mode;
    return mode.replace(/^br-/, '') || 'agar';
}
