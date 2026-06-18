import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN?.trim() || '';
const API_HOST = import.meta.env.VITE_MIXPANEL_API_HOST?.trim() || '';
const DEBUG = import.meta.env.DEV || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('mp_debug'));

let initialized = false;
let disabled = false;

function logStatus(message, ...args) {
    if (DEBUG || !TOKEN) {
        console.log(`[Mixpanel] ${message}`, ...args);
    }
}

export function isMixpanelConfigured() {
    return Boolean(TOKEN) && !disabled;
}

function disableMixpanel(reason) {
    if (disabled) return;
    disabled = true;
    logStatus('disabled', reason);
}

export function initMixpanel() {
    if (initialized || disabled) return;
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
        // Session replay is expensive in canvas games — never auto-start (see startSessionRecording).
        record_sessions_percent: 0,
    };
    if (API_HOST) {
        config.api_host = API_HOST;
    }

    try {
        mixpanel.init(TOKEN, config);
        mixpanel.register({ platform: 'web' });
        initialized = true;

        logStatus('init OK', API_HOST ? `(api_host: ${API_HOST})` : '(US default)');

        mixpanel.track('app_opened', {
            platform: 'web',
            path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        });
    } catch (err) {
        disableMixpanel(err?.message || 'init failed');
    }
}

export function trackMixpanelEvent(eventName, properties = {}) {
    if (!TOKEN || disabled) return;
    if (!initialized) initMixpanel();
    if (disabled) return;
    logStatus('track', eventName, properties);
    try {
        mixpanel.track(eventName, { platform: 'web', ...properties });
    } catch {
        disableMixpanel('track failed');
    }
}

export function identifyMixpanelUser(userId, traits = {}) {
    if (!TOKEN || !userId || disabled) return;
    if (!initialized) initMixpanel();
    if (disabled) return;
    try {
        mixpanel.identify(String(userId));
        if (Object.keys(traits).length > 0) {
            mixpanel.people.set({ platform: 'web', ...traits });
        }
        logStatus('identify', userId);
    } catch {
        disableMixpanel('identify failed');
    }
}

export function syncMixpanelUser(user) {
    if (disabled) return;
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
    if (!TOKEN || disabled) return;
    if (!initialized) initMixpanel();
    if (disabled) return;
    if (typeof mixpanel.start_session_recording === 'function') {
        mixpanel.start_session_recording();
        logStatus('session recording started manually');
    }
}

export function stopSessionRecording() {
    if (!TOKEN || disabled) return;
    if (!initialized) return;
    if (typeof mixpanel.stop_session_recording === 'function') {
        mixpanel.stop_session_recording();
        logStatus('session recording stopped');
    }
}

export function resetMixpanel() {
    if (!TOKEN || disabled) return;
    if (!initialized) initMixpanel();
    if (disabled) return;
    mixpanel.reset();
    logStatus('reset');
}
