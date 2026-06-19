import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN?.trim() || '';
const API_HOST = import.meta.env.VITE_MIXPANEL_API_HOST?.trim() || '';
const RECORD_SESSIONS_PERCENT = (() => {
    const raw = import.meta.env.VITE_MIXPANEL_RECORD_SESSIONS_PERCENT;
    if (raw === undefined || raw === '') return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
})();
const DEBUG = import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mp_debug'));

let initialized = false;

function logStatus(message, ...args) {
    if (DEBUG || !TOKEN) {
        console.log(`[Mixpanel] ${message}`, ...args);
    }
}

export function isMixpanelConfigured() {
    return Boolean(TOKEN);
}

export function initMixpanel() {
    if (initialized) return;
    if (!TOKEN) {
        console.warn('[Mixpanel] VITE_MIXPANEL_TOKEN saknas — events skickas inte. Sätt variabeln i Cloudflare (Production) och redeploya.');
        return;
    }

    const config = {
        debug: DEBUG,
        track_pageview: true,
        persistence: 'localStorage',
        ignore_dnt: true,
        batch_requests: true,
        // Session Replay — required for Mixpanel onboarding "replays" check (0 = off by default in SDK)
        record_sessions_percent: RECORD_SESSIONS_PERCENT,
    };
    if (API_HOST) {
        config.api_host = API_HOST;
    }

    mixpanel.init(TOKEN, config);
    mixpanel.register({ platform: 'web' });
    initialized = true;

    logStatus('init OK', API_HOST ? `(api_host: ${API_HOST})` : '(US default)', `replay: ${RECORD_SESSIONS_PERCENT}%`);

    mixpanel.track('app_opened', {
        platform: 'web',
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
}

export function trackMixpanelEvent(eventName, properties = {}) {
    if (!TOKEN) return;
    if (!initialized) initMixpanel();
    logStatus('track', eventName, properties);
    mixpanel.track(eventName, { platform: 'web', ...properties });
}

export function identifyMixpanelUser(userId, traits = {}) {
    if (!TOKEN || !userId) return;
    if (!initialized) initMixpanel();
    mixpanel.identify(String(userId));
    if (Object.keys(traits).length > 0) {
        mixpanel.people.set({ platform: 'web', ...traits });
    }
    logStatus('identify', userId);
}

export function syncMixpanelUser(user) {
    if (!user) return;
    const userId = user.id || user._id;
    if (!userId) return;
    identifyMixpanelUser(userId, {
        $name: user.username,
        username: user.username,
        ...(user.isAdmin != null ? { is_admin: user.isAdmin } : {}),
    });
}

export function startSessionRecording() {
    if (!TOKEN) return;
    if (!initialized) initMixpanel();
    if (typeof mixpanel.start_session_recording === 'function') {
        mixpanel.start_session_recording();
        logStatus('session recording started manually');
    }
}

export function stopSessionRecording() {
    if (!TOKEN) return;
    if (!initialized) return;
    if (typeof mixpanel.stop_session_recording === 'function') {
        mixpanel.stop_session_recording();
        logStatus('session recording stopped');
    }
}

export function resetMixpanel() {
    if (!TOKEN) return;
    if (!initialized) initMixpanel();
    mixpanel.reset();
    logStatus('reset');
}
