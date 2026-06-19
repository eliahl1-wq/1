/**
 * Central gamemode catalog — titles, copy, and promotional badges.
 * badge: 'popular' | 'new' | null
 */
export const GAMEMODE_CATALOG = [
    {
        id: 'agar',
        tab: 'agar',
        title: 'Agar Normal',
        shortTitle: 'Agar',
        badge: null,
        desc: 'Classic blob arena. Grow, absorb, dominate.',
        longDesc: 'The classic high-stakes Agar experience. Grow, absorb, dominate. Choose $5, $10, or $20 entry in the lobby.',
    },
    {
        id: 'slither',
        tab: 'slither',
        title: 'Slither Normal',
        shortTitle: 'Slither',
        badge: null,
        desc: 'High-stakes snake battles. Outmaneuver and grow.',
        longDesc: 'Classic high-stakes snake arena. Outmaneuver enemies, grow longer. $5 / $10 / $20 entry.',
    },
    {
        id: 'competitive-slither',
        tab: 'slither',
        title: 'Slither Arena',
        shortTitle: 'Arena',
        badge: 'popular',
        desc: 'Shrinking zone, separate pools, cash out anytime.',
        longDesc: '$2 or $5 entry — separate pools, real players only. Circular arena, shrinking zone before reset. Cash out your dollar balance anytime.',
    },
    {
        id: 'br-agar',
        tab: 'agar',
        title: 'Agar Battle Royale',
        shortTitle: 'Agar BR',
        badge: null,
        brOnly: true,
        desc: 'Last blob standing wins the pool.',
        longDesc: '5–10 players, shrinking zone, last one standing wins the pool. $5 or $10 entry, no cash-out.',
    },
    {
        id: 'br-slither',
        tab: 'slither',
        title: 'Slither Battle Royale',
        shortTitle: 'Slither BR',
        badge: null,
        brOnly: true,
        desc: 'Winner takes all — zone closes in fast.',
        longDesc: '5–10 snakes, deadly zone closes in, winner takes all. $5 or $10 entry, no cash-out.',
    },
];

export function getVisibleGamemodes(brAvailable = false) {
    return GAMEMODE_CATALOG.filter((m) => !m.brOnly || brAvailable);
}

export function getGamemodeConfig(id) {
    return GAMEMODE_CATALOG.find((m) => m.id === id) || null;
}

const PLAYED_KEY = 'played_gamemodes';
const DISMISS_KEY = 'gm_discovery_dismissed_at';
const SESSION_KEY = 'gm_discovery_pending';
const DISMISS_DAYS = 3;

export function markGamemodePlayed(modeId) {
    if (!modeId) return;
    try {
        const prev = JSON.parse(localStorage.getItem(PLAYED_KEY) || '[]');
        if (!prev.includes(modeId)) {
            localStorage.setItem(PLAYED_KEY, JSON.stringify([...prev, modeId]));
        }
    } catch { /* ignore */ }
}

export function getPlayedGamemodes() {
    try {
        return JSON.parse(localStorage.getItem(PLAYED_KEY) || '[]');
    } catch {
        return [];
    }
}

export function flagDiscoveryForSession() {
    try {
        sessionStorage.setItem(SESSION_KEY, '1');
    } catch { /* ignore */ }
}

export function clearDiscoverySessionFlag() {
    try {
        sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
}

export function dismissDiscoveryPrompt() {
    try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
}

export function shouldShowDiscoveryPrompt(currentMode, brAvailable = false) {
    try {
        const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
        if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) {
            if (!sessionStorage.getItem(SESSION_KEY)) return false;
        }

        const visible = getVisibleGamemodes(brAvailable);
        const others = visible.filter((m) => m.id !== currentMode);
        if (others.length === 0) return false;

        const played = getPlayedGamemodes();
        const hasUnplayed = others.some((m) => !played.includes(m.id));
        const freshSession = !!sessionStorage.getItem(SESSION_KEY);

        return hasUnplayed || freshSession;
    } catch {
        return false;
    }
}

export function pickDiscoveryModes(currentMode, brAvailable = false, limit = 3) {
    const played = getPlayedGamemodes();
    const others = getVisibleGamemodes(brAvailable)
        .filter((m) => m.id !== currentMode)
        .sort((a, b) => {
            const aUnplayed = played.includes(a.id) ? 1 : 0;
            const bUnplayed = played.includes(b.id) ? 1 : 0;
            if (aUnplayed !== bUnplayed) return aUnplayed - bUnplayed;
            const aBadge = a.badge === 'popular' ? 0 : a.badge === 'new' ? 1 : 2;
            const bBadge = b.badge === 'popular' ? 0 : b.badge === 'new' ? 1 : 2;
            return aBadge - bBadge;
        });
    return others.slice(0, limit);
}
