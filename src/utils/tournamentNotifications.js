const SEEN_TOURNAMENTS_KEY = 'agarstake-seen-tournaments-v1';

export const TOURNAMENT_SEEN_EVENT = 'agarstake:tournaments-seen';

export function getActiveTournamentIds(tournaments = []) {
    return tournaments.filter(t => t?.id && ['scheduled', 'live'].includes(t.status)).map(t => String(t.id));
}

function readSeenTournamentIds() {
    try {
        const value = JSON.parse(localStorage.getItem(SEEN_TOURNAMENTS_KEY) || '[]');
        return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch {
        return new Set();
    }
}

export function hasUnseenActiveTournament(tournaments) {
    const seen = readSeenTournamentIds();
    return getActiveTournamentIds(tournaments).some(id => !seen.has(id));
}

export function markActiveTournamentsSeen(tournaments) {
    const activeIds = getActiveTournamentIds(tournaments);
    if (!activeIds.length) return;
    const seen = readSeenTournamentIds();
    activeIds.forEach(id => seen.add(id));
    try {
        localStorage.setItem(SEEN_TOURNAMENTS_KEY, JSON.stringify([...seen].slice(-100)));
        window.dispatchEvent(new CustomEvent(TOURNAMENT_SEEN_EVENT));
    } catch {
        // Keep the page working when browser storage is blocked.
    }
}