const PRESENCE_KEY = 'site_presence_id';
let memoryPresenceId;

export function getOrCreatePresenceId() {
    let id = memoryPresenceId;
    try { id = localStorage.getItem(PRESENCE_KEY) || id; } catch { /* restricted storage */ }
    if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try { localStorage.setItem(PRESENCE_KEY, id); } catch { /* session-only identity */ }
    }
    memoryPresenceId = id;
    return id;
}

export function buildPresenceHeaders({ page, gamemode } = {}) {
    const headers = {
        'X-Presence-Id': getOrCreatePresenceId(),
        'X-Presence-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    const path = page ?? (typeof window !== 'undefined' ? window.location.pathname : '');
    if (path) headers['X-Presence-Page'] = path;
    let storedMode = '';
    try { storedMode = localStorage.getItem('selected_gamemode') || ''; } catch { /* restricted storage */ }
    const mode = gamemode ?? storedMode;
    if (mode) headers['X-Presence-Gamemode'] = mode;
    return headers;
}

export async function pingSitePresence(apiUrl, { page, gamemode, username, token } = {}) {
    if (!apiUrl) return;
    const base = apiUrl.replace(/\/$/, '');
    try {
        const presenceHeaders = buildPresenceHeaders({ page, gamemode });
        await fetch(`${base}/api/presence/ping`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'bypass-tunnel-reminders': 'true',
                'X-Presence-Guest': token ? 'false' : 'true',
                ...(token ? { Authorization: 'Bearer ' + token } : {}),
                ...presenceHeaders,
            },
            body: JSON.stringify({
                page: page ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
                gamemode: gamemode ?? presenceHeaders['X-Presence-Gamemode'] ?? null,
                username: username || null,
            }),
        });
    } catch {
        /* non-critical */
    }
}
