const PROD_API_FALLBACK = 'https://2-production-9e74.up.railway.app';

export function getApiUrl() {
    const explicit = import.meta.env.VITE_API_URL;
    if (explicit) return explicit.replace(/\/$/, '');
    if (import.meta.env.DEV) return window.location.origin.replace(/\/$/, '');
    if (window.location.hostname.endsWith('.up.railway.app')) return window.location.origin.replace(/\/$/, '');
    return PROD_API_FALLBACK;
}

export const API_URL = getApiUrl();
