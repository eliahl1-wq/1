import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
let initialized = false;

export function initMixpanel() {
    if (initialized || !TOKEN) return;
    mixpanel.init(TOKEN, {
        debug: import.meta.env.DEV,
        track_pageview: true,
        persistence: 'localStorage',
        ignore_dnt: false,
    });
    mixpanel.register({ platform: 'web' });
    initialized = true;
}

export function trackMixpanelEvent(eventName, properties = {}) {
    if (!TOKEN) return;
    if (!initialized) initMixpanel();
    mixpanel.track(eventName, { platform: 'web', ...properties });
}

export function identifyMixpanelUser(userId, traits = {}) {
    if (!TOKEN || !userId) return;
    if (!initialized) initMixpanel();
    mixpanel.identify(String(userId));
    if (Object.keys(traits).length > 0) {
        mixpanel.people.set({ platform: 'web', ...traits });
    }
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

export function resetMixpanel() {
    if (!TOKEN) return;
    if (!initialized) initMixpanel();
    mixpanel.reset();
}
