const SEEN_TOURNAMENTS_KEY = 'arenifi-seen-tournaments-v1';
const LEGACY_SEEN_TOURNAMENTS_KEY = 'agarstake-seen-tournaments-v1';

export const TOURNAMENT_SEEN_EVENT = 'arenifi:tournaments-seen';

export function getActiveTournamentIds(tournaments = []) {
    return tournaments.filter(t => t?.id && ['scheduled', 'live'].includes(t.status)).map(t => String(t.id));
}

function readSeenTournamentIds() {
    try {
        const storedValue = localStorage.getItem(SEEN_TOURNAMENTS_KEY)
            || localStorage.getItem(LEGACY_SEEN_TOURNAMENTS_KEY)
            || '[]';
        const value = JSON.parse(storedValue);
        if (!localStorage.getItem(SEEN_TOURNAMENTS_KEY) && storedValue !== '[]') {
            localStorage.setItem(SEEN_TOURNAMENTS_KEY, storedValue);
            localStorage.removeItem(LEGACY_SEEN_TOURNAMENTS_KEY);
        }
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
