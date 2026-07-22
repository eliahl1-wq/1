const PRESENCE_KEY = 'site_presence_id';

export function getOrCreatePresenceId() {
    let id = localStorage.getItem(PRESENCE_KEY);
    if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(PRESENCE_KEY, id);
    }
    return id;
}

export function buildPresenceHeaders({ page, gamemode } = {}) {
    const headers = {
        'X-Presence-Id': getOrCreatePresenceId(),
        'X-Presence-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const path = page ?? (typeof window !== 'undefined' ? window.location.pathname : '');
    if (path) headers['X-Presence-Page'] = path;
    const mode = gamemode ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('selected_gamemode') : '');
    if (mode) headers['X-Presence-Gamemode'] = mode;
    return headers;
}

export async function pingSitePresence(apiUrl, { page, gamemode, username, token } = {}) {
    if (!apiUrl) return;
    const base = apiUrl.replace(/\/$/, '');
    try {
        await fetch(`${base}/api/presence/ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'bypass-tunnel-reminders': 'true',
                'X-Presence-Guest': token ? 'false' : 'true',
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
                ...buildPresenceHeaders({ page, gamemode }),
            },
            body: JSON.stringify({
                page: page ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
                gamemode: gamemode ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('selected_gamemode') : null),
                username: username || null,
            }),
        });
    } catch {
        /* non-critical */
    }
}
