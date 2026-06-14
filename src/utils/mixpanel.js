import mixpanel from 'mixpanel-browser';

const TOKEN = import.meta.env.VITE_MIXPANEL_TOKEN;
let initialized = false;

export function initMixpanel() {
    if (initialized || !TOKEN) return;
    mixpanel.init(TOKEN, {
        debug: import.meta.env.DEV,
        track_pageview: true,
        persistence: 'localStorage',
    });
    initialized = true;
}

export function trackMixpanelEvent(eventName, properties = {}) {
    if (!TOKEN) return;
    if (!initialized) initMixpanel();
    mixpanel.track(eventName, properties);
}

export function identifyMixpanelUser(userId, traits = {}) {
    if (!TOKEN || !userId) return;
    if (!initialized) initMixpanel();
    mixpanel.identify(String(userId));
    if (Object.keys(traits).length > 0) {
        mixpanel.people.set(traits);
    }
}
